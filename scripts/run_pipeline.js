#!/usr/bin/env node

require('dotenv').config();

const dayjs = require('dayjs');
const { loadConfig } = require('../lib/config');
const { ensureDb } = require('../lib/db');
const { evaluatePrice } = require('../lib/alerts');
const flightsSky = require('../lib/providers/flights_sky');
const booking = require('../lib/providers/booking_rapidapi');
const priceline = require('../lib/providers/priceline_rapidapi');
const telegram = require('../lib/notifiers/telegram');

const DELAY_MS = 3000;
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function findCheapestWeek(origin, airport, weeks) {
  let best = null;
  for (const weekStart of weeks) {
    const returnDate = dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD');
    try {
      const data = await flightsSky.searchRoundTrip({
        origin, destination: airport, departDate: weekStart, returnDate
      });
      const result = flightsSky.extractCheapest(data);
      if (result && (!best || result.price < best.price)) {
        best = { ...result, weekStart, returnDate };
      }
    } catch (err) {
      console.warn(`  [vuelo] ${origin}-${airport} ${weekStart}: ${err.message}`);
    }
    await sleep(DELAY_MS);
  }
  return best;
}

async function searchHotel(dest, checkIn, checkOut) {
  try {
    const data = await booking.searchHotels({
      city: dest.city, checkIn, checkOut, adults: 2, minStars: 0,
      destId: dest.booking_dest_id, searchType: 'city'
    });
    return booking.extractMinPrice(data);
  } catch (err) {
    console.warn(`  [hotel] ${dest.city}: ${err.message}`);
    return null;
  }
}

async function searchCar(airport, pickupDate, dropoffDate) {
  try {
    const data = await priceline.searchCars({
      pickupLocation: airport, pickupDate, dropoffDate
    });
    return priceline.extractMinPrice(data, 'economy');
  } catch (err) {
    console.warn(`  [coche] ${airport}: ${err.message}`);
    return null;
  }
}

(async () => {
  const config = loadConfig();
  const db = ensureDb();
  const { origins, weeks, destinations, threshold_percent } = config.alerts;

  const items = [];
  const packages = [];

  for (const dest of destinations) {
    console.log(`\n=== ${dest.name} ===`);

    for (const origin of origins) {
      let bestFlight = null;

      for (const airport of dest.airports) {
        console.log(`  Buscando ${origin}→${airport} (${weeks.length} semanas)...`);
        const result = await findCheapestWeek(origin, airport, weeks);
        if (result && (!bestFlight || result.price < bestFlight.price)) {
          bestFlight = { ...result, airport };
        }
      }

      if (!bestFlight) {
        const fbStart = weeks[0];
        const fbEnd = dayjs(fbStart).add(7, 'day').format('YYYY-MM-DD');
        console.log(`  ${origin}→${dest.name}: sin vuelos, usando fallback`);
        packages.push({
          origin, dest: dest.name, airport: dest.airports[0],
          dates: `${fbStart} → ${fbEnd}`,
          flight: { price: dest.fallback_flight, provider: 'fallback' },
          hotel: { price: dest.fallback_hotel, provider: 'fallback', currency: 'EUR' },
          car: { price: dest.fallback_car, currency: 'USD', provider: 'fallback' }
        });

        items.push(
          { item_type: 'flight', item_key: `${origin}-${dest.name}`, provider: 'fallback', currency: 'EUR', price: dest.fallback_flight, metadata: { fallback: true } },
          { item_type: 'hotel', item_key: `${dest.name}-hotel`, provider: 'fallback', currency: 'EUR', price: dest.fallback_hotel, metadata: { fallback: true } },
          { item_type: 'car', item_key: `${dest.name}-coche`, provider: 'fallback', currency: 'USD', price: dest.fallback_car, metadata: { fallback: true } }
        );
        continue;
      }

      const { weekStart, returnDate, airport } = bestFlight;
      console.log(`  ✈️  ${origin}→${airport}: ${bestFlight.price}€ (${weekStart} → ${returnDate})`);

      const flightItem = {
        item_type: 'flight', item_key: `${origin}-${dest.name}`,
        provider: 'flights-sky', currency: 'EUR', price: bestFlight.price,
        metadata: { origin, airport, depart: weekStart, return: returnDate }
      };
      items.push(flightItem);

      await sleep(DELAY_MS);
      const hotelPrice = await searchHotel(dest, weekStart, returnDate);
      const hotelItem = {
        item_type: 'hotel', item_key: `${dest.name}-hotel`,
        provider: hotelPrice !== null ? 'booking-rapidapi' : 'fallback',
        currency: 'EUR', price: hotelPrice !== null ? hotelPrice : dest.fallback_hotel,
        metadata: { city: dest.city, checkIn: weekStart, checkOut: returnDate }
      };
      items.push(hotelItem);
      if (hotelPrice !== null) console.log(`  🏨 ${dest.city}: ${hotelPrice}€ (${weekStart} → ${returnDate})`);
      else console.log(`  🏨 ${dest.city}: fallback ${dest.fallback_hotel}€`);

      await sleep(DELAY_MS);
      const carPrice = await searchCar(airport, weekStart, returnDate);
      const carItem = {
        item_type: 'car', item_key: `${dest.name}-coche`,
        provider: carPrice !== null ? 'priceline-rapidapi' : 'fallback',
        currency: 'USD', price: carPrice !== null ? carPrice : dest.fallback_car,
        metadata: { airport, pickupDate: weekStart, dropoffDate: returnDate }
      };
      items.push(carItem);
      if (carPrice !== null) console.log(`  🚗 ${airport}: ${carPrice} USD (${weekStart} → ${returnDate})`);
      else console.log(`  🚗 ${airport}: fallback ${dest.fallback_car} USD`);

      const total = bestFlight.price + (hotelPrice || dest.fallback_hotel) + (carPrice || dest.fallback_car);
      console.log(`  💰 TOTAL ${origin}→${dest.name}: ~${Math.round(total)}€`);

      packages.push({
        origin, dest: dest.name, airport,
        dates: `${weekStart} → ${returnDate}`,
        flight: { price: bestFlight.price, provider: 'flights-sky' },
        hotel: { price: hotelPrice || dest.fallback_hotel, provider: hotelPrice ? 'booking' : 'fallback', currency: 'EUR' },
        car: { price: carPrice || dest.fallback_car, provider: carPrice ? 'priceline' : 'fallback', currency: 'USD' },
        total
      });
    }
  }

  console.log('\n--- Evaluando alertas ---');
  const allAlerts = [];
  for (const item of items) {
    const alerts = evaluatePrice(db, config, item);
    alerts.forEach((a) => allAlerts.push({ ...a, item }));
  }

  if (allAlerts.length) {
    console.log(`${allAlerts.length} alertas:`);
    allAlerts.forEach((a) => console.log(`  ${a.item.item_key}: ${a.message}`));
  } else {
    console.log('Sin alertas nuevas.');
  }

  await telegram.notifyPackages(packages, allAlerts);
})();

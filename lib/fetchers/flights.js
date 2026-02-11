const dayjs = require('dayjs');
const kiwi = require('../providers/kiwi');
const kiwiRapid = require('../providers/kiwi_rapidapi');
const skyscanner = require('../providers/skyscanner');

const DELAY_MS = 2000;
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const providers = [
  { name: 'kiwi', mod: kiwi, envCheck: () => process.env.KIWI_API_KEY },
  { name: 'kiwi-rapidapi', mod: kiwiRapid, envCheck: () => process.env.RAPIDAPI_KEY || process.env.SKYCANNER_API_KEY },
  { name: 'skyscanner', mod: skyscanner, envCheck: () => process.env.RAPIDAPI_KEY || process.env.SKYCANNER_API_KEY }
];

async function fetchFlightPrice(origin, destination, dateStart, dateEnd, airportIds) {
  const errors = [];

  for (const { name, mod, envCheck } of providers) {
    if (!envCheck()) {
      errors.push(`${name}: sin API key`);
      continue;
    }

    try {
      const opts = {
        origin,
        destination,
        departureDate: dateStart,
        returnDate: dateStart,
        departureDateTo: dateEnd,
        returnDateTo: dateEnd
      };
      if (name === 'skyscanner') opts.airportIds = airportIds;

      const result = await mod.searchFlights(opts);
      const price = mod.extractMinPrice(result);

      if (price !== null) {
        console.log(`[flights] ${origin}-${destination}: ${price}€ via ${name}`);
        return { price, provider: name };
      }

      errors.push(`${name}: sin precios`);
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
    }
  }

  throw new Error(`Todos los proveedores fallaron: ${errors.join(' | ')}`);
}

async function scrapeFlight(route, destination, airportIds) {
  const dateStart = dayjs(route.date_start).format('YYYY-MM-DD');
  const dateEnd = dayjs(route.date_end).format('YYYY-MM-DD');

  const { price, provider } = await fetchFlightPrice(route.origin, destination, dateStart, dateEnd, airportIds);

  return {
    item_type: 'flight',
    item_key: `${route.origin}-${destination}-agosto`,
    provider,
    currency: 'EUR',
    price,
    metadata: {
      origin: route.origin,
      destination,
      month: `${dateStart} a ${dateEnd}`,
      notes: 'Mejor precio en el rango'
    }
  };
}

async function fetchFlights(config) {
  const results = [];
  let first = true;
  for (const route of config.alerts.flights) {
    for (const destination of route.destinations) {
      if (!first) await sleep(DELAY_MS);
      first = false;
      try {
        const result = await scrapeFlight(route, destination, config.alerts.airport_ids || {});
        results.push(result);
      } catch (err) {
        console.warn(`[flights] ${route.origin}-${destination}: ${err.message}`);
        const fallback = route.fallback_price || (route.scrape && route.scrape.fallback_price);
        if (fallback) {
          results.push({
            item_type: 'flight',
            item_key: `${route.origin}-${destination}-${dayjs(route.date_start).format('YYYY-MM-DD')}-${dayjs(route.date_end).format('YYYY-MM-DD')}`,
            provider: 'fallback',
            currency: 'EUR',
            price: fallback,
            metadata: {
              fallback: true,
              error: err.message
            }
          });
        }
      }
    }
  }
  return results;
}

module.exports = {
  fetchFlights
};

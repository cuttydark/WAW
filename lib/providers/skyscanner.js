const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.SKYCANNER_API_KEY;
const RAPIDAPI_HOST = 'sky-scrapper.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

const airportCache = new Map();

const RETRY_DELAYS = [3000, 6000, 12000];

async function requestWithRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.response?.status === 429 && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`[skyscanner] 429 rate limit, retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

function ensureKey() {
  if (!RAPIDAPI_KEY) {
    throw new Error('Falta RAPIDAPI_KEY en el entorno');
  }
}

function headers() {
  return {
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key': RAPIDAPI_KEY
  };
}

async function searchAirport(query) {
  if (airportCache.has(query)) return airportCache.get(query);
  ensureKey();
  const resp = await requestWithRetry(() =>
    axios.get(`${BASE_URL}/api/v1/flights/searchAirport`, {
      headers: headers(),
      params: { query, locale: 'es-ES' }
    }).then((r) => r.data)
  );
  if (!resp?.status || !resp?.data?.length) {
    throw new Error(`Aeropuerto no encontrado: ${query}`);
  }
  const airport = resp.data.find((d) => d.skyId === query) || resp.data[0];
  const result = { skyId: airport.skyId, entityId: airport.entityId };
  airportCache.set(query, result);
  return result;
}

async function searchFlights({ origin, destination, departureDate, returnDate, adults = 1, cabinClass = 'economy', currency = 'EUR', airportIds = {} }) {
  ensureKey();

  const originInfo = airportIds[origin] || await searchAirport(origin);
  const destInfo = airportIds[destination] || await searchAirport(destination);

  const params = {
    originSkyId: originInfo.skyId,
    destinationSkyId: destInfo.skyId,
    originEntityId: originInfo.entityId,
    destinationEntityId: destInfo.entityId,
    date: departureDate,
    cabinClass,
    adults,
    sortBy: 'best',
    currency,
    market: 'es-ES',
    countryCode: 'ES'
  };
  if (returnDate) {
    params.returnDate = returnDate;
  }

  const data = await requestWithRetry(() =>
    axios.get(`${BASE_URL}/api/v1/flights/searchFlights`, {
      headers: headers(),
      params
    }).then((r) => r.data)
  );

  if (!data?.status) {
    throw new Error(`Skyscanner searchFlights falló: ${JSON.stringify(data?.message || 'unknown')}`);
  }

  return data;
}

function extractMinPrice(data) {
  const itineraries = data.data?.itineraries || [];
  if (!itineraries.length) return null;

  let cheapest = Infinity;
  for (const itin of itineraries) {
    const raw = itin.price?.raw;
    if (typeof raw === 'number' && raw < cheapest) {
      cheapest = raw;
    }
  }

  return cheapest < Infinity ? cheapest : null;
}

module.exports = {
  searchAirport,
  searchFlights,
  extractMinPrice
};

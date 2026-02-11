const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'flights-sky.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

const MAX_RETRIES = 3;

async function requestWithRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err.response?.status === 429;
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      if ((is429 || isTimeout) && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 5000;
        console.warn(`[flights-sky] ${is429 ? '429' : 'timeout'}, retrying in ${delay / 1000}s (${attempt + 1}/${MAX_RETRIES})...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

function ensureKey() {
  if (!RAPIDAPI_KEY) throw new Error('Falta RAPIDAPI_KEY en el entorno');
}

function headers() {
  return { 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': RAPIDAPI_KEY };
}

async function searchRoundTrip({ origin, destination, departDate, returnDate, adults = 1, currency = 'EUR' }) {
  ensureKey();

  const data = await requestWithRetry(() =>
    axios.get(`${BASE_URL}/flights/search-roundtrip`, {
      headers: headers(),
      params: {
        fromEntityId: origin,
        toEntityId: destination,
        departDate,
        returnDate,
        cabinClass: 'economy',
        adults,
        currency
      },
      timeout: 30000
    }).then((r) => r.data)
  );

  return data;
}

function extractCheapest(data) {
  const itineraries = data?.data?.itineraries || [];
  if (!itineraries.length) return null;

  let best = null;
  for (const it of itineraries) {
    const price = it.price?.raw;
    if (typeof price === 'number' && (!best || price < best.price)) {
      const legs = it.legs || [];
      best = {
        price,
        departDate: legs[0]?.departure?.slice(0, 10),
        returnDate: legs[1]?.departure?.slice(0, 10),
        outbound: {
          from: legs[0]?.origin?.displayCode,
          to: legs[0]?.destination?.displayCode,
          departure: legs[0]?.departure,
          arrival: legs[0]?.arrival
        },
        inbound: {
          from: legs[1]?.origin?.displayCode,
          to: legs[1]?.destination?.displayCode,
          departure: legs[1]?.departure,
          arrival: legs[1]?.arrival
        }
      };
    }
  }

  return best;
}

module.exports = {
  searchRoundTrip,
  extractCheapest
};

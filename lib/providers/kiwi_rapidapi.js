const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.SKYCANNER_API_KEY;
const RAPIDAPI_HOST = 'kiwi-com-cheap-flights.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

const RETRY_DELAYS = [3000, 6000, 12000];

async function requestWithRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.response?.status === 429 && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`[kiwi-rapidapi] 429 rate limit, retrying in ${delay / 1000}s...`);
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

async function searchFlights({ origin, destination, departureDate, returnDate, departureDateTo, returnDateTo, adults = 1, currency = 'EUR' }) {
  ensureKey();

  const params = {
    source: `Airport:${origin}`,
    destination: `Airport:${destination}`,
    currency: currency.toLowerCase(),
    locale: 'es',
    adults,
    children: 0,
    infants: 0,
    handbags: 1,
    holdbags: 0,
    cabinClass: 'ECONOMY',
    sortBy: 'PRICE',
    sortOrder: 'ASCENDING',
    limit: 10,
    transportTypes: 'FLIGHT'
  };

  if (departureDate) {
    params.departDateFrom = departureDate;
    params.departDateTo = departureDateTo || departureDate;
  }
  if (returnDate) {
    params.returnDateFrom = returnDate;
    params.returnDateTo = returnDateTo || returnDate;
  }

  const endpoint = returnDate ? '/round-trip' : '/one-way';

  const data = await requestWithRetry(() =>
    axios.get(`${BASE_URL}${endpoint}`, {
      headers: headers(),
      params
    }).then((r) => r.data)
  );

  return data;
}

function extractMinPrice(data) {
  const itineraries = data.itineraries || [];
  if (!itineraries.length) return null;

  let cheapest = Infinity;
  for (const itin of itineraries) {
    const amount = parseFloat(itin.price?.amount);
    if (!isNaN(amount) && amount < cheapest) {
      cheapest = amount;
    }
  }

  return cheapest < Infinity ? cheapest : null;
}

module.exports = {
  searchFlights,
  extractMinPrice
};

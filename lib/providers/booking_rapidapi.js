const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.SKYCANNER_API_KEY;
const RAPIDAPI_HOST = 'booking-com15.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

const RETRY_DELAYS = [3000, 6000, 12000];

async function requestWithRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.response?.status === 429 && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`[booking-rapidapi] 429 rate limit, retrying in ${delay / 1000}s...`);
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

async function searchDestination(query) {
  ensureKey();
  const data = await requestWithRetry(() =>
    axios.get(`${BASE_URL}/api/v1/hotels/searchDestination`, {
      headers: headers(),
      params: { query }
    }).then((r) => r.data)
  );
  if (!data?.status || !data?.data?.length) {
    throw new Error(`Destino no encontrado: ${query}`);
  }
  const city = data.data.find((d) => d.search_type === 'city') || data.data[0];
  return { dest_id: city.dest_id, search_type: city.search_type || 'city' };
}

async function searchHotels({ city, checkIn, checkOut, adults = 2, minStars = 0, currency = 'EUR', destId, searchType }) {
  ensureKey();

  let destInfo;
  if (destId && searchType) {
    destInfo = { dest_id: destId, search_type: searchType };
  } else {
    destInfo = await searchDestination(city);
  }

  const params = {
    dest_id: destInfo.dest_id,
    search_type: destInfo.search_type,
    arrival_date: checkIn,
    departure_date: checkOut,
    adults,
    room_qty: 1,
    currency_code: currency,
    languagecode: 'es',
    sort_by: 'price'
  };

  if (minStars > 0) {
    params.categories_filter = `class::${minStars}`;
  }

  const data = await requestWithRetry(() =>
    axios.get(`${BASE_URL}/api/v1/hotels/searchHotels`, {
      headers: headers(),
      params
    }).then((r) => r.data)
  );

  if (!data?.status) {
    throw new Error(`Booking searchHotels falló: ${JSON.stringify(data?.message || 'unknown')}`);
  }

  return data;
}

function extractMinPrice(data) {
  const hotels = data.data?.hotels || [];
  if (!hotels.length) return null;

  let cheapest = Infinity;
  for (const hotel of hotels) {
    const gross = hotel.property?.priceBreakdown?.grossPrice?.value;
    if (typeof gross === 'number' && gross < cheapest) {
      cheapest = gross;
    }
  }

  return cheapest < Infinity ? cheapest : null;
}

module.exports = {
  searchDestination,
  searchHotels,
  extractMinPrice
};

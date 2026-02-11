const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || process.env.SKYCANNER_API_KEY;
const RAPIDAPI_HOST = 'priceline-com2.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

const MAX_RETRIES = 3;

async function requestWithRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout') || (err.response?.data?.errors === 'timeout');
      const is429 = err.response?.status === 429;
      if ((isTimeout || is429) && attempt < MAX_RETRIES) {
        const delay = (attempt + 1) * 5000;
        console.warn(`[priceline-rapidapi] ${isTimeout ? 'timeout' : '429'}, retrying in ${delay / 1000}s (${attempt + 1}/${MAX_RETRIES})...`);
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

async function searchCars({ pickupLocation, pickupDate, dropoffDate, pickupTime = '10:00', dropoffTime = '10:00' }) {
  ensureKey();

  const params = {
    pickUpLocation: pickupLocation,
    dropOffLocation: pickupLocation,
    pickUpDate: pickupDate,
    dropOffDate: dropoffDate,
    pickUpTime: pickupTime,
    dropOffTime: dropoffTime
  };

  const data = await requestWithRetry(async () => {
    const resp = await axios.get(`${BASE_URL}/cars/search`, {
      headers: headers(),
      params,
      timeout: 45000
    });
    if (!resp.data?.status && resp.data?.errors === 'timeout') {
      const err = new Error('Priceline server timeout');
      err.code = 'ECONNABORTED';
      throw err;
    }
    return resp.data;
  });

  if (!data?.status) {
    throw new Error(`Priceline searchCars falló: ${JSON.stringify(data?.message || data?.errors || 'unknown')}`);
  }

  return data;
}

function extractMinPrice(data, category) {
  const vehicles = data.data?.vehicles || [];
  if (!vehicles.length) return null;

  let cheapest = Infinity;
  for (const vehicle of vehicles) {
    if (category) {
      const cats = (vehicle.categoryCodes || []).map((c) => c.toLowerCase());
      if (!cats.some((c) => c.includes(category.toLowerCase()))) continue;
    }

    const rates = vehicle.rate || [];
    for (const rate of rates) {
      const total = parseFloat(rate.totalPrice);
      if (!isNaN(total) && total < cheapest) {
        cheapest = total;
      }
    }
  }

  return cheapest < Infinity ? cheapest : null;
}

module.exports = {
  searchCars,
  extractMinPrice
};

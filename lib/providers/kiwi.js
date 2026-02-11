const axios = require('axios');
const dayjs = require('dayjs');

const API_KEY = process.env.KIWI_API_KEY;
const BASE_URL = 'https://tequila-api.kiwi.com';

function ensureKey() {
  if (!API_KEY) {
    throw new Error('Falta KIWI_API_KEY en el entorno');
  }
}

async function searchFlights({ origin, destination, departureDate, returnDate, adults = 1, currency = 'EUR' }) {
  ensureKey();

  const params = {
    fly_from: origin,
    fly_to: destination,
    date_from: dayjs(departureDate).format('DD/MM/YYYY'),
    date_to: dayjs(departureDate).format('DD/MM/YYYY'),
    adults,
    curr: currency,
    limit: 10,
    sort: 'price',
    one_for_city: 0,
    max_stopovers: 2
  };

  if (returnDate) {
    params.return_from = dayjs(returnDate).format('DD/MM/YYYY');
    params.return_to = dayjs(returnDate).format('DD/MM/YYYY');
  }

  const { data } = await axios.get(`${BASE_URL}/v2/search`, {
    headers: { apikey: API_KEY },
    params
  });

  return data;
}

function extractMinPrice(data) {
  const flights = data.data || [];
  if (!flights.length) return null;

  let cheapest = Infinity;
  for (const flight of flights) {
    const price = flight.price;
    if (typeof price === 'number' && price < cheapest) {
      cheapest = price;
    }
  }

  return cheapest < Infinity ? cheapest : null;
}

module.exports = {
  searchFlights,
  extractMinPrice
};

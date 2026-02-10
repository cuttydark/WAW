const axios = require('axios');
const dayjs = require('dayjs');

const API_KEY = process.env.SKYCANNER_API_KEY || process.env.SKYCANNER_KEY || process.env.SKYCANNER_TOKEN;
const API_HOST = process.env.SKYCANNER_API_HOST || 'https://partners.api.skyscanner.net/apiservices';

function ensureKey() {
  if (!API_KEY) {
    throw new Error('Falta SKYCANNER_API_KEY en el entorno');
  }
}

function buildQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

async function searchFlights({ origin, destination, departureDate, returnDate, adults = 1, cabinClass = 'economy' }) {
  ensureKey();

  const endpoint = `${API_HOST}/v3/flights/live/search/create`;
  const payload = {
    market: 'ES',
    locale: 'es-ES',
    currency: 'EUR',
    query: {
      adults,
      cabinClass,
      queryLegs: [
        {
          originPlaceId: { iata: origin },
          destinationPlaceId: { iata: destination },
          date: departureDate
        }
      ]
    }
  };

  if (returnDate) {
    payload.query.queryLegs.push({
      originPlaceId: { iata: destination },
      destinationPlaceId: { iata: origin },
      date: returnDate
    });
  }

  const { data } = await axios.post(endpoint, payload, {
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY
    }
  });

  return data;
}

async function searchCars({ pickupIata, pickupDate, dropoffDate }) {
  ensureKey();

  const endpoint = `${API_HOST}/carhire/live/search/create`; // Placeholder, adjust to actual endpoint
  const payload = {
    market: 'ES',
    currency: 'EUR',
    locale: 'es-ES',
    pickup: {
      date: pickupDate,
      location: {
        type: 'airport',
        code: pickupIata
      }
    },
    dropoff: {
      date: dropoffDate,
      location: {
        type: 'airport',
        code: pickupIata
      }
    },
    driverAge: 30
  };

  const { data } = await axios.post(endpoint, payload, {
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY
    }
  });

  return data;
}

module.exports = {
  searchFlights,
  searchCars
};

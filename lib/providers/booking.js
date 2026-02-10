const axios = require('axios');
const dayjs = require('dayjs');

const API_KEY = process.env.BOOKING_API_KEY;
const API_HOST = process.env.BOOKING_API_HOST || 'https://distribution-xml.booking.com/json';

function ensureKey() {
  if (!API_KEY) {
    throw new Error('Falta BOOKING_API_KEY en el entorno');
  }
}

async function searchHotels({ city, checkIn, checkOut, minStars = 4, adults = 2 }) {
  ensureKey();

  const endpoint = `${API_HOST}/bookings.getHotels`;

  const payload = {
    city_ids: [city],
    checkin: checkIn,
    checkout: checkOut,
    min_review_score: minStars === 5 ? 8.5 : 7,
    adults,
    extras: ['hotel_info', 'room_info'],
    rows: 20
  };

  const { data } = await axios.post(endpoint, payload, {
    auth: {
      username: API_KEY,
      password: API_KEY
    }
  });

  return data;
}

module.exports = {
  searchHotels
};

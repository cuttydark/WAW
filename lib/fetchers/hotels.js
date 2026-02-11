const dayjs = require('dayjs');
const booking = require('../providers/booking_rapidapi');

async function fetchHotelPrice(hotelConfig) {
  const checkIn = dayjs(hotelConfig.check_in).format('YYYY-MM-DD');
  const checkOut = dayjs(hotelConfig.check_out).format('YYYY-MM-DD');

  const result = await booking.searchHotels({
    city: hotelConfig.city,
    checkIn,
    checkOut,
    adults: 2,
    minStars: hotelConfig.min_stars || 0,
    destId: hotelConfig.dest_id,
    searchType: hotelConfig.search_type
  });

  const price = booking.extractMinPrice(result);
  if (price === null) {
    throw new Error('No se encontraron precios de hoteles');
  }

  return price;
}

async function fetchHotels(config) {
  const results = [];
  for (const hotelConfig of config.alerts.hotels) {
    const checkIn = dayjs(hotelConfig.check_in).format('YYYY-MM-DD');
    const checkOut = dayjs(hotelConfig.check_out).format('YYYY-MM-DD');
    const key = `${hotelConfig.city}-${checkIn}-${checkOut}-${hotelConfig.min_stars || 'any'}star`;

    try {
      const price = await fetchHotelPrice(hotelConfig);
      console.log(`[hotels] ${hotelConfig.city}: ${price}€ via booking-rapidapi`);
      results.push({
        item_type: 'hotel',
        item_key: key,
        provider: 'booking-rapidapi',
        currency: 'EUR',
        price,
        metadata: {
          city: hotelConfig.city,
          check_in: checkIn,
          check_out: checkOut,
          min_stars: hotelConfig.min_stars
        }
      });
    } catch (err) {
      console.warn(`[hotels] ${hotelConfig.city}: ${err.message}`);
      const fallback = hotelConfig.fallback_price || (hotelConfig.scrape && hotelConfig.scrape.fallback_price);
      if (fallback) {
        results.push({
          item_type: 'hotel',
          item_key: key,
          provider: 'fallback',
          currency: 'EUR',
          price: fallback,
          metadata: { fallback: true, error: err.message }
        });
      }
    }
  }
  return results;
}

module.exports = {
  fetchHotels
};

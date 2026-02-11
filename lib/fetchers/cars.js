const dayjs = require('dayjs');
const priceline = require('../providers/priceline_rapidapi');

async function fetchCarPrice(carConfig) {
  const pickupDate = dayjs(carConfig.pickup_date).format('YYYY-MM-DD');
  const dropoffDate = dayjs(carConfig.dropoff_date).format('YYYY-MM-DD');
  const pickupLocation = carConfig.pickup_location || carConfig.location;

  const result = await priceline.searchCars({
    pickupLocation,
    pickupDate,
    dropoffDate
  });

  const price = priceline.extractMinPrice(result, carConfig.category);
  if (price === null) {
    throw new Error('No se encontraron precios de coches');
  }

  return price;
}

async function fetchCars(config) {
  const results = [];
  for (const carConfig of config.alerts.cars) {
    const pickupDate = dayjs(carConfig.pickup_date).format('YYYY-MM-DD');
    const dropoffDate = dayjs(carConfig.dropoff_date).format('YYYY-MM-DD');
    const pickupLocation = carConfig.pickup_location || carConfig.location;
    const category = carConfig.category || 'economy';
    const key = `${pickupLocation}-${category}-${pickupDate}-${dropoffDate}`;

    try {
      const price = await fetchCarPrice(carConfig);
      console.log(`[cars] ${pickupLocation} ${category}: ${price} USD via priceline-rapidapi`);
      results.push({
        item_type: 'car',
        item_key: key,
        provider: 'priceline-rapidapi',
        currency: 'USD',
        price,
        metadata: {
          pickup_location: pickupLocation,
          pickup_date: pickupDate,
          dropoff_date: dropoffDate,
          category
        }
      });
    } catch (err) {
      console.warn(`[cars] ${pickupLocation}: ${err.message}`);
      const fallback = carConfig.fallback_price || (carConfig.scrape && carConfig.scrape.fallback_price);
      if (fallback) {
        results.push({
          item_type: 'car',
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
  fetchCars
};

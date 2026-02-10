const dayjs = require('dayjs');
const { withPage } = require('../scraper/browser');
const { fillTemplate, extractPrice } = require('../scraper/utils');

async function scrapeCar(carConfig) {
  if (!carConfig.scrape) {
    throw new Error(`Car ${carConfig.location} no tiene configuración de scrape`);
  }

  const context = {
    location: carConfig.location,
    pickup_location: carConfig.pickup_location || carConfig.location,
    pickup_date: dayjs(carConfig.pickup_date).format('YYYY-MM-DD'),
    dropoff_date: dayjs(carConfig.dropoff_date).format('YYYY-MM-DD'),
    category: carConfig.category || 'economy'
  };

  const url = fillTemplate(carConfig.scrape.url_template, context);

  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    if (carConfig.scrape.wait_for) {
      await page.waitForSelector(carConfig.scrape.wait_for, { timeout: 60000 });
    }
    const locator = page.locator(carConfig.scrape.price_selector).first();
    await locator.waitFor({ timeout: 20000 });
    const priceText = await locator.textContent();
    const price = extractPrice(priceText, carConfig.scrape.price_regex);

    return {
      item_type: 'car',
      item_key: `${context.pickup_location}-${context.category}-${context.pickup_date}-${context.dropoff_date}`,
      provider: 'scraper',
      currency: 'EUR',
      price,
      metadata: {
        url,
        pickup_location: context.pickup_location,
        pickup_date: context.pickup_date,
        dropoff_date: context.dropoff_date,
        category: context.category
      }
    };
  });
}

async function fetchCars(config) {
  const results = [];
  for (const carConfig of config.alerts.cars) {
    try {
      const result = await scrapeCar(carConfig);
      results.push(result);
    } catch (err) {
      console.warn(`[scrape cars] ${carConfig.location}: ${err.message}`);
      if (carConfig.scrape && carConfig.scrape.fallback_price) {
        results.push({
          item_type: 'car',
          item_key: `${(carConfig.pickup_location || carConfig.location)}-${carConfig.category || 'economy'}-${dayjs(carConfig.pickup_date).format('YYYY-MM-DD')}-${dayjs(carConfig.dropoff_date).format('YYYY-MM-DD')}`,
          provider: 'scraper-fallback',
          currency: 'EUR',
          price: carConfig.scrape.fallback_price,
          metadata: {
            fallback: true,
            error: err.message
          }
        });
      }
    }
  }
  return results;
}

module.exports = {
  fetchCars
};

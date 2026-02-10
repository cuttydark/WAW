const dayjs = require('dayjs');
const { withPage } = require('../scraper/browser');
const { fillTemplate, extractPrice } = require('../scraper/utils');

async function scrapeFlight(route, destination) {
  if (!route.scrape) {
    throw new Error(`Route ${route.name} no tiene configuración de scrape`);
  }

  const context = {
    origin: route.origin,
    destination,
    date_start: dayjs(route.date_start).format('YYYY-MM-DD'),
    date_end: dayjs(route.date_end).format('YYYY-MM-DD')
  };

  const url = fillTemplate(route.scrape.url_template, context);

  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    if (route.scrape.wait_for) {
      await page.waitForSelector(route.scrape.wait_for, { timeout: 60000 });
    }
    const locator = page.locator(route.scrape.price_selector).first();
    await locator.waitFor({ timeout: 20000 });
    const priceText = await locator.textContent();
    const price = extractPrice(priceText, route.scrape.price_regex);

    return {
      item_type: 'flight',
      item_key: `${route.origin}-${destination}-${context.date_start}-${context.date_end}`,
      provider: 'scraper',
      currency: 'EUR',
      price,
      metadata: {
        url,
        origin: route.origin,
        destination,
        departure: context.date_start,
        return: context.date_end
      }
    };
  });
}

async function fetchFlights(config) {
  const results = [];
  for (const route of config.alerts.flights) {
    for (const destination of route.destinations) {
      try {
        const result = await scrapeFlight(route, destination);
        results.push(result);
      } catch (err) {
        console.warn(`[scrape flights] ${route.origin}-${destination}: ${err.message}`);
        if (route.scrape && route.scrape.fallback_price) {
          results.push({
            item_type: 'flight',
            item_key: `${route.origin}-${destination}-${dayjs(route.date_start).format('YYYY-MM-DD')}-${dayjs(route.date_end).format('YYYY-MM-DD')}`,
            provider: 'scraper-fallback',
            currency: 'EUR',
            price: route.scrape.fallback_price,
            metadata: {
              fallback: true,
              error: err.message
            }
          });
        }
      }
    }
  }
  return results;
}

module.exports = {
  fetchFlights
};

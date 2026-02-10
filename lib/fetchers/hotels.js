const dayjs = require('dayjs');
const { withPage } = require('../scraper/browser');
const { fillTemplate, extractPrice } = require('../scraper/utils');

async function scrapeHotel(hotelConfig) {
  if (!hotelConfig.scrape) {
    throw new Error(`Hotel ${hotelConfig.city} no tiene configuración de scrape`);
  }

  const context = {
    city: hotelConfig.city,
    check_in: dayjs(hotelConfig.check_in).format('YYYY-MM-DD'),
    check_out: dayjs(hotelConfig.check_out).format('YYYY-MM-DD'),
    min_stars: hotelConfig.min_stars || ''
  };

  const url = fillTemplate(hotelConfig.scrape.url_template, context);

  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    if (hotelConfig.scrape.wait_for) {
      await page.waitForSelector(hotelConfig.scrape.wait_for, { timeout: 60000 });
    }
    const locator = page.locator(hotelConfig.scrape.price_selector).first();
    await locator.waitFor({ timeout: 20000 });
    const priceText = await locator.textContent();
    const price = extractPrice(priceText, hotelConfig.scrape.price_regex);

    return {
      item_type: 'hotel',
      item_key: `${hotelConfig.city}-${context.check_in}-${context.check_out}-${hotelConfig.min_stars || 'any'}star`,
      provider: 'scraper',
      currency: 'EUR',
      price,
      metadata: {
        url,
        city: hotelConfig.city,
        check_in: context.check_in,
        check_out: context.check_out,
        min_stars: hotelConfig.min_stars
      }
    };
  });
}

async function fetchHotels(config) {
  const results = [];
  for (const hotelConfig of config.alerts.hotels) {
    try {
      const result = await scrapeHotel(hotelConfig);
      results.push(result);
    } catch (err) {
      console.warn(`[scrape hotels] ${hotelConfig.city}: ${err.message}`);
      if (hotelConfig.scrape && hotelConfig.scrape.fallback_price) {
        results.push({
          item_type: 'hotel',
          item_key: `${hotelConfig.city}-${dayjs(hotelConfig.check_in).format('YYYY-MM-DD')}-${dayjs(hotelConfig.check_out).format('YYYY-MM-DD')}-${hotelConfig.min_stars || 'any'}star`,
          provider: 'scraper-fallback',
          currency: 'EUR',
          price: hotelConfig.scrape.fallback_price,
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
  fetchHotels
};

const { chromium } = require('playwright');

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    const executablePath = chromium.executablePath();
    browserInstance = await chromium.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browserInstance;
}

async function withPage(fn) {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (['image', 'media', 'font'].includes(resourceType)) {
      return route.abort();
    }
    return route.continue();
  });
  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}

async function shutdownBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

module.exports = {
  withPage,
  shutdownBrowser
};

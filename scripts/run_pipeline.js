#!/usr/bin/env node

require('dotenv').config();

const { loadConfig } = require('../lib/config');
const { ensureDb } = require('../lib/db');
const { evaluatePrice } = require('../lib/alerts');
const { fetchFlights } = require('../lib/fetchers/flights');
const { fetchHotels } = require('../lib/fetchers/hotels');
const { fetchCars } = require('../lib/fetchers/cars');
const telegram = require('../lib/notifiers/telegram');

function summariseAlerts(alerts) {
  if (!alerts.length) return 'Sin alertas';
  return alerts.map((a) => `• ${a.message}`).join('\n');
}

(async () => {
  const config = loadConfig();
  const db = ensureDb();

  const items = [];

  const flights = await fetchFlights(config);
  const hotels = await fetchHotels(config);
  const cars = await fetchCars(config);

  items.push(...flights, ...hotels, ...cars);

  if (!items.length) {
    console.log('No se recibieron precios. Revisa los selectores/URLs del scrape.');
    process.exit(1);
  }

  const allAlerts = [];

  for (const item of items) {
    const alerts = evaluatePrice(db, config, item);
    alerts.forEach((alert) => {
      allAlerts.push({ ...alert, item });
    });
    console.log(`[${item.item_type}] ${item.item_key} -> ${item.price} ${item.currency}`);
    const summary = summariseAlerts(alerts);
    console.log(summary);
  }

  console.log('--- Resumen ---');
  if (allAlerts.length === 0) {
    console.log('Sin alertas nuevas.');
  } else {
    allAlerts.forEach((alert) => {
      console.log(`${alert.item.item_type.toUpperCase()} ${alert.item.item_key}: ${alert.message}`);
    });
  }

  await telegram.notifyAlerts(allAlerts, items);
})();

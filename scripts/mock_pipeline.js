#!/usr/bin/env node

const dayjs = require('dayjs');
const { loadConfig } = require('../lib/config');
const { ensureDb } = require('../lib/db');
const { evaluatePrice } = require('../lib/alerts');

function logAlerts(tag, alerts) {
  if (!alerts || alerts.length === 0) {
    console.log(`[${tag}] sin alertas.`);
    return;
  }
  alerts.forEach(alert => {
    console.log(`[${tag}] ALERTA ${alert.type.toUpperCase()}: ${alert.message}`);
  });
}

(async () => {
  const config = loadConfig();
  const db = ensureDb();

  const scenarios = [
    {
      tag: 'Flight SVQ→MXP',
      entries: [
        { price: 150, observed_at: dayjs('2026-02-01T07:00:00Z') },
        { price: 159, observed_at: dayjs('2026-02-02T07:00:00Z') }
      ],
      template: {
        item_type: 'flight',
        item_key: 'SVQ-MXP-2026-02-07-2026-02-14',
        provider: 'skyscanner',
        currency: 'EUR',
        metadata: { cabin: 'economy' }
      }
    },
    {
      tag: 'Hotel 4★ Milán',
      entries: [
        { price: 220, observed_at: dayjs('2026-02-01T07:05:00Z') },
        { price: 205, observed_at: dayjs('2026-02-02T07:05:00Z') }
      ],
      template: {
        item_type: 'hotel',
        item_key: 'Milan-2026-02-07-2026-02-14-4star',
        provider: 'booking',
        currency: 'EUR',
        metadata: { stars: 4 }
      }
    },
    {
      tag: 'Coche económico MXP',
      entries: [
        { price: 45, observed_at: dayjs('2026-02-01T07:10:00Z') },
        { price: 48, observed_at: dayjs('2026-02-02T07:10:00Z') }
      ],
      template: {
        item_type: 'car',
        item_key: 'MXP-economy-2026-02-07-2026-02-14',
        provider: 'rentalcars',
        currency: 'EUR',
        metadata: { category: 'economy' }
      }
    }
  ];

  for (const scenario of scenarios) {
    for (const entry of scenario.entries) {
      const alerts = evaluatePrice(db, config, {
        ...scenario.template,
        price: entry.price,
        observed_at: entry.observed_at.toISOString()
      });
      logAlerts(scenario.tag, alerts);
    }
  }
})();

#!/usr/bin/env node

const path = require('path');
const { loadConfig } = require('../lib/config');
const { ensureDb } = require('../lib/db');
const { evaluatePrice } = require('../lib/alerts');

(async () => {
  const config = loadConfig();
  const db = ensureDb();

  // Example usage with dummy data. Replace with real fetch outputs.
  const sampleItem = {
    item_type: 'flight',
    item_key: 'SVQ-MXP-2026-02-07-2026-02-14',
    provider: 'demo',
    currency: 'EUR',
    price: 150.0,
    metadata: { cabin: 'economy' }
  };

  const alerts = evaluatePrice(db, config, sampleItem);
  console.log(JSON.stringify(alerts, null, 2));
})();

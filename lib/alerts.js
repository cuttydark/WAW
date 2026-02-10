const dayjs = require('dayjs');
const { insertPrice, getLatestPrice, getMinPrice } = require('./db');

function cents(amount) {
  return Math.round(amount * 100);
}

function percentDelta(newValue, oldValue) {
  if (!oldValue || oldValue === 0) return null;
  return ((newValue - oldValue) / oldValue) * 100;
}

function evaluatePrice(db, config, item) {
  const { item_type, item_key, provider, currency, price, metadata } = item;
  const observed_at = item.observed_at || dayjs().toISOString();
  const price_cents = cents(price);

  const latestBefore = getLatestPrice(db, item_type, item_key);
  const minBefore = getMinPrice(db, item_type, item_key);

  insertPrice(db, {
    item_type,
    item_key,
    provider,
    currency,
    price_cents,
    metadata,
    observed_at
  });

  const alerts = [];
  const threshold = config.alerts.threshold_percent;

  if (latestBefore) {
    const delta = percentDelta(price_cents, latestBefore.price_cents);
    if (delta !== null && delta >= threshold) {
      alerts.push({
        type: 'increase',
        item_type,
        item_key,
        provider,
        currency,
        price_cents,
        change_percent: delta,
        message: `${item_key} subió ${delta.toFixed(1)}% (${formatCurrency(latestBefore.price_cents, currency)} → ${formatCurrency(price_cents, currency)})`
      });
    }
    if (delta !== null && delta <= -threshold) {
      alerts.push({
        type: 'decrease',
        item_type,
        item_key,
        provider,
        currency,
        price_cents,
        change_percent: delta,
        message: `${item_key} bajó ${Math.abs(delta).toFixed(1)}% (${formatCurrency(latestBefore.price_cents, currency)} → ${formatCurrency(price_cents, currency)})`
      });
    }
  }

  if (minBefore && price_cents < minBefore.price_cents) {
    alerts.push({
      type: 'new_low',
      item_type,
      item_key,
      provider,
      currency,
      price_cents,
      message: `${item_key} marcó mínimo histórico: ${formatCurrency(price_cents, currency)}`
    });
  }

  return alerts;
}

function formatCurrency(centsValue, currency) {
  return `${(centsValue / 100).toFixed(2)} ${currency}`;
}

module.exports = {
  evaluatePrice
};

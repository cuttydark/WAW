const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

function isConfigured() {
  return !!(BOT_TOKEN && CHAT_ID);
}

async function sendMessage(text, opts = {}) {
  if (!isConfigured()) {
    console.warn('[telegram] No configurado (falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID)');
    return false;
  }

  try {
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: CHAT_ID,
      text,
      parse_mode: opts.parseMode || 'HTML',
      disable_web_page_preview: true
    });
    return true;
  } catch (err) {
    console.error(`[telegram] Error enviando mensaje: ${err.message}`);
    return false;
  }
}

function formatAlerts(allAlerts, items) {
  const lines = [];

  lines.push('<b>🔔 WAW Price Alerts</b>');
  lines.push('');

  const priceDrops = allAlerts.filter((a) => a.message.includes('bajó'));
  const newMins = allAlerts.filter((a) => a.message.includes('mínimo'));
  const priceUps = allAlerts.filter((a) => a.message.includes('subió'));

  if (priceDrops.length) {
    lines.push('<b>📉 Bajadas de precio:</b>');
    for (const alert of priceDrops) {
      const i = alert.item;
      lines.push(`  • <b>${i.item_type.toUpperCase()}</b> ${i.item_key}: ${alert.message}`);
    }
    lines.push('');
  }

  if (newMins.length) {
    lines.push('<b>⭐ Mínimos históricos:</b>');
    for (const alert of newMins) {
      const i = alert.item;
      lines.push(`  • <b>${i.item_type.toUpperCase()}</b> ${i.item_key}: ${alert.message}`);
    }
    lines.push('');
  }

  if (priceUps.length) {
    lines.push('<b>📈 Subidas de precio:</b>');
    for (const alert of priceUps) {
      const i = alert.item;
      lines.push(`  • <b>${i.item_type.toUpperCase()}</b> ${i.item_key}: ${alert.message}`);
    }
    lines.push('');
  }

  lines.push('<b>💰 Precios actuales:</b>');
  for (const item of items) {
    const emoji = item.item_type === 'flight' ? '✈️' : item.item_type === 'hotel' ? '🏨' : '🚗';
    lines.push(`  ${emoji} ${item.item_key}: <b>${item.price} ${item.currency}</b> (${item.provider})`);
  }

  return lines.join('\n');
}

async function notifyAlerts(allAlerts, items) {
  if (!isConfigured()) return;

  if (allAlerts.length === 0) {
    console.log('[telegram] Sin alertas, no se envía notificación.');
    return;
  }

  const text = formatAlerts(allAlerts, items);
  const sent = await sendMessage(text);
  if (sent) {
    console.log(`[telegram] Notificación enviada (${allAlerts.length} alertas)`);
  }
}

module.exports = {
  isConfigured,
  sendMessage,
  formatAlerts,
  notifyAlerts
};

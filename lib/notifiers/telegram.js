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

function eur(n) { return typeof n === 'number' ? n.toFixed(0) + '€' : '?€'; }

function formatPackages(packages, alerts) {
  const lines = [];
  lines.push('<b>✈️ Mejores viajes en agosto</b>');
  lines.push('');

  const byDest = {};
  for (const pkg of packages) {
    if (!byDest[pkg.dest]) byDest[pkg.dest] = [];
    byDest[pkg.dest].push(pkg);
  }

  for (const [dest, pkgs] of Object.entries(byDest)) {
    lines.push(`<b>� ${dest}</b>`);
    for (const pkg of pkgs) {
      const f = pkg.flight;
      const h = pkg.hotel;
      const c = pkg.car;
      lines.push(`  Desde <b>${pkg.origin}</b> → ${pkg.airport || '?'}`);
      lines.push(`  📅 ${pkg.dates}`);
      lines.push(`  ✈️ Vuelo: <b>${eur(f.price)}</b>`);
      lines.push(`  🏨 Hotel: <b>${eur(h.price)}</b>`);
      lines.push(`  🚗 Coche: <b>${c.price}$</b>`);
      if (pkg.total) lines.push(`  💰 <b>Total: ~${eur(pkg.total)}</b>`);
      lines.push('');
    }
  }

  if (alerts.length) {
    const drops = alerts.filter((a) => a.type === 'decrease');
    const mins = alerts.filter((a) => a.type === 'new_low');
    const ups = alerts.filter((a) => a.type === 'increase');

    lines.push('<b>🔔 Alertas</b>');
    for (const a of drops) {
      lines.push(`  � ${a.item.item_key}: ${Math.abs(a.change_percent).toFixed(0)}% más barato`);
    }
    for (const a of mins) {
      lines.push(`  ⭐ ${a.item.item_key}: mínimo histórico ${eur(a.price_cents / 100)}`);
    }
    for (const a of ups) {
      lines.push(`  📈 ${a.item.item_key}: +${a.change_percent.toFixed(0)}%`);
    }
  }

  return lines.join('\n');
}

async function notifyPackages(packages, alerts) {
  if (!isConfigured()) return;

  const text = formatPackages(packages, alerts);
  const sent = await sendMessage(text);
  if (sent) {
    console.log(`[telegram] Notificación enviada (${packages.length} paquetes, ${alerts.length} alertas)`);
  }
}

module.exports = {
  isConfigured,
  sendMessage,
  formatPackages,
  notifyPackages
};

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'travel_alerts.yml');

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const config = yaml.load(raw);
  if (!config || !config.alerts) {
    throw new Error('Invalid configuration: missing "alerts" root node');
  }
  return config;
}

module.exports = {
  loadConfig,
  CONFIG_PATH
};

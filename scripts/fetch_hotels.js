#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function loadConfig() {
  const configPath = path.join(__dirname, '..', 'config', 'travel_alerts.yml');
  return yaml.load(fs.readFileSync(configPath, 'utf8'));
}

(async () => {
  const { alerts } = loadConfig();
  console.log('TODO: fetch hotels for', alerts.hotels);
})();

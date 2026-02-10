#!/usr/bin/env node

const fs = require('fs');
const { DB_PATH } = require('../lib/db');

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log(`Removed ${DB_PATH}`);
} else {
  console.log('Database file did not exist.');
}

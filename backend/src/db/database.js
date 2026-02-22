const Datastore = require('nedb-promises');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = {
  suites: Datastore.create({ filename: path.join(DATA_DIR, 'suites.db'), autoload: true }),
  testCases: Datastore.create({ filename: path.join(DATA_DIR, 'testcases.db'), autoload: true }),
  runs: Datastore.create({ filename: path.join(DATA_DIR, 'runs.db'), autoload: true }),
  results: Datastore.create({ filename: path.join(DATA_DIR, 'results.db'), autoload: true }),
};

module.exports = db;

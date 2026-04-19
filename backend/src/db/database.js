const Datastore = require('nedb-promises');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '../../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = {
  projects: Datastore.create({ filename: path.join(DATA_DIR, 'projects.db'), autoload: true }),
  suites: Datastore.create({ filename: path.join(DATA_DIR, 'suites.db'), autoload: true }),
  testCases: Datastore.create({ filename: path.join(DATA_DIR, 'testcases.db'), autoload: true }),
  runs: Datastore.create({ filename: path.join(DATA_DIR, 'runs.db'), autoload: true }),
  results: Datastore.create({ filename: path.join(DATA_DIR, 'results.db'), autoload: true }),
  users: Datastore.create({ filename: path.join(DATA_DIR, 'users.db'), autoload: true }),
  uiCheckerHistory: Datastore.create({ filename: path.join(DATA_DIR, 'ui_checker_history.db'), autoload: true }),
  dataSets: Datastore.create({ filename: path.join(DATA_DIR, 'datasets.db'), autoload: true }),
  performanceHistory: Datastore.create({ filename: path.join(DATA_DIR, 'performance_history.db'), autoload: true }),
  loadTestHistory: Datastore.create({ filename: path.join(DATA_DIR, 'load_test_history.db'), autoload: true }),
};

// Seed admin account on startup
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@matbao.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function seedAdmin() {
  const existing = await db.users.findOne({ email: ADMIN_EMAIL });
  if (!existing) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.users.insert({
      email: ADMIN_EMAIL,
      password_hash: hash,
      role: 'ADMIN',
      created_at: new Date().toISOString()
    });
    console.log(`✅ Admin account seeded: ${ADMIN_EMAIL}`);
  }
}

seedAdmin().catch(err => console.error('Seed admin error:', err));

module.exports = db;

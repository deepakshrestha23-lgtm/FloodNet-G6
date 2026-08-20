const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function run() {
  if (!pool) {
    throw new Error('Database configuration is incomplete. Check the DB_* values in .env.');
  }

  const seedsDirectory = path.join(__dirname, 'seeds');
  const seedFiles = fs.readdirSync(seedsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of seedFiles) {
    const sql = fs.readFileSync(path.join(seedsDirectory, file), 'utf8');
    console.log(`Applying seed ${file}`);
    await pool.query(sql);
  }

  await pool.end();
  console.log('Seeds completed');
}

run().catch(async (error) => {
  console.error(error.message);
  if (pool) await pool.end();
  process.exitCode = 1;
});

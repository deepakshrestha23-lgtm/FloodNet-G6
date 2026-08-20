const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

/**
 * SQL seeds provide static reference data. JavaScript seeds exist for data that
 * cannot be expressed as literal SQL, such as bcrypt password hashes. SQL seeds
 * always run first so JavaScript seeds can rely on roles and zones existing.
 */
async function run() {
  if (!pool) {
    throw new Error('Database configuration is incomplete. Check the DB_* values in .env.');
  }

  const seedsDirectory = path.join(__dirname, 'seeds');
  const seedFiles = fs.readdirSync(seedsDirectory).sort();

  for (const file of seedFiles.filter((name) => name.endsWith('.sql'))) {
    const sql = fs.readFileSync(path.join(seedsDirectory, file), 'utf8');
    console.log(`Applying seed ${file}`);
    await pool.query(sql);
  }

  for (const file of seedFiles.filter((name) => name.endsWith('.js'))) {
    console.log(`Applying seed ${file}`);
    const seed = require(path.join(seedsDirectory, file));
    await seed(pool);
  }

  await pool.end();
  console.log('Seeds completed');
}

run().catch(async (error) => {
  console.error(error.message);
  if (pool) await pool.end();
  process.exitCode = 1;
});

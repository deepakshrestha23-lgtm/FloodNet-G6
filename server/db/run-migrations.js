const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function run() {
  if (!pool) {
    throw new Error('Database configuration is incomplete. Check the DB_* values in .env.');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDirectory = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const existing = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [file]
    );

    if (existing.rowCount > 0) {
      console.log(`Skipping migration ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDirectory, file), 'utf8');
    console.log(`Applying migration ${file}`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log('Migrations completed');
}

run().catch(async (error) => {
  console.error(error.message);
  if (pool) await pool.end();
  process.exitCode = 1;
});

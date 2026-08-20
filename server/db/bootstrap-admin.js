const readline = require('readline');
const { stdin, stdout } = require('process');
const { pool } = require('./pool');
const { hashPassword } = require('../utils/password');
const { insertAuditLog } = require('../utils/audit');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const confirmationText = 'CREATE FIRST ADMIN';

function promptLine(question) {
  return new Promise((resolve) => {
    const interfaceInstance = readline.createInterface({ input: stdin, output: stdout });
    interfaceInstance.question(question, (answer) => {
      interfaceInstance.close();
      resolve(answer.trim());
    });
  });
}

function promptHidden(question) {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('Administrator bootstrap must be run from an interactive terminal');
  }

  return new Promise((resolve, reject) => {
    let value = '';

    function finish(error) {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');

      if (error) reject(error);
      else resolve(value);
    }

    function onData(chunk) {
      const input = chunk.toString('utf8');

      for (const character of input) {
        if (character === '\u0003') {
          finish(new Error('Administrator bootstrap cancelled'));
          return;
        }

        if (character === '\r' || character === '\n') {
          finish();
          return;
        }

        if (character === '\u0008' || character === '\u007f') {
          value = value.slice(0, -1);
          continue;
        }

        value += character;
      }
    }

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

function validateInput({ email, password, firstName, lastName, confirmation }) {
  if (!emailPattern.test(email)) {
    throw new Error('Enter a valid administrator email address.');
  }

  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) {
    throw new Error('First name and last name are required and must be at most 100 characters.');
  }

  if (
    password.length < 8
    || password.length > 72
    || !/[A-Z]/.test(password)
    || !/[a-z]/.test(password)
    || !/[0-9]/.test(password)
  ) {
    throw new Error('Password must be 8-72 characters and contain uppercase, lowercase and numeric characters.');
  }

  if (confirmation !== confirmationText) {
    throw new Error(`Type exactly "${confirmationText}" to confirm the first administrator bootstrap.`);
  }
}

async function bootstrapAdministrator(input) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Serialize bootstrap attempts so two terminals cannot create the first
    // administrator at the same time.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('floodnet:first-admin-bootstrap'))");

    const existing = await client.query(
      `
        SELECT u.id, u.email, u.status
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE r.code = 'ADMINISTRATOR'
        LIMIT 1
      `
    );

    if (existing.rowCount > 0) {
      throw new Error(
        `An administrator already exists (${existing.rows[0].email}, ${existing.rows[0].status}). `
        + 'Use the Administrator panel instead of running bootstrap again.'
      );
    }

    const role = await client.query(
      "SELECT id FROM roles WHERE code = 'ADMINISTRATOR'"
    );

    if (role.rowCount === 0) {
      throw new Error('The ADMINISTRATOR role is missing. Run migrations and reference seeds first.');
    }

    const passwordHash = await hashPassword(input.password);
    const userResult = await client.query(
      `
        INSERT INTO users (role_id, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [role.rows[0].id, input.email, passwordHash]
    );

    const userId = userResult.rows[0].id;

    await client.query(
      `
        INSERT INTO user_profiles (user_id, first_name, last_name, phone)
        VALUES ($1, $2, $3, $4)
      `,
      [userId, input.firstName, input.lastName, input.phone || null]
    );

    await client.query(
      'INSERT INTO notification_preferences (user_id) VALUES ($1)',
      [userId]
    );

    await insertAuditLog(client, {
      actorId: null,
      action: 'ADMIN_BOOTSTRAPPED',
      entityType: 'USER',
      entityId: userId,
      metadata: { email: input.email }
    });

    await client.query('COMMIT');
    return userId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  if (!pool) {
    throw new Error('Database configuration is incomplete. Check the DB_* values.');
  }

  console.log('FloodNet first-administrator bootstrap');
  console.log('Run this only against the intended database. The command refuses to create a second administrator.');
  console.log('The password is entered invisibly and is never written to source code.');
  console.log('');

  const email = (await promptLine('Administrator email: ')).toLowerCase();
  const firstName = await promptLine('First name: ');
  const lastName = await promptLine('Last name: ');
  const phone = await promptLine('Phone (optional): ');
  const password = await promptHidden('Password: ');
  const confirmation = await promptLine(`Type ${confirmationText}: `);

  validateInput({ email, password, firstName, lastName, confirmation });

  const userId = await bootstrapAdministrator({
    email,
    firstName,
    lastName,
    phone,
    password
  });

  console.log(`Administrator created successfully. User ID: ${userId}`);
  console.log('Sign in through the application, then create staff accounts from the Administrator panel.');
}

run()
  .catch((error) => {
    console.error(`Bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (pool) await pool.end();
  });

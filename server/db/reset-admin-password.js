const readline = require('readline');
const { stdin, stdout } = require('process');
const { pool } = require('./pool');
const { hashPassword } = require('../utils/password');
const { insertAuditLog } = require('../utils/audit');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const confirmationText = 'RESET ADMIN PASSWORD';

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
    throw new Error('Administrator password recovery must be run from an interactive terminal');
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
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          finish(new Error('Administrator password recovery cancelled'));
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

function validatePassword(password) {
  if (
    password.length < 8
    || password.length > 72
    || !/[A-Z]/.test(password)
    || !/[a-z]/.test(password)
    || !/[0-9]/.test(password)
  ) {
    throw new Error('Password must be 8-72 characters and contain uppercase, lowercase and numeric characters.');
  }
}

async function resetAdministratorPassword(email, password) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('floodnet:admin-password-recovery'))");

    const existing = await client.query(
      `
        SELECT u.id, u.email
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE r.code = 'ADMINISTRATOR' AND LOWER(u.email) = LOWER($1)
        LIMIT 1
      `,
      [email]
    );

    if (existing.rowCount === 0) {
      throw new Error('No administrator exists with that email address.');
    }

    const user = existing.rows[0];
    const passwordHash = await hashPassword(password);
    const revoked = await client.query(
      `
        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL
        RETURNING id
      `,
      [user.id]
    );

    await client.query(
      `
        UPDATE users
        SET password_hash = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [user.id, passwordHash]
    );

    await insertAuditLog(client, {
      actorId: null,
      action: 'ADMIN_PASSWORD_RECOVERY',
      entityType: 'USER',
      entityId: user.id,
      metadata: { email: user.email, revokedSessions: revoked.rowCount }
    });

    await client.query('COMMIT');
    return user.id;
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

  console.log('FloodNet administrator password recovery');
  console.log('The password is entered invisibly and is never written to source code.');
  console.log('');

  const email = (await promptLine('Administrator email: ')).toLowerCase();
  if (!emailPattern.test(email)) throw new Error('Enter a valid administrator email address.');

  const password = await promptHidden('New password: ');
  validatePassword(password);

  const confirmation = await promptLine(`Type ${confirmationText}: `);
  if (confirmation !== confirmationText) {
    throw new Error(`Type exactly "${confirmationText}" to confirm password recovery.`);
  }

  const userId = await resetAdministratorPassword(email, password);
  console.log(`Administrator password reset successfully. User ID: ${userId}`);
}

run()
  .catch((error) => {
    console.error(`Password recovery failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (pool) await pool.end();
  });

import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// A DATE stays the text 'YYYY-MM-DD'. By default the driver turns it into a Date at local midnight
// of the server, which gives the previous day on a server east of UTC. Times (TIME) are already text.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
const transactionContext = new AsyncLocalStorage();
let pool;
let nextSavepoint = 0;

const getConnectionString = () => {
  if (!config.databaseUrl) {
    throw new Error(`${config.databaseUrlVariable} must be set to connect to PostgreSQL.`);
  }

  return config.databaseUrl;
};

const getPool = () => {
  if (!pool) {
    pool = new Pool({ connectionString: getConnectionString() });
    pool.on('error', (error) => {
      console.error('Unexpected error from an idle PostgreSQL client:', error);
    });
  }

  return pool;
};

const query = (sql, params = []) => {
  const transaction = transactionContext.getStore();
  const client = transaction?.client ?? getPool();
  return params.length > 0 ? client.query(sql, params) : client.query(sql);
};

export const get = async (sql, params = []) => {
  const result = await query(sql, params);
  return result.rows[0] ?? null;
};

export const all = async (sql, params = []) => {
  const result = await query(sql, params);
  return result.rows;
};

export const run = async (sql, params = []) => {
  const result = await query(sql, params);
  const finalResult = Array.isArray(result) ? result.at(-1) : result;
  return {
    rows: finalResult.rows ?? [],
    rowCount: finalResult.rowCount ?? finalResult.rows?.length ?? 0,
  };
};

const rollback = async (client, error, savepoint) => {
  try {
    if (savepoint) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    } else {
      await client.query('ROLLBACK');
    }
  } catch (rollbackError) {
    throw new AggregateError(
      [error, rollbackError],
      'The database operation failed and PostgreSQL could not roll it back.',
      { cause: rollbackError },
    );
  }
};

export const inTransaction = async (callback) => {
  const currentTransaction = transactionContext.getStore();

  if (currentTransaction) {
    const savepoint = `nested_${++nextSavepoint}`;
    await currentTransaction.client.query(`SAVEPOINT ${savepoint}`);
    try {
      const result = await callback();
      await currentTransaction.client.query(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      await rollback(currentTransaction.client, error, savepoint);
      throw error;
    }
  }

  const client = await getPool().connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const result = await transactionContext.run({ client }, callback);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (transactionStarted) {
      await rollback(client, error);
    }
    throw error;
  } finally {
    client.release();
  }
};

export const close = async () => {
  if (pool) {
    const currentPool = pool;
    pool = undefined;
    await currentPool.end();
  }
};

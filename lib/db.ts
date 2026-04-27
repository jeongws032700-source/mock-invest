import mysql from 'mysql2/promise';

const database = process.env.DB_NAME || 'mock_invest';

function connectionConfig(includeDatabase = true) {
  const base: mysql.ConnectionOptions = {
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ...(includeDatabase ? { database } : {}),
  };
  if (process.env.DB_SOCKET_PATH) {
    return { ...base, socketPath: process.env.DB_SOCKET_PATH };
  }
  return { ...base, host: process.env.DB_HOST || 'localhost' };
}

const pool = mysql.createPool({
  ...connectionConfig(),
  waitForConnections: true,
  connectionLimit: 10,
});

let schemaReady: Promise<void> | null = null;

function quoteIdentifier(value: string) {
  if (!/^[A-Za-z0-9_$]+$/.test(value)) {
    throw new Error(`Invalid database name: ${value}`);
  }
  return `\`${value}\``;
}

async function createSchema() {
  const connection = await mysql.createConnection({
    ...connectionConfig(false),
    multipleStatements: true,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(database)} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE ${quoteIdentifier(database)}`);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT NOT NULL AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        balance DECIMAL(18, 2) NOT NULL DEFAULT 10000000.00,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY users_email_unique (email)
      );

      CREATE TABLE IF NOT EXISTS holdings (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        coin_id VARCHAR(32) NOT NULL,
        coin_name VARCHAR(100) NOT NULL,
        amount DECIMAL(24, 8) NOT NULL DEFAULT 0,
        avg_price DECIMAL(18, 8) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY holdings_user_coin_unique (user_id, coin_id),
        CONSTRAINT holdings_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS trades (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        coin_id VARCHAR(32) NOT NULL,
        coin_name VARCHAR(100) NOT NULL,
        type ENUM('buy', 'sell') NOT NULL,
        amount DECIMAL(24, 8) NOT NULL,
        price DECIMAL(18, 8) NOT NULL,
        total DECIMAL(18, 2) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY trades_user_created_idx (user_id, created_at),
        CONSTRAINT trades_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } finally {
    await connection.end();
  }
}

export function ensureSchema() {
  schemaReady ??= createSchema();
  return schemaReady;
}

export default pool;

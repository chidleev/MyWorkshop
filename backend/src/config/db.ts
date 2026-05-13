import mysql, { type PoolOptions } from "mysql2/promise";
import { logStartup } from "../utils/logger";

interface DbLogInfo {
  source: "DB_URL" | "DATABASE_URL" | "DB_*";
  host?: string;
  port?: number;
  database?: string;
  connectTimeout: number;
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildDbConfig(): PoolOptions & { logInfo: DbLogInfo } {
  const databaseUrl = process.env.DB_URL ?? process.env.DATABASE_URL;
  const source = process.env.DB_URL ? "DB_URL" : "DATABASE_URL";
  const connectTimeout = numberFromEnv(process.env.DB_CONNECT_TIMEOUT_MS, 10000);

  if (databaseUrl) {
    const url = new URL(databaseUrl);
    const port = url.port ? Number(url.port) : 3306;
    const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    return {
      host: url.hostname,
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
      connectTimeout,
      logInfo: {
        source,
        host: url.hostname,
        port,
        database,
        connectTimeout,
      },
    };
  }

  const port = numberFromEnv(process.env.DB_PORT, 3306);
  return {
    host: process.env.DB_HOST,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout,
    logInfo: {
      source: "DB_*",
      host: process.env.DB_HOST,
      port,
      database: process.env.DB_NAME,
      connectTimeout,
    },
  };
}

const { logInfo, ...poolConfig } = buildDbConfig();

export const dbPool = mysql.createPool({
  ...poolConfig,
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function checkDbConnection(): Promise<void> {
  logStartup("database check started", logInfo);
  const conn = await dbPool.getConnection();
  try {
    await conn.query("SELECT 1");
    logStartup("database check completed");
  } finally {
    conn.release();
  }
}

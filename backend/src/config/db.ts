import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function checkDbConnection(): Promise<void> {
  const conn = await dbPool.getConnection();
  try {
    await conn.query("SELECT 1");
    console.log("MySQL connection established");
  } finally {
    conn.release();
  }
}

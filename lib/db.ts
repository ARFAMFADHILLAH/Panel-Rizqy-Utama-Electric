import "server-only";

import mysql, { type ExecuteValues } from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE ?? "rizqyutamaelectric",
  connectionLimit: 10,
  decimalNumbers: true,
});

export async function query<T>(sql: string, params: ExecuteValues = []): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

import "server-only";

import mysql, { type ExecuteValues } from "mysql2/promise";
import { Pool, types as pgTypes } from "pg";

// Postgres mengembalikan bigint (int8) sebagai string — paksa ke number supaya
// cocok dengan tipe `id`, `price`, dan `COUNT(...)` di lib/types.ts.
pgTypes.setTypeParser(20, (value) => parseInt(value, 10));

// Kolom numeric (mis. products.rating) juga dikembalikan sebagai string.
pgTypes.setTypeParser(1700, (value) => parseFloat(value));

/**
 * Supabase (Postgres) adalah database utama — sama dengan storefront.
 * MySQL tetap tersedia sebagai cadangan: aktif hanya bila SUPABASE_DB_URL
 * kosong di .env.local.
 */
const usePostgres = Boolean(process.env.SUPABASE_DB_URL);

let pgPool: Pool | undefined;
let mysqlPool: mysql.Pool | undefined;

function getPgPool(): Pool {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 15000,
    });
  }
  return pgPool;
}

function getMysqlPool(): mysql.Pool {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST ?? "127.0.0.1",
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER ?? "root",
      password: process.env.MYSQL_PASSWORD ?? "",
      database: process.env.MYSQL_DATABASE ?? "rizqyutamaelectric",
      connectionLimit: 10,
      decimalNumbers: true,
    });
  }
  return mysqlPool;
}

/** Postgres memakai $1, $2, ... — MySQL memakai ?. Kode halaman tetap `?`. */
function toPostgresSql(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/** mysql2 memakai prepared statement yang tidak menerima boolean — ubah ke 1/0. */
function toMysqlParams(params: ExecuteValues): ExecuteValues {
  if (!Array.isArray(params)) return params;
  return params.map((value) =>
    typeof value === "boolean" ? (value ? 1 : 0) : value,
  );
}

export async function query<T>(sql: string, params: ExecuteValues = []): Promise<T> {
  if (usePostgres) {
    const result = await getPgPool().query(toPostgresSql(sql), params as unknown[]);
    return result.rows as T;
  }

  const [rows] = await getMysqlPool().execute(sql, toMysqlParams(params));
  return rows as T;
}

/** Kode error yang berarti server database tidak bisa dihubungi. */
const UNAVAILABLE_CODES = new Set([
  // Jaringan (mysql2 maupun pg)
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "PROTOCOL_CONNECTION_LOST",
  "ER_CON_COUNT_ERROR",
  // Postgres connection exception / too many connections
  "08000",
  "08001",
  "08006",
  "57P01",
  "53300",
]);

/** Pesan koneksi pg memang tidak selalu membawa kode error. */
const UNAVAILABLE_MESSAGE_PATTERNS = [
  /timeout exceeded when trying to connect/i,
  /connection terminated/i,
  /connection ended/i,
];

export const DB_UNAVAILABLE_MESSAGE =
  "Database tidak tersedia. Pastikan server Supabase (atau MySQL) sedang bisa dihubungi.";

function errorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function errorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

/**
 * Membedakan "server-nya mati atau belum bisa dihubungi" dari kesalahan lain
 * seperti kredensial salah atau SQL bermasalah, supaya halaman bisa memberi
 * pesan yang tepat alih-al melempar stack trace ke pengguna.
 */
export function isDbUnavailable(error: unknown): boolean {
  if (UNAVAILABLE_CODES.has(errorCode(error))) return true;
  const message = errorMessage(error);
  return UNAVAILABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

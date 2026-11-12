import { createClient, type Client } from "@libsql/client";
import { randomBytes } from "crypto";
import { access, mkdir, readFile } from "fs/promises";
import path from "path";
import { Pool } from "pg";
import type { EmailStatus, InviteInput, ResponseInput, ReviewLink, StoreFile } from "./types";
import { configuredCc } from "./validators";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "reviews.db");

type SqlRow = Record<string, unknown>;

type Executor = {
  query(sql: string, args?: unknown[]): Promise<{ rows: SqlRow[]; rowsAffected: number }>;
};

let clientPromise: Promise<Executor> | null = null;

type PgGlobal = typeof globalThis & { __reviewsPgPool?: Pool };

function databaseUrl() {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  return url.startsWith("postgres://") || url.startsWith("postgresql://") ? url : "";
}

export function storageKind(): "local" | "postgres" {
  return databaseUrl() ? "postgres" : "local";
}

function toPostgres(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

async function db() {
  if (!clientPromise) {
    clientPromise = open().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

async function open(): Promise<Executor> {
  const url = databaseUrl();
  if (url) return openPostgres(url);
  if (process.env.VERCEL) {
    throw new Error(
      "This deployment has no database. Set DATABASE_URL to a Postgres connection string.",
    );
  }
  return openSqlite();
}

function postgresPool(url: string) {
  const cached = globalThis as PgGlobal;
  if (!cached.__reviewsPgPool) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    const disableSsl = /sslmode=disable/i.test(url);
    const connectionString = url
      .replace(/([?&])sslmode=[^&]*&?/i, "$1")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
    cached.__reviewsPgPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 20_000,
      ssl: local || disableSsl ? false : { rejectUnauthorized: false },
    });
  }
  return cached.__reviewsPgPool;
}

async function openPostgres(url: string): Promise<Executor> {
  const pool = postgresPool(url);
  const executor: Executor = {
    async query(statement, args = []) {
      const result = await pool.query(toPostgres(statement), args);
      return {
        rows: result.rows as SqlRow[],
        rowsAffected: result.rowCount ?? 0,
      };
    },
  };
  await ensureSchema(executor);
  await importJson(executor);
  await importSqliteFile(executor);
  return executor;
}

async function openSqlite(): Promise<Executor> {
  await mkdir(DATA_DIR, { recursive: true });
  const client = createClient({ url: `file:${FILE.replace(/\\/g, "/")}` });
  const executor = sqliteExecutor(client);
  await ensureSchema(executor);
  await importJson(executor);
  return executor;
}

function sqliteExecutor(client: Client): Executor {
  return {
    async query(statement, args = []) {
      const result = await client.execute({ sql: statement, args: args as never[] });
      return {
        rows: result.rows as unknown as SqlRow[],
        rowsAffected: Number(result.rowsAffected ?? 0),
      };
    },
  };
}

async function ensureSchema(executor: Executor) {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS links (
      token TEXT PRIMARY KEY,
      poc_name TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      service TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      designation TEXT,
      rating INTEGER,
      review TEXT,
      feedback TEXT,
      submitted_at TEXT,
      email_client TEXT,
      email_internal TEXT,
      email_detail TEXT
    )
  `);
  await executor.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await executor.query(`INSERT INTO settings (key, value) VALUES ('notify_emails', ?) ON CONFLICT(key) DO NOTHING`, [
    JSON.stringify(configuredCc()),
  ]);
}

async function importJson(executor: Executor) {
  try {
    const count = await executor.query("SELECT COUNT(*) AS n FROM links");
    if (Number(count.rows[0]?.n ?? 0) > 0) return;
    const raw = await readFile(path.join(DATA_DIR, "store.json"), "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!Array.isArray(parsed.links)) return;
    for (const link of parsed.links) await insertImported(executor, link);
    if (Array.isArray(parsed.notifyEmails) && parsed.notifyEmails.length > 0) {
      await executor.query(
        `INSERT INTO settings (key, value) VALUES ('notify_emails', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [JSON.stringify(parsed.notifyEmails)],
      );
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") console.info("[store] skipped JSON import");
  }
}

async function importSqliteFile(executor: Executor) {
  try {
    await access(FILE);
    const count = await executor.query("SELECT COUNT(*) AS n FROM links");
    if (Number(count.rows[0]?.n ?? 0) > 0) return;
    const local = createClient({ url: `file:${FILE.replace(/\\/g, "/")}` });
    const rows = await local.execute("SELECT * FROM links");
    for (const row of rows.rows) {
      await executor.query(
        `INSERT INTO links (
          token, poc_name, brand_name, service, email, created_at, status,
          designation, rating, review, feedback, submitted_at, email_client, email_internal, email_detail
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(token) DO NOTHING`,
        [
          row.token,
          row.poc_name,
          row.brand_name,
          row.service,
          row.email,
          row.created_at,
          row.status,
          row.designation,
          row.rating,
          row.review,
          row.feedback,
          row.submitted_at,
          row.email_client,
          row.email_internal,
          row.email_detail,
        ],
      );
    }
    local.close();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") console.info("[store] skipped local database import");
  }
}

async function insertImported(executor: Executor, link: StoreFile["links"][number]) {
  await executor.query(
    `INSERT INTO links (
      token, poc_name, brand_name, service, email, created_at, status,
      designation, rating, review, feedback, submitted_at, email_client, email_internal, email_detail
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(token) DO NOTHING`,
    [
      link.token,
      link.pocName,
      link.brandName,
      link.service,
      link.email,
      link.createdAt,
      link.status,
      link.response?.designation ?? null,
      link.response?.rating ?? null,
      link.response?.review ?? null,
      link.response?.feedback ?? null,
      link.response?.submittedAt ?? null,
      link.response?.emailStatus.client ?? null,
      link.response?.emailStatus.internal ?? null,
      link.response?.emailStatus.detail ?? null,
    ],
  );
}

function cell(row: SqlRow, key: string) {
  const value = row[key];
  return value == null ? "" : String(value);
}

function toLink(row: SqlRow): ReviewLink {
  const status = cell(row, "status") === "submitted" ? "submitted" : "pending";
  const link: ReviewLink = {
    token: cell(row, "token"),
    pocName: cell(row, "poc_name"),
    brandName: cell(row, "brand_name"),
    service: cell(row, "service"),
    email: cell(row, "email"),
    createdAt: cell(row, "created_at"),
    status,
  };
  if (status === "submitted" && cell(row, "submitted_at")) {
    const client = cell(row, "email_client");
    const internal = cell(row, "email_internal");
    link.response = {
      designation: cell(row, "designation"),
      rating: Number(row.rating ?? 0),
      review: cell(row, "review"),
      feedback: cell(row, "feedback"),
      submittedAt: cell(row, "submitted_at"),
      emailStatus: {
        client: client === "sent" || client === "failed" ? client : "skipped",
        internal: internal === "sent" || internal === "failed" ? internal : "skipped",
        detail: cell(row, "email_detail") || undefined,
      },
    };
  }
  return link;
}

async function readNotify(executor: Executor) {
  const result = await executor.query("SELECT value FROM settings WHERE key = 'notify_emails'");
  const raw = result.rows[0] ? cell(result.rows[0], "value") : "[]";
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function readLinks(executor: Executor) {
  const result = await executor.query("SELECT * FROM links ORDER BY created_at DESC");
  return result.rows.map(toLink);
}

function makeToken() {
  return randomBytes(12).toString("base64url");
}

export async function getStore() {
  const executor = await db();
  return {
    links: await readLinks(executor),
    notifyEmails: await readNotify(executor),
  };
}

export async function getLink(token: string) {
  if (!/^[A-Za-z0-9_-]{12,32}$/.test(token)) return null;
  const executor = await db();
  const result = await executor.query("SELECT * FROM links WHERE token = ?", [token]);
  return result.rows[0] ? toLink(result.rows[0]) : null;
}

export async function createLink(input: InviteInput) {
  const executor = await db();
  let token = makeToken();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await executor.query("SELECT token FROM links WHERE token = ?", [token]);
    if (existing.rows.length === 0) break;
    token = makeToken();
  }
  const link: ReviewLink = {
    token,
    pocName: input.pocName,
    brandName: input.brandName,
    service: input.service,
    email: input.email.toLowerCase(),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await executor.query(
    `INSERT INTO links (token, poc_name, brand_name, service, email, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [link.token, link.pocName, link.brandName, link.service, link.email, link.createdAt],
  );
  return link;
}

export async function submitLink(token: string, input: ResponseInput) {
  const executor = await db();
  const submittedAt = new Date().toISOString();
  const updated = await executor.query(
    `UPDATE links SET
       status = 'submitted',
       designation = ?,
       rating = ?,
       review = ?,
       feedback = ?,
       submitted_at = ?,
       email_client = 'skipped',
       email_internal = 'skipped',
       email_detail = NULL
     WHERE token = ? AND status = 'pending'`,
    [input.designation, input.rating, input.review, input.feedback, submittedAt, token],
  );
  const link = await getLink(token);
  if (!link) return { ok: false as const, status: 404, error: "This link is not active." };
  if (updated.rowsAffected === 0) {
    return { ok: false as const, status: 409, error: "This link has expired.", link };
  }
  return { ok: true as const, link };
}

export async function setEmailStatus(token: string, emailStatus: EmailStatus) {
  const executor = await db();
  await executor.query(
    `UPDATE links SET email_client = ?, email_internal = ?, email_detail = ? WHERE token = ? AND status = 'submitted'`,
    [emailStatus.client, emailStatus.internal, emailStatus.detail ?? null, token],
  );
  return getLink(token);
}

export async function deleteLink(token: string) {
  const executor = await db();
  const existing = await getLink(token);
  if (!existing) return { ok: false as const, status: 404, error: "This record is no longer on the desk." };
  await executor.query("DELETE FROM links WHERE token = ?", [token]);
  return { ok: true as const };
}

export async function setNotifyEmails(emails: string[]) {
  const executor = await db();
  await executor.query(
    `INSERT INTO settings (key, value) VALUES ('notify_emails', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify(emails)],
  );
  return emails;
}

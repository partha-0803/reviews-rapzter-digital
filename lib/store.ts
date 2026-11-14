import { createClient, type Client } from "@libsql/client";
import { createHash, randomBytes } from "crypto";
import { access, mkdir, readFile } from "fs/promises";
import path from "path";
import { Pool } from "pg";
import { ADMIN_EMAIL, INITIAL_PASSWORD, hashPassword, passwordError, verifyPassword } from "./passwords";
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

export const SESSION_IDLE_MS = 30 * 60 * 1000;

function bareConnectionString(url: string) {
  return url
    .replace(/([?&])sslmode=[^&]*&?/i, "$1")
    .replace(/([?&])ssl=[^&]*&?/i, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");
}

function sslFor(url: string): false | { rejectUnauthorized: false } {
  const mode = /(?:^|[?&])sslmode=([^&]*)/i.exec(url)?.[1]?.toLowerCase() ?? "";
  if (mode === "disable") return false;
  const local = /@(?:localhost|127\.0\.0\.1)(?::|\/|\?|$)/i.test(url);
  if (local && !mode) return false;
  // Encrypt the session. Do not verify the certificate: Coolify's same-server
  // certificate is signed by its own CA, and `require` is the matching mode.
  return { rejectUnauthorized: false };
}

async function openPostgres(url: string): Promise<Executor> {
  const cached = globalThis as PgGlobal;
  if (!cached.__reviewsPgPool) {
    cached.__reviewsPgPool = new Pool({
      connectionString: bareConnectionString(url),
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 20_000,
      ssl: sslFor(url),
    });
  }
  const pool = cached.__reviewsPgPool;
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
  await executor.query(`
    CREATE TABLE IF NOT EXISTS admins (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      must_reset INTEGER NOT NULL DEFAULT 1,
      reset_token_hash TEXT,
      reset_expires TEXT
    )
  `);
  await executor.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);
  await ensureAdmin(executor);
}

async function ensureAdmin(executor: Executor) {
  const existing = await executor.query("SELECT email FROM admins WHERE email = ?", [ADMIN_EMAIL]);
  if (existing.rows[0]) return;
  await executor.query(
    `INSERT INTO admins (email, password_hash, must_reset) VALUES (?, ?, 1)
     ON CONFLICT(email) DO NOTHING`,
    [ADMIN_EMAIL, await hashPassword(INITIAL_PASSWORD)],
  );
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

let dummyHash: Promise<string> | null = null;

export async function authenticateAdmin(email: string, password: string) {
  const executor = await db();
  const result = await executor.query("SELECT email, password_hash, must_reset FROM admins WHERE email = ?", [
    email.toLowerCase(),
  ]);
  const row = result.rows[0];
  if (!row) {
    if (!dummyHash) dummyHash = hashPassword("not-the-admin-password");
    await verifyPassword(password, await dummyHash);
    return null;
  }
  const ok = await verifyPassword(password, String(row.password_hash));
  if (!ok) return null;
  return { email: String(row.email), mustReset: Number(row.must_reset) === 1 };
}

export async function issuePasswordReset(email: string) {
  if (email.toLowerCase() !== ADMIN_EMAIL) return null;
  const executor = await db();
  const existing = await executor.query("SELECT email FROM admins WHERE email = ?", [ADMIN_EMAIL]);
  if (!existing.rows[0]) return null;
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await executor.query("UPDATE admins SET reset_token_hash = ?, reset_expires = ? WHERE email = ?", [
    sha256(token),
    expires,
    ADMIN_EMAIL,
  ]);
  return token;
}

export async function completePasswordReset(token: string, password: string) {
  const problem = passwordError(password);
  if (problem) return { ok: false as const, error: problem };
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return { ok: false as const, error: "This reset link is not valid." };
  }
  const executor = await db();
  const result = await executor.query(
    "SELECT email, password_hash, reset_expires FROM admins WHERE reset_token_hash = ?",
    [sha256(token)],
  );
  const row = result.rows[0];
  if (!row || String(row.reset_expires ?? "") <= new Date().toISOString()) {
    return { ok: false as const, error: "This reset link has expired. Request a new one." };
  }
  if (await verifyPassword(password, String(row.password_hash))) {
    return { ok: false as const, error: "Choose a different password than the one you use now." };
  }
  const email = String(row.email);
  await executor.query(
    "UPDATE admins SET password_hash = ?, must_reset = 0, reset_token_hash = NULL, reset_expires = NULL WHERE email = ?",
    [await hashPassword(password), email],
  );
  await executor.query("DELETE FROM sessions WHERE email = ?", [email]);
  return { ok: true as const, email };
}

export async function createSession(email: string) {
  const executor = await db();
  const now = new Date().toISOString();
  await executor.query("DELETE FROM sessions WHERE email = ? OR expires_at <= ?", [email, now]);
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_IDLE_MS).toISOString();
  await executor.query("INSERT INTO sessions (token_hash, email, expires_at) VALUES (?, ?, ?)", [
    sha256(token),
    email,
    expires,
  ]);
  return token;
}

export async function adminForSession(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const executor = await db();
  const hash = sha256(token);
  const result = await executor.query("SELECT email, expires_at FROM sessions WHERE token_hash = ?", [hash]);
  const row = result.rows[0];
  if (!row) return null;
  if (String(row.expires_at) <= new Date().toISOString()) {
    await executor.query("DELETE FROM sessions WHERE token_hash = ?", [hash]);
    return null;
  }
  const expires = new Date(Date.now() + SESSION_IDLE_MS).toISOString();
  await executor.query("UPDATE sessions SET expires_at = ? WHERE token_hash = ?", [expires, hash]);
  return String(row.email);
}

export async function deleteSession(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  const executor = await db();
  await executor.query("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
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

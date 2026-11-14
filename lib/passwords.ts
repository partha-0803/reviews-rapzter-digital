import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "parthiban.s@rapzterdigital.com").trim().toLowerCase();

export const INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || "RapzterReview#2026";

export function passwordError(password: string) {
  if (password.length < 10 || password.length > 72) return "Use 10 to 72 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include a letter and a number.";
  return "";
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = (await scrypt(password, salt, 32)) as Buffer;
  return `scrypt$${salt}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const key = (await scrypt(password, salt, 32)) as Buffer;
  const actual = Buffer.from(expected, "base64url");
  if (key.length !== actual.length) return false;
  return timingSafeEqual(key, actual);
}

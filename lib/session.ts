import { cookies } from "next/headers";
import { json } from "./http";
import { adminForSession, createSession, deleteSession } from "./store";

const COOKIE = "rd_session";
const MAX_AGE = 60 * 60 * 12;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function currentAdmin() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? "";
  if (!token) return null;
  return adminForSession(token);
}

export async function startSession(email: string) {
  const token = await createSession(email);
  const jar = await cookies();
  jar.set(COOKIE, token, cookieOptions(MAX_AGE));
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? "";
  if (token) await deleteSession(token);
  jar.set(COOKIE, "", cookieOptions(0));
}

export async function requireAdmin() {
  const email = await currentAdmin();
  if (!email) return json({ error: "Sign in to use the desk." }, 401);
  return null;
}

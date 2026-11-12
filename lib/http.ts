import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Something went wrong.";
  if (/postgres(?:ql)?:\/\//i.test(error.message) || /password authentication failed/i.test(error.message)) {
    return "Could not reach the database. Check DATABASE_URL.";
  }
  return error.message;
}

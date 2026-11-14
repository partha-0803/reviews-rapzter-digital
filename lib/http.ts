import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Something went wrong.";
  if (/postgres(?:ql)?:\/\/|password authentication failed|does not support ssl|ECONNREFUSED|ENOTFOUND|relation |syntax error/i.test(error.message)) {
    return "Could not reach the database. Check DATABASE_URL.";
  }
  return error.message;
}

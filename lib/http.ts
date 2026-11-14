import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Something went wrong.";
  if (/self-signed certificate|unable to verify the first certificate|certificate/i.test(error.message)) {
    return "The database certificate could not be verified. Turn on SSL with a trusted certificate.";
  }
  if (/does not support ssl/i.test(error.message)) {
    return "The database refused the secure connection. Turn on SSL for this server.";
  }
  if (/postgres(?:ql)?:\/\/|password authentication failed|ECONNREFUSED|ENOTFOUND|relation |syntax error/i.test(error.message)) {
    return "Could not reach the database. Check DATABASE_URL.";
  }
  return error.message;
}

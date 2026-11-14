import { errorMessage, json } from "@/lib/http";
import { allow, clientIp } from "@/lib/rate-limit";
import { startSession } from "@/lib/session";
import { completePasswordReset } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!allow(`reset:${clientIp(request)}`, 10, 15 * 60 * 1000)) {
      return json({ error: "Too many attempts. Wait a few minutes and try again." }, 429);
    }
    const body: unknown = await request.json();
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const token = typeof record.token === "string" ? record.token : "";
    const password = typeof record.password === "string" ? record.password : "";
    const result = await completePasswordReset(token, password);
    if (!result.ok) return json({ error: result.error }, 400);
    await startSession(result.email);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid request." }, 400);
    return json({ error: errorMessage(error) }, 500);
  }
}

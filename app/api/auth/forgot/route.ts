import { errorMessage, json } from "@/lib/http";
import { ADMIN_EMAIL } from "@/lib/passwords";
import { sendAdminReset } from "@/lib/mail";
import { allow, clientIp } from "@/lib/rate-limit";
import { publicOrigin } from "@/lib/share";
import { issuePasswordReset } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!allow(`forgot:${clientIp(request)}`, 5, 15 * 60 * 1000)) {
      return json({ error: "Too many attempts. Wait a few minutes and try again." }, 429);
    }
    const body: unknown = await request.json();
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
    if (email === ADMIN_EMAIL) {
      const token = await issuePasswordReset(email);
      if (token) {
        const link = `${publicOrigin(request)}/reset-password?token=${encodeURIComponent(token)}`;
        await sendAdminReset(email, link);
      }
    }
    return json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid request." }, 400);
    const message = errorMessage(error);
    if (/database/i.test(message)) return json({ error: message }, 500);
    if (/not configured|did not send|Graph|Azure/i.test(message)) {
      return json({ error: "The reset email did not send. Check Microsoft Graph, then try again." }, 502);
    }
    return json({ error: "Could not send the reset email." }, 500);
  }
}

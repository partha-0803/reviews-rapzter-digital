import { errorMessage, json } from "@/lib/http";
import { sendAdminReset } from "@/lib/mail";
import { allow, clientIp } from "@/lib/rate-limit";
import { publicOrigin } from "@/lib/share";
import { startSession } from "@/lib/session";
import { authenticateAdmin, issuePasswordReset } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!allow(`login:${clientIp(request)}`, 8, 15 * 60 * 1000)) {
      return json({ error: "Too many attempts. Wait a few minutes and try again." }, 429);
    }
    const body: unknown = await request.json();
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
    const password = typeof record.password === "string" ? record.password : "";
    const admin = await authenticateAdmin(email, password);
    if (!admin) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return json({ error: "Those details do not match." }, 401);
    }
    if (admin.mustReset) {
      const token = await issuePasswordReset(admin.email);
      if (!token) return json({ error: "Could not start the password reset." }, 500);
      const link = `${publicOrigin(request)}/reset-password?token=${encodeURIComponent(token)}`;
      await sendAdminReset(admin.email, link);
      return json({ mustReset: true });
    }
    await startSession(admin.email);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid request." }, 400);
    const message = errorMessage(error);
    if (/database/i.test(message)) return json({ error: message }, 500);
    if (/not configured|did not send|Graph|Azure/i.test(message)) {
      return json(
        { error: "The temporary sign-in worked, but the reset email did not send. Check Microsoft Graph, then try again." },
        502,
      );
    }
    return json({ error: "Could not sign in." }, 500);
  }
}

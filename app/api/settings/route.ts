import { errorMessage, json } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { setNotifyEmails } from "@/lib/store";
import { validateEmailList } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;
    const body: unknown = await request.json();
    const parsed = validateEmailList(body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const notifyEmails = await setNotifyEmails(parsed.value);
    return json({ notifyEmails });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid request." }, 400);
    return json({ error: errorMessage(error) }, 500);
  }
}

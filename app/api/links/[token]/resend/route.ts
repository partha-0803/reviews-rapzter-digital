import { deliver } from "@/lib/mail";
import { errorMessage, json } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { getLink, getStore, setEmailStatus } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;
    const { token } = await context.params;
    const link = await getLink(token);
    if (!link?.response) return json({ error: "No submitted review on this link." }, 404);
    const store = await getStore();
    const emailStatus = await deliver(link, store.notifyEmails);
    const updated = await setEmailStatus(token, emailStatus);
    return json({ link: updated ?? link });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}

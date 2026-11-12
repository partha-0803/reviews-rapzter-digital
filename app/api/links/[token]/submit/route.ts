import { deliver } from "@/lib/mail";
import { errorMessage, json } from "@/lib/http";
import { getStore, setEmailStatus, submitLink } from "@/lib/store";
import { validateResponse } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const body: unknown = await request.json();
    const parsed = validateResponse(body);
    if (!parsed.ok) return json({ error: parsed.error, errors: parsed.errors }, 400);

    const saved = await submitLink(token, parsed.value);
    if (!saved.ok) return json({ error: saved.error, link: "link" in saved ? saved.link : undefined }, saved.status);

    const store = await getStore();
    const emailStatus = await deliver(saved.link, store.notifyEmails);
    const updated = await setEmailStatus(token, emailStatus);
    console.info(`[review] ${saved.link.brandName} client=${emailStatus.client} internal=${emailStatus.internal}`);
    return json({ link: updated ?? saved.link });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid request." }, 400);
    return json({ error: errorMessage(error) }, 500);
  }
}

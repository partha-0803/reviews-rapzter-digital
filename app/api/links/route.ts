import { isMailConfigured } from "@/lib/mail";
import { errorMessage, json } from "@/lib/http";
import { createLink, getStore, storageKind } from "@/lib/store";
import { configuredCc, validateInvite } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = await getStore();
    return json({
      links: store.links,
      notifyEmails: store.notifyEmails,
      ccEmails: configuredCc(),
      mailConfigured: isMailConfigured(),
      storage: storageKind(),
    });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = validateInvite(body);
    if (!parsed.ok) return json({ error: parsed.error, errors: parsed.errors }, 400);
    const link = await createLink(parsed.value);
    return json({ link }, 201);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid request." }, 400);
    return json({ error: errorMessage(error) }, 500);
  }
}

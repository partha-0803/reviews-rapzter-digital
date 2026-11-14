import { errorMessage, json } from "@/lib/http";
import { requireAdmin } from "@/lib/session";
import { deleteLink } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;
    const { token } = await context.params;
    const result = await deleteLink(token);
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ ok: true });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}

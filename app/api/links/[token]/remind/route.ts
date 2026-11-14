import { errorMessage, json } from "@/lib/http";
import { isMailConfigured, sendReviewReminder } from "@/lib/mail";
import { publicOrigin } from "@/lib/share";
import { requireAdmin } from "@/lib/session";
import { claimReminder, getLink, releaseReminder } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const denied = await requireAdmin();
    if (denied) return denied;
    if (!isMailConfigured()) return json({ error: "Microsoft Graph is not configured." }, 503);
    const { token } = await context.params;
    const claimed = await claimReminder(token);
    if (!claimed.ok) {
      const link = "link" in claimed ? claimed.link : null;
      return json({ error: claimed.error, link }, claimed.status);
    }
    const url = `${publicOrigin(request)}/r/${claimed.link.token}`;
    try {
      await sendReviewReminder(claimed.link, url);
    } catch (error) {
      await releaseReminder(token, claimed.link.lastReminderAt ?? "", claimed.previous);
      const link = await getLink(token);
      return json({ error: errorMessage(error), link }, 502);
    }
    const link = await getLink(token);
    return json({ link: link ?? claimed.link });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}

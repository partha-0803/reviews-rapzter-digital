export const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function reminderWait(lastReminderAt: string | undefined, now = Date.now()) {
  if (!lastReminderAt) return null;
  const sent = new Date(lastReminderAt).getTime();
  if (Number.isNaN(sent)) return null;
  const until = sent + REMINDER_COOLDOWN_MS;
  return until > now ? until : null;
}

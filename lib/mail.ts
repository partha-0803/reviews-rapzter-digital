import { formatWhen, starGlyphs } from "./format";
import type { EmailStatus, ReviewLink } from "./types";
import { configuredCc, emailList } from "./validators";

type GraphMessage = {
  subject: string;
  html: string;
  to: string[];
  cc?: string[];
  replyTo?: string;
};

export function isMailConfigured() {
  return Boolean(
    process.env.AZURE_TENANT_ID &&
      process.env.AZURE_CLIENT_ID &&
      process.env.AZURE_CLIENT_SECRET &&
      process.env.GRAPH_SENDER_EMAIL,
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function asHtml(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function shell(heading: string, body: string) {
  return `<div style="margin:0;padding:24px;background:#eef3f0;font-family:Arial,Helvetica,sans-serif;color:#14211b;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;">
      <div style="height:8px;background:#123226;"></div>
      <div style="padding:28px 28px 32px;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#1f8f5f;">Rapzter Digital</p>
        <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#102018;">${heading}</h1>
        ${body}
        <p style="margin:28px 0 0;font-size:13px;color:#5d6b64;">Enabling Business</p>
      </div>
    </div>
  </div>`;
}

function clientMessage(link: ReviewLink): GraphMessage {
  const response = link.response!;
  return {
    subject: `We've received your review — ${link.brandName}`,
    to: [link.email],
    html: shell(
      `Thank you, ${escapeHtml(link.pocName)}.`,
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Your review of ${escapeHtml(link.service)} for ${escapeHtml(link.brandName)} is with the team.</p>
       <p style="margin:0 0 12px;color:#1f8f5f;letter-spacing:0.08em;">${starGlyphs(response.rating)}</p>
       <blockquote style="margin:0;padding:0 0 0 14px;border-left:3px solid #1f8f5f;font-size:16px;line-height:1.5;">${asHtml(response.review)}</blockquote>`,
    ),
  };
}

function teamMessage(link: ReviewLink, to: string[]): GraphMessage {
  const response = link.response!;
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#5d6b64;vertical-align:top;">${label}</td><td style="padding:6px 0;">${value}</td></tr>`;
  return {
    subject: `New review from ${link.brandName} — ${link.pocName}`,
    to,
    replyTo: link.email,
    html: shell(
      escapeHtml(link.brandName),
      `<p style="margin:0 0 16px;font-size:16px;">${escapeHtml(link.pocName)} submitted a review.</p>
       <p style="margin:0 0 12px;font-size:13px;color:#5d6b64;">Submitted ${escapeHtml(formatWhen(response.submittedAt))}</p>
       <table style="border-collapse:collapse;font-size:14px;line-height:1.45;">
         ${row("Service", escapeHtml(link.service))}
         ${row("Designation", escapeHtml(response.designation))}
         ${row("Email", escapeHtml(link.email))}
         ${row("Rating", `${starGlyphs(response.rating)} ${response.rating}/5`)}
       </table>
       <p style="margin:18px 0 6px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#1f8f5f;">Review</p>
       <p style="margin:0;font-size:16px;line-height:1.5;">${asHtml(response.review)}</p>
       <p style="margin:18px 0 6px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#1f8f5f;">Feedback</p>
       <p style="margin:0;font-size:16px;line-height:1.5;">${asHtml(response.feedback)}</p>`,
    ),
  };
}

let tokenCache: { value: string; expiresAt: number } | null = null;

async function graphToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const body = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID ?? "",
    client_secret: process.env.AZURE_CLIENT_SECRET ?? "",
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15000),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Azure refused the mail sign-in.");
  }
  tokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  return payload.access_token;
}

async function sendGraph(message: GraphMessage, token: string) {
  const sender = process.env.GRAPH_SENDER_EMAIL ?? "";
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        message: {
          subject: message.subject,
          body: { contentType: "HTML", content: message.html },
          toRecipients: message.to.map((address) => ({ emailAddress: { address } })),
          ccRecipients: (message.cc ?? []).map((address) => ({ emailAddress: { address } })),
          replyTo: message.replyTo ? [{ emailAddress: { address: message.replyTo } }] : undefined,
        },
        saveToSentItems: true,
      }),
    },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(payload.error?.message || "Microsoft Graph did not send the message.");
  }
}

function failureDetail(error: unknown) {
  const message = error instanceof Error ? error.message : "The message could not be sent.";
  return message.replace(/\s+/g, " ").slice(0, 180);
}

export function teamRecipients(extra: string[]) {
  return emailList([...configuredCc(), ...extra].join(","));
}

export async function sendAdminReset(email: string, link: string) {
  if (!isMailConfigured()) throw new Error("Microsoft Graph is not configured.");
  const token = await graphToken();
  await sendGraph(
    {
      subject: "Reset your Rapzter review desk password",
      to: [email],
      html: shell(
        "Choose a new password",
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">The temporary desk password needs to be replaced. This link expires in 30 minutes.</p>
         <p style="margin:0 0 20px;"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#123226;color:#ffffff;text-decoration:none;">Choose a new password</a></p>
         <p style="margin:0;font-size:13px;line-height:1.5;color:#5d6b64;">If you did not ask for this, you can ignore the email. The link only works once.</p>`,
      ),
    },
    token,
  );
}

export async function deliver(link: ReviewLink, notifyEmails: string[]): Promise<EmailStatus> {
  if (!link.response) return { client: "failed", internal: "failed", detail: "Nothing to send." };
  if (!isMailConfigured()) {
    return { client: "skipped", internal: "skipped", detail: "Microsoft Graph is not configured" };
  }

  const errors: string[] = [];
  let client: EmailStatus["client"] = "failed";
  let internal: EmailStatus["internal"] = "skipped";
  try {
    const token = await graphToken();
    try {
      await sendGraph(clientMessage(link), token);
      client = "sent";
    } catch (error) {
      errors.push(failureDetail(error));
    }

    const internalTo = teamRecipients(notifyEmails).filter((email) => email !== link.email.toLowerCase());
    if (internalTo.length > 0) {
      try {
        await sendGraph(teamMessage(link, internalTo), token);
        internal = "sent";
      } catch (error) {
        internal = "failed";
        errors.push(failureDetail(error));
      }
    }
  } catch (error) {
    return { client: "failed", internal: "failed", detail: failureDetail(error) };
  }

  return { client, internal, detail: errors.join(" ") || undefined };
}

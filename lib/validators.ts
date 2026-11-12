import type { InviteInput, ResponseInput } from "./types";

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SERVICES = [
  "Paid Marketing",
  "SEO",
  "Social Media Marketing",
  "Marketing Automation",
  "Content Marketing",
  "Website Development & Maintenance",
] as const;

export const NO_FEEDBACK = "No feedback yet";

export const LIMITS = {
  pocName: 80,
  brandName: 80,
  service: 160,
  email: 120,
  designation: 80,
  review: 2000,
  feedback: 2000,
} as const;

export type InviteErrors = Partial<Record<keyof InviteInput, string>>;
export type ResponseErrors = Partial<Record<"designation" | "rating" | "review" | "feedback", string>>;

function cleanLine(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function cleanBlock(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function emailList(raw: string | undefined) {
  return (raw ?? "")
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item, index, all) => EMAIL.test(item) && all.indexOf(item) === index);
}

export function configuredCc() {
  return emailList(process.env.EMAIL_CC);
}

export function validateInvite(
  input: unknown,
): { ok: true; value: InviteInput } | { ok: false; error: string; errors: InviteErrors } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid request.", errors: {} };
  }
  const body = input as Record<string, unknown>;
  const pocName = cleanLine(body.pocName);
  const brandName = cleanLine(body.brandName);
  const service = cleanLine(body.service);
  const email = cleanLine(body.email).toLowerCase();
  const errors: InviteErrors = {};

  if (!pocName) errors.pocName = "Enter the point of contact.";
  else if (pocName.length > LIMITS.pocName) errors.pocName = "That name is too long.";

  if (!brandName) errors.brandName = "Enter the brand name.";
  else if (brandName.length > LIMITS.brandName) errors.brandName = "That brand name is too long.";

  if (!service) errors.service = "Select the service provided.";
  else if (!(SERVICES as readonly string[]).includes(service)) errors.service = "Select a service from the list.";

  if (!email || !EMAIL.test(email) || email.length > LIMITS.email) {
    errors.email = "Enter a valid email address.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Complete the invite details.", errors };
  }
  return { ok: true, value: { pocName, brandName, service, email } };
}

export function validateResponse(
  input: unknown,
): { ok: true; value: ResponseInput } | { ok: false; error: string; errors: ResponseErrors } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid request.", errors: {} };
  }
  const body = input as Record<string, unknown>;
  const designation = cleanLine(body.designation);
  const review = cleanBlock(body.review);
  const noFeedback = body.noFeedback === true;
  const feedback = noFeedback ? NO_FEEDBACK : cleanBlock(body.feedback);
  const rating = typeof body.rating === "number" ? body.rating : Number(body.rating);
  const errors: ResponseErrors = {};

  if (designation.length < 2) errors.designation = "Enter the designation.";
  else if (designation.length > LIMITS.designation) errors.designation = "That designation is too long.";

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = "Select a star rating.";

  if (review.length < 10) errors.review = "Write a short review.";
  else if (review.length > LIMITS.review) errors.review = "Keep the review under 2000 characters.";

  if (!noFeedback && feedback.length < 8) errors.feedback = "Add your feedback.";
  else if (feedback.length > LIMITS.feedback) errors.feedback = "Keep the feedback under 2000 characters.";

  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Complete the required fields.", errors };
  }
  return { ok: true, value: { designation, rating, review, feedback } };
}

export function validateEmailList(
  input: unknown,
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid request." };
  const list = (input as { notifyEmails?: unknown }).notifyEmails;
  if (!Array.isArray(list)) return { ok: false, error: "Add email addresses as a list." };
  if (list.length > 30) return { ok: false, error: "Keep the list to 30 addresses." };

  const emails: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") return { ok: false, error: "One of the recipient addresses is invalid." };
    const email = item.trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > LIMITS.email) {
      return { ok: false, error: "One of the recipient addresses is invalid." };
    }
    if (!emails.includes(email)) emails.push(email);
  }
  return { ok: true, value: emails };
}

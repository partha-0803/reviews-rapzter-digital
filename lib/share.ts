import type { ReviewLink } from "./types";

export function reviewUrl(token: string) {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (configured) return `${configured}/r/${token}`;
  if (typeof window !== "undefined") return `${window.location.origin}/r/${token}`;
  return `/r/${token}`;
}

export function isPrivateUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

export function whatsappHref(url: string, link: Pick<ReviewLink, "pocName" | "brandName" | "service">) {
  const text = `Hi ${link.pocName}, could you share a short review of ${link.service} for ${link.brandName}? It takes about two minutes:\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function mailtoHref(url: string, link: Pick<ReviewLink, "pocName" | "email" | "brandName" | "service">) {
  const subject = `A quick review for ${link.brandName}`;
  const body = `Hi ${link.pocName},\n\nCould you share a short review of ${link.service} for ${link.brandName}? It takes about two minutes:\n${url}\n\nThank you,\nRapzter Digital`;
  return `mailto:${link.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

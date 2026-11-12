import type { ReviewLink } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function localDateKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, "0");
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours = hours24 % 12 || 12;
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${hours}:${minutes} ${suffix}`;
}

export function starGlyphs(rating: number) {
  const safe = Math.max(0, Math.min(5, Math.round(rating)));
  return `${"★".repeat(safe)}${"☆".repeat(5 - safe)}`;
}

export function testimonialText(link: ReviewLink) {
  const response = link.response;
  if (!response) return "";
  return `"${response.review}"\n— ${link.pocName}, ${response.designation}, ${link.brandName}\n${starGlyphs(response.rating)} · ${link.service}`;
}

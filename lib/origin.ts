import type { Metadata } from "next";
import { headers } from "next/headers";

export const BRAND_IMAGE = "/og.png?v=2";

export const brandIcons: Metadata["icons"] = {
  icon: [
    { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
  ],
  shortcut: "/favicon-32.png",
  apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
};

export async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return "";
  const forwarded = headerList.get("x-forwarded-proto");
  const proto = forwarded ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

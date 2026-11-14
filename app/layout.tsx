import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { BRAND_IMAGE, brandIcons } from "@/lib/origin";
import "./globals.css";

function metadataBase() {
  const origin = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!origin) return undefined;
  try {
    return new URL(origin);
  } catch {
    return undefined;
  }
}

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: {
    default: "Review desk · Rapzter Digital",
    template: "%s · Rapzter Digital",
  },
  description: "Private review links for Rapzter Digital clients.",
  robots: { index: false, follow: false },
  icons: brandIcons,
  openGraph: {
    title: "Review desk · Rapzter Digital",
    description: "Private review links for Rapzter Digital clients.",
    type: "website",
    images: [{ url: BRAND_IMAGE, width: 1200, height: 630, alt: "Rapzter Digital" }],
  },
  twitter: {
    card: "summary_large_image",
    images: [BRAND_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#050605",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

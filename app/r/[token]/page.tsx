import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReviewForm from "@/components/ReviewForm";
import { BRAND_IMAGE, brandIcons, siteOrigin } from "@/lib/origin";
import { getLink } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const link = await getLink(token);
  const origin = await siteOrigin();
  const image = origin ? `${origin}${BRAND_IMAGE}` : BRAND_IMAGE;
  const images = [{ url: image, width: 1200, height: 630, alt: "Rapzter Digital" }];
  if (!link) {
    return {
      title: "Review link",
      icons: brandIcons,
      openGraph: { title: "Review link · Rapzter Digital", images },
      twitter: { card: "summary_large_image", images: [image] },
    };
  }
  const title = `${link.brandName} review`;
  const description = `Share a short review of ${link.service} for ${link.brandName}.`;
  return {
    title,
    description,
    icons: brandIcons,
    openGraph: { title: `${title} · Rapzter Digital`, description, images },
    twitter: { card: "summary_large_image", description, images: [image] },
  };
}

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getLink(token);
  if (!link) notFound();
  return <ReviewForm initial={link} />;
}

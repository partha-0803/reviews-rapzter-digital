import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReviewForm from "@/components/ReviewForm";
import { getLink } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const link = await getLink(token);
  const icons = { icon: "/favicon-32.png", shortcut: "/favicon-32.png", apple: "/favicon-32.png" };
  if (!link) return { title: "Review link", icons };
  return { title: `${link.brandName} review`, icons };
}

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getLink(token);
  if (!link) notFound();
  return <ReviewForm initial={link} />;
}

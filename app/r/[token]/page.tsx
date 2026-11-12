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
  if (!link) return { title: "Review link" };
  return { title: `${link.brandName} review` };
}

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await getLink(token);
  if (!link) notFound();
  return <ReviewForm initial={link} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplainerView } from "@/components/ExplainerView";
import { ThemeToggle } from "@/components/ThemeToggle";
import { sourceLabel } from "@/lib/shared/source";
import { getExplainer } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-explainer Open Graph / Twitter card metadata. The og:image is
 * served by the sibling opengraph-image.tsx file via Next's file-based
 * metadata convention — Next wires `<meta property="og:image">` to it
 * automatically, no need to spell it out here.
 */
export async function generateMetadata({
  params,
}: {
  params: { explainerId: string };
}): Promise<Metadata> {
  const explainer = await getExplainer(params.explainerId);
  if (!explainer) {
    return {
      title: "Readopp",
      description:
        "Turn what you read into a LinkedIn-ready visual carousel in under 30 seconds.",
    };
  }
  const title = `${explainer.title} — Readopp`;
  const description =
    explainer.summary?.slice(0, 200) ??
    `Visual carousel of ${explainer.panels.length} slides from ${sourceLabel(explainer.url)}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ExplainerPermalink({
  params,
}: {
  params: { explainerId: string };
}) {
  const explainer = await getExplainer(params.explainerId);
  if (!explainer) notFound();

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-block text-sm text-ink-muted hover:text-ink"
        >
          ← New explainer
        </Link>
        <ThemeToggle />
      </div>
      <ExplainerView explainer={explainer} canExport />
    </main>
  );
}

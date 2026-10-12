import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Footer } from "@/components/marketing/Footer";
import { LibraryGallery, type LibraryItem } from "@/components/LibraryGallery";
import { Nav } from "@/components/marketing/Nav";
import { listRecentExplainers } from "@/lib/store";
import { getCurrentSignedInUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Library — Readopp",
  description: "Revisit, edit, and publish the visual stories you created with Readopp.",
};

export default async function LibraryPage() {
  const userId = await getCurrentSignedInUserId();
  if (!userId) redirect("/");

  const explainers = await listRecentExplainers(userId, 48);
  const items: LibraryItem[] = explainers.map((explainer) => {
    const preview = [explainer.panels[1], explainer.panels[0]].find(
      (panel) => panel?.format === "svg",
    );

    return {
      id: explainer.id,
      title: explainer.title,
      summary: explainer.summary,
      url: explainer.url,
      panelCount: explainer.panels.length,
      createdLabel: formatCreatedAt(explainer.createdAt),
      preview: preview
        ? {
            heading: preview.heading,
            content: preview.content,
          }
        : null,
    };
  });

  return (
    <div className="force-light min-h-screen bg-[#f8f6f0] text-[#484848]">
      <Nav />
      <main>
        <section className="library-hero border-b border-[#dedbd3]">
          <div className="mx-auto max-w-[1240px] px-5 pb-12 pt-16 sm:px-8 sm:pb-16 sm:pt-20 lg:px-12">
            <p className="text-xs font-bold uppercase tracking-[.15em] text-[#7eae3f]">
              Your reading room
            </p>
            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_.7fr] lg:items-end">
              <h1 className="max-w-3xl text-5xl font-bold leading-[.96] tracking-[-.055em] text-[#484848] sm:text-7xl">
                Everything you made,
                <span className="block text-[#7eae3f]">ready to revisit.</span>
              </h1>
              <p className="max-w-md text-base leading-7 text-[#716e67] lg:justify-self-end">
                Open a story to refine the sequence, change its design, or export it again for your next post.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
          <LibraryGallery initialItems={items} />
        </section>
      </main>
      <Footer />
    </div>
  );
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved story";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

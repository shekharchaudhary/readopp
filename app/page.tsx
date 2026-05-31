import { ExampleGallery } from "@/components/ExampleGallery";
import { HeroPreview } from "@/components/HeroPreview";
import { UrlInput } from "@/components/UrlInput";

export default function HomePage() {
  return (
    <main className="space-y-14">
      <header className="space-y-6">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-soft">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          <span>Readopp</span>
        </div>
        <h1 className="max-w-3xl text-4xl font-medium leading-[1.05] tracking-tight text-ink sm:text-6xl">
          Turn any article into a <span className="text-accent-deep">short visual explainer</span> you can share.
        </h1>
        <p className="max-w-2xl text-base text-ink-soft sm:text-lg">
          Paste a URL. A team of agents reads it, distills the core ideas, and
          composes a sequence of clean panels — ready for Instagram, TikTok,
          LinkedIn, or your own deck.
        </p>
      </header>

      <HeroPreview />

      <section>
        <UrlInput />
      </section>

      <ExampleGallery />

      <section className="border-t border-paper-line pt-6 text-sm text-ink-muted">
        <p>
          Works best on focused technical blog posts and explanatory articles.
          Paywalled or login-only pages can&apos;t be read.
        </p>
      </section>
    </main>
  );
}

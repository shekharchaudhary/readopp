import { ExampleGallery } from "@/components/ExampleGallery";
import { UrlInput } from "@/components/UrlInput";

export default function HomePage() {
  return (
    <main className="space-y-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">
          Lucidread
        </h1>
        <p className="max-w-xl text-base text-ink-soft">
          Paste a URL. A small team of agents reads it, understands it, and
          turns it into a short visual explainer you can share.
        </p>
      </header>

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

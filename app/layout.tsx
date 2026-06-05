import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Readopp — Visual posts from anything you read",
  description:
    "The shortest path from great read to great post. Paste a URL, paper, or PDF — Readopp turns it into a LinkedIn-ready visual carousel in under 30 seconds. You shouldn't have to design what you already understand.",
  openGraph: {
    title: "Readopp — Visual posts from anything you read",
    description:
      "Turn the articles, papers, and PDFs you read into LinkedIn-ready visual posts in under 30 seconds.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Readopp — Visual posts from anything you read",
    description: "The shortest path from great read to great post.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { PageMotion } from "@/components/ui/PageMotion";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Readopp — Visual posts from anything you read",
  description:
    "Bring a Google Doc, Notion page, journal export, PDF, Word file, or reading notes. Readopp finds the story and turns it into a distinctive visual post for LinkedIn, X, or Substack in minutes.",
  openGraph: {
    title: "Readopp — Visual posts from anything you read",
    description:
      "Turn documents, notes, papers, and reading highlights into share-ready visual posts for LinkedIn, X, and Substack.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Readopp — Visual posts from anything you read",
    description: "Bring one document. Leave with a visual story worth sharing.",
  },
};

// Runs before paint so an explicitly chosen dark theme never flashes.
// The default stays light: the landing page is designed as a reading surface.
const themeInit = `(function(){try{var t=localStorage.getItem("theme");document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="app-interactions min-h-screen bg-paper text-ink font-sans antialiased">
        <PageMotion />
        {children}
      </body>
    </html>
  );
}

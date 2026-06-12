import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

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

// Runs before paint so a stored/system dark preference never flashes light.
const themeInit = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

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
      <body className="min-h-screen bg-paper text-ink font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

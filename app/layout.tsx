import { MARKETING_COPY } from "@/lib/marketingCopy";
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
  title: MARKETING_COPY.title,
  description: MARKETING_COPY.description,
  openGraph: { title: MARKETING_COPY.title, description: MARKETING_COPY.description, type: "website" },
  twitter: { card: "summary_large_image", title: MARKETING_COPY.title, description: MARKETING_COPY.description },
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

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Readopp",
  description:
    "Paste a URL. A team of agents turns it into a visual explanation you can share.",
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

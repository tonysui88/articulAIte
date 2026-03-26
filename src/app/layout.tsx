import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:       "articulAIte — AI Speech Coach",
  description: "Record your speech and get instant AI-powered coaching on pacing, clarity, and structure.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}

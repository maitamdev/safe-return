import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";

const sans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "FindBack AI — Find it. Verify it. Reward it.",
  description:
    "AI-powered lost & found on Solana. AI scores claims; escrow releases only after human approval.",
  keywords: [
    "FindBack AI",
    "SafeReturn",
    "lost and found",
    "Solana",
    "AI claim scoring",
    "escrow",
    "UniHackFest",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <LanguageProvider>
          <Navbar />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { FirstVisitGuide } from "@/components/onboarding/FirstVisitGuide";
import { AuthProvider } from "@/lib/auth/AuthProvider";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "SafeReturn: Tìm đồ thất lạc trên Solana Devnet",
  description:
    "Đăng tin thất lạc, kiểm tra bằng chứng và khóa phần thưởng minh bạch trên Solana Devnet.",
  keywords: [
    "SafeReturn",
    "tìm đồ thất lạc",
    "Solana",
    "AI claim",
    "escrow",
    "lost and found",
  ],
  applicationName: "SafeReturn",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "SafeReturn: Tìm đồ thất lạc trên Solana Devnet",
    description: "Đối chiếu bằng chứng và trao thưởng FIND minh bạch trên mạng thử nghiệm Solana.",
    type: "website",
    locale: "vi_VN",
    siteName: "SafeReturn",
  },
  twitter: { card: "summary_large_image", title: "SafeReturn", description: "Tìm đồ thất lạc với bằng chứng có thể kiểm tra trên Solana Devnet." },
};

export const viewport = {
  themeColor: "#08784a",
  colorScheme: "light dark",
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
        <AuthProvider>
          <Navbar />
          {children}
          <FirstVisitGuide />
        </AuthProvider>
      </body>
    </html>
  );
}

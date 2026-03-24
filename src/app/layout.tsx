import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import Script from "next/script";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Shchykno Courses",
  description: "Telegram Mini App для просмотра купленных и доступных курсов.",
  applicationName: "Shchykno",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const telegramScriptStrategy =
    process.env.NODE_ENV === "development" ? "afterInteractive" : "beforeInteractive";

  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${cormorant.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-white font-sans text-[#181216] antialiased">
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy={telegramScriptStrategy}
        />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

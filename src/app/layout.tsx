import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800" ] });

export const metadata: Metadata = {
  title: "extractPDF",
  description: "PDF analysis platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={"min-h-dvh bg-white text-gray-900 dark:bg-black dark:text-gray-100 antialiased selection:bg-blue-600/20 selection:text-blue-900 dark:selection:text-blue-100 " + jakarta.className}>
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 via-transparent to-transparent dark:from-blue-950/40" />
          <div className="absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-blue-200/50 via-purple-200/30 to-pink-200/30 blur-3xl dark:from-blue-900/30 dark:via-purple-900/20 dark:to-pink-900/20" />
        </div>
        <ThemeProvider>
          <Header />
          <main className="container py-10 sm:py-12 lg:py-16">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}

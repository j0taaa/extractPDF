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
      <body className={"min-h-dvh bg-white text-gray-900 dark:bg-black dark:text-gray-100 antialiased selection:bg-blue-600/20 selection:text-blue-900 dark:selection:text-blue-100 flex flex-col " + jakarta.className}>
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 via-transparent to-transparent dark:from-blue-950/40" />
          <div className="absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-blue-200/50 via-purple-200/30 to-pink-200/30 blur-3xl dark:from-blue-900/30 dark:via-purple-900/20 dark:to-pink-900/20" />
        </div>
        <ThemeProvider>
          <Header />
          <main className="container flex-1 py-12 sm:py-16 lg:py-20">{children}</main>
          <footer className="border-t py-10 text-sm text-neutral-600 dark:text-neutral-400">
            <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <img src="/logo.svg" alt="Logo" className="h-6 w-6" />
                <span className="font-semibold">ExtractPDF</span>
                <span className="opacity-70">© {new Date().getFullYear()}</span>
              </div>
              <div className="flex items-center gap-4">
                <a className="btn btn-sm btn-ghost" href="#">Privacy</a>
                <a className="btn btn-sm btn-ghost" href="#">Terms</a>
                <a className="btn btn-sm btn-ghost" href="#">Contact</a>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}

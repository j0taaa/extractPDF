import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";

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
    <html lang="en">
      <body className="min-h-dvh bg-white text-gray-900 dark:bg-black dark:text-gray-100">
        <ThemeProvider>
          <Header />
          <main className="container py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}

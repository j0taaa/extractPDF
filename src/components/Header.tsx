"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

export default function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  return (
    <header className="border-b bg-white/70 dark:bg-black/50 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-black/40 sticky top-0 z-40">
      <div className="container flex items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold">
          <img src="/logo.svg" alt="Logo" className="h-8 w-8" />
          <span>ExtractPDF</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link className={navClass(pathname === "/dashboard")} href="/dashboard">Dashboard</Link>
          <Link className={navClass(pathname === "/login")} href="/login">Login</Link>
          <Link className={navClass(pathname === "/register")} href="/register">Register</Link>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-900"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </nav>
      </div>
    </header>
  );
}

function navClass(active: boolean) {
  return (
    "transition-colors hover:text-blue-600 dark:hover:text-blue-400" +
    (active ? " text-blue-600 dark:text-blue-400 font-medium" : " text-gray-600 dark:text-gray-300")
  );
}


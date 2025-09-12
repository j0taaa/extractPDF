"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

export default function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  return (
    <header className="sticky top-0 z-50 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-neutral-800 dark:bg-black/40 dark:supports-[backdrop-filter]:bg-black/30">
      <div className="container flex items-center justify-between py-4">
        <Link href="/" className="group flex items-center gap-3 text-xl font-semibold">
          <img src="/logo.svg" alt="Logo" className="h-9 w-9 transition-transform group-hover:scale-105" />
          <span className="heading-gradient">ExtractPDF</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link className={navClass(pathname === "/dashboard")} href="/dashboard">Dashboard</Link>
          <Link className={navClass(pathname === "/login")} href="/login">Login</Link>
          <Link className={navClass(pathname === "/register")} href="/register">Register</Link>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white/70 text-neutral-700 shadow-sm transition hover:bg-white dark:border-neutral-800 dark:bg-black/60 dark:text-neutral-300 dark:hover:bg-black cursor-pointer"
            aria-label="Toggle theme"
          >
            <span className="text-base">{theme === "dark" ? "🌙" : "☀️"}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

function navClass(active: boolean) {
  return (
    "btn btn-sm btn-ghost " +
    (active
      ? "border-blue-500/30 bg-blue-500/10 text-blue-700 hover:text-blue-800 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300"
      : "")
  );
}


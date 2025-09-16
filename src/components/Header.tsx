"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";

type CurrentUser = {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        });

        if (!active) return;

        if (!res.ok) {
          setUser(null);
          return;
        }

        const data: { user: CurrentUser | null } = await res.json();
        setUser(data.user ?? null);
      } catch (error) {
        if (!active) return;
        console.error("Failed to load current user", error);
        setUser(null);
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      const res = await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "include"
      });

      if (!res.ok) {
        console.error("Sign out failed", await res.text());
        alert("Unable to log out right now. Please try again.");
        return;
      }

      setUser(null);
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed", error);
      alert("Unable to log out right now. Please try again.");
    }
  };

  const onDashboard = pathname?.startsWith("/dashboard") ?? false;
  const trimmedName = user?.name?.trim();
  const accountName =
    trimmedName && trimmedName.length > 0
      ? trimmedName.split(/\s+/)[0]
      : user?.email ?? "";
  const accountLabel = user
    ? `Account${accountName ? ` (${accountName})` : ""}`
    : "Dashboard";

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800 dark:bg-black/50 dark:supports-[backdrop-filter]:bg-black/40">
      <div className="container flex items-center justify-between py-5">
        <Link href="/" className="group flex items-center gap-3 text-xl font-semibold">
          <img src="/logo.svg" alt="Logo" className="h-9 w-9 transition-transform group-hover:scale-105" />
          <span className="heading-gradient">ExtractPDF</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link className={navClass(onDashboard)} href="/dashboard">
            {accountLabel}
          </Link>
          {user === undefined ? null : user ? (
            <button
              type="button"
              onClick={handleSignOut}
              className={`${navClass(false)} cursor-pointer`}
            >
              Log out
            </button>
          ) : (
            <>
              <Link className={navClass(pathname === "/login")} href="/login">
                Login
              </Link>
              <Link className={navClass(pathname === "/register")} href="/register">
                Register
              </Link>
            </>
          )}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white/70 text-neutral-700 shadow-sm transition hover:bg-white dark:border-neutral-800 dark:bg-black/60 dark:text-neutral-300 dark:hover:bg-black cursor-pointer"
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
      ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-300"
      : "")
  );
}


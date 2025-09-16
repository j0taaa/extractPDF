"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      alert("Failed to sign in");
    }
  };

  return (
    <div className="flex min-h-[80dvh] items-center justify-center">
      <div className="card w-full max-w-md">
        <h1 className="mb-8 text-center text-3xl font-bold heading-gradient">Welcome back</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="btn btn-primary w-full"
            type="submit"
          >
            Sign in
          </button>
          <p className="muted text-center">Don't have an account? <Link href="/register" className="text-blue-600 hover:underline">Sign up</Link></p>
        </form>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
      router.push("/");
    } else {
      alert("Failed to sign in");
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold mb-6">Sign in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            className="block w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            className="block w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 w-full"
          type="submit"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

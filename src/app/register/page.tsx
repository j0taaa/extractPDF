"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    if (res.ok) {
      router.push("/login");
    } else {
      alert("Failed to register");
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-black/50">
        <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              className="block w-full rounded-lg border-gray-300 bg-white px-3.5 py-2.5 shadow-sm outline-none ring-0 transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-black dark:placeholder:text-gray-500"
              type="text"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              className="block w-full rounded-lg border-gray-300 bg-white px-3.5 py-2.5 shadow-sm outline-none ring-0 transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-black dark:placeholder:text-gray-500"
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
              className="block w-full rounded-lg border-gray-300 bg-white px-3.5 py-2.5 shadow-sm outline-none ring-0 transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-black dark:placeholder:text-gray-500"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 font-medium text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-500"
            type="submit"
          >
            Sign up
          </button>
        </form>
      </div>
    </div>
  );
}

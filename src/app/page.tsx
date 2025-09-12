import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <img src="/logo.svg" alt="Logo" className="h-20 w-20" />
      <h1 className="text-4xl font-bold tracking-tight">ExtractPDF</h1>
      <p className="text-center text-gray-600 dark:text-gray-300 max-w-prose">
        A simple, modern platform to analyze and work with your PDF documents.
      </p>
      <div className="flex items-center gap-3">
        <Link href="/register" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 transition">
          Get started
        </Link>
        <Link href="/login" className="rounded-md border px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition">
          Sign in
        </Link>
        <Link href="/dashboard" className="rounded-md border px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition">
          Dashboard
        </Link>
      </div>
    </div>
  );
}

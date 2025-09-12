import Link from "next/link";

export default function Home() {
  return (
    <div className="relative">
      <section className="relative mx-auto max-w-5xl py-20 sm:py-24 lg:py-28">
        <div className="absolute -top-16 right-1/2 h-64 w-64 translate-x-1/2 rounded-full bg-gradient-to-tr from-blue-400/30 via-purple-400/20 to-pink-400/20 blur-3xl dark:from-blue-900/30 dark:via-purple-900/20 dark:to-pink-900/20" />
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300">
            New • AI-assisted PDF insights
          </span>
          <div className="flex items-center gap-4">
            <img src="/logo.svg" alt="Logo" className="h-16 w-16" />
            <h1 className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl">
              ExtractPDF
            </h1>
          </div>
          <p className="max-w-2xl text-balance text-lg text-gray-600 dark:text-gray-300">
            Transform PDFs into structured knowledge. Upload, analyze, and extract insights with a beautiful, fast, and privacy-first experience.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-500">
              Get started
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/70 px-5 py-2.5 text-gray-900 transition hover:bg-gray-100 dark:border-gray-800 dark:bg-black/60 dark:text-gray-200 dark:hover:bg-black">
              Sign in
            </Link>
            <Link href="/dashboard" className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/70 px-5 py-2.5 text-gray-900 transition hover:bg-gray-100 dark:border-gray-800 dark:bg-black/60 dark:text-gray-200 dark:hover:bg-black">
              Dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl pb-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Upload & organize",
              desc: "Drag-and-drop PDFs and keep them neatly organized into projects.",
            },
            {
              title: "Instant extraction",
              desc: "Pull entities, tables, and key facts with precision.",
            },
            {
              title: "Secure by default",
              desc: "Your data stays yours. Private projects and secure APIs.",
            },
          ].map((f, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-black/50"
            >
              <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-gradient-to-tr from-blue-400/20 via-purple-400/10 to-pink-400/10 blur-2xl" />
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-sm">
                {i === 0 ? "📂" : i === 1 ? "⚡" : "🔒"}
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

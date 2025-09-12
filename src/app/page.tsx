import Link from "next/link";

export default function Home() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative section-narrow min-h-[85dvh] flex items-center">
        <div className="absolute -top-16 right-1/2 h-64 w-64 translate-x-1/2 rounded-full bg-gradient-to-tr from-blue-400/30 via-purple-400/20 to-pink-400/20 blur-3xl dark:from-blue-900/30 dark:via-purple-900/20 dark:to-pink-900/20" />
        <div className="flex w-full flex-col items-center gap-6 text-center">
          <span className="chip">New • AI-assisted PDF insights</span>
          <div className="flex items-center gap-4">
            <img src="/logo.svg" alt="Logo" className="h-16 w-16" />
            <h1 className="heading-gradient text-5xl font-extrabold tracking-tight sm:text-6xl">
              ExtractPDF
            </h1>
          </div>
          <p className="lead">
            Transform PDFs into structured knowledge. Upload, analyze, and extract insights with a beautiful, fast, and privacy-first experience.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className="btn btn-lg btn-primary">Get started</Link>
            <Link href="/login" className="btn btn-lg btn-secondary">Sign in</Link>
            <Link href="/dashboard" className="btn btn-lg btn-ghost">Dashboard</Link>
          </div>
          <p className="muted">No credit card required • Free plan available</p>
        </div>
      </section>

      {/* Trust bar */}
      <section className="section py-10">
        <div className="rounded-2xl border border-neutral-200 bg-white/60 p-4 backdrop-blur dark:border-neutral-800 dark:bg-black/40">
          <div className="grid grid-cols-2 items-center gap-6 text-center sm:grid-cols-3 lg:grid-cols-6">
            {["Acme", "Globex", "Umbrella", "Initech", "Soylent", "Stark"].map((brand) => (
              <div key={brand} className="text-sm text-neutral-500 dark:text-neutral-400">{brand}</div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold">How it works</h2>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">Three simple steps to turn PDFs into answers.</p>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {[
            { title: "Upload", desc: "Drag and drop or connect cloud drives.", icon: "📤" },
            { title: "Analyze", desc: "AI extracts tables, entities, and key facts.", icon: "🧠" },
            { title: "Export", desc: "Sync to CSV, JSON, or your database.", icon: "⬇️" },
          ].map((s) => (
            <div key={s.title} className="card">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-sm">{s.icon}</div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold">Powerful features</h2>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">Built for speed, accuracy, and privacy.</p>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Upload & organize", desc: "Drag-and-drop PDFs and organize into projects.", icon: "📂" },
            { title: "Instant extraction", desc: "Pull entities, tables, and key facts with precision.", icon: "⚡" },
            { title: "Secure by default", desc: "Your data stays yours. Private projects and secure APIs.", icon: "🔒" },
            { title: "Search across PDFs", desc: "Semantic search to find the right passage fast.", icon: "🔎" },
            { title: "Export anywhere", desc: "CSV, JSON, webhooks, and native integrations.", icon: "🔗" },
            { title: "Team collaboration", desc: "Share projects and manage permissions.", icon: "👥" },
          ].map((f) => (
            <div key={f.title} className="card">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-sm">{f.icon}</div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="section">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold">Loved by teams</h2>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">What our users say.</p>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {[
            { quote: "ExtractPDF cut our reporting time from hours to minutes.", author: "Maya, Ops Manager" },
            { quote: "The accuracy on complex tables is impressive.", author: "Liam, Data Analyst" },
            { quote: "Setup was painless and exports fit our workflow.", author: "Ava, Product Lead" },
          ].map((t) => (
            <div key={t.author} className="card">
              <p className="text-sm text-neutral-700 dark:text-neutral-200">“{t.quote}”</p>
              <p className="mt-3 text-xs text-neutral-500">{t.author}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="section-narrow">
        <div className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-8 text-center text-white shadow-lg">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1rem_1rem,rgba(255,255,255,0.12)_0.25rem,transparent_0.26rem)] bg-[length:2rem_2rem] opacity-20" />
          <h3 className="text-2xl font-semibold">Start extracting insights today</h3>
          <p className="mt-2 opacity-90">Join in minutes. Your first project is free.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className="btn btn-lg bg-white text-blue-700 hover:bg-white/90">Create free account</Link>
            <Link href="/dashboard" className="btn btn-lg border border-white/30 bg-white/10 text-white hover:bg-white/15">Explore dashboard</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

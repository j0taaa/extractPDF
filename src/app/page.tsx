import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "2rem" }}>
      <img src="/logo.svg" alt="Logo" style={{ height: 80 }} />
      <h1>Welcome to ExtractPDF</h1>
      <p>
        <Link href="/register">Register</Link> | <Link href="/login">Login</Link>
      </p>
    </main>
  );
}

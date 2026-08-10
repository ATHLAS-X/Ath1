import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found | AthlasX" };

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="sx-card p-10 max-w-md text-center">
        <p className="text-5xl font-extrabold" style={{ color: "var(--accent)" }}>
          404
        </p>
        <h1 className="mt-3 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Link href="/dashboard" className="sx-btn inline-block mt-6 sm:w-auto px-6">
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}

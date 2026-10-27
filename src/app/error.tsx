"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
      <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Red flag</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold uppercase">Session suspended</h1>
      <p className="mt-3 text-muted">
        We couldn&apos;t reach the timing data just now. It usually comes back within a minute. Your picks are safe.
      </p>
      <div className="mt-6 flex gap-4">
        <button
          onClick={reset}
          className="rounded-md bg-accent px-5 py-2 font-display text-lg font-bold uppercase tracking-wide text-black"
        >
          Try again
        </button>
        <Link href="/" className="self-center text-sm text-muted underline">
          Back to the start
        </Link>
      </div>
    </main>
  );
}

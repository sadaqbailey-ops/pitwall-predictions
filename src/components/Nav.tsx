import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";

const LINKS = [
  { href: "/race", label: "Race" },
  { href: "/replay", label: "Replay" },
  { href: "/leagues", label: "Leagues" },
  { href: "/me", label: "My season" },
] as const;

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-sm bg-accent font-display text-sm font-extrabold text-black">
        PW
      </span>
      <span className="font-display text-xl font-extrabold uppercase tracking-wide">Pit Wall</span>
    </Link>
  );
}

export function Nav({ displayName, teamName }: { displayName: string; teamName: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Logo />
        <nav className="flex gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <div className="text-right leading-tight">
            <span className="block font-medium">{displayName}</span>
            <span className="block text-xs text-accent">{teamName}</span>
          </div>
          <form action={signOutAction}>
            <button className="rounded-md border border-line px-3 py-1.5 text-muted transition hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <div className="kerb opacity-80" />
    </header>
  );
}

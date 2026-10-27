import { count, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { leagueMembers, leagues } from "@/db/schema";
import { requirePlayer } from "@/lib/session";
import { CreateLeagueForm, JoinLeagueForm } from "./forms";

export default async function LeaguesPage() {
  const { userId } = await requirePlayer("/leagues");
  const mine = await db
    .select({ id: leagues.id, name: leagues.name, isDemo: leagues.isDemo, ownerId: leagues.ownerId })
    .from(leagueMembers)
    .innerJoin(leagues, eq(leagues.id, leagueMembers.leagueId))
    .where(eq(leagueMembers.userId, userId));

  const counts = mine.length
    ? await db
        .select({ leagueId: leagueMembers.leagueId, members: count() })
        .from(leagueMembers)
        .where(
          inArray(
            leagueMembers.leagueId,
            mine.map((l) => l.id),
          ),
        )
        .groupBy(leagueMembers.leagueId)
    : [];
  const membersOf = new Map(counts.map((c) => [c.leagueId, c.members]));
  const sorted = [...mine].sort((a, b) => Number(a.isDemo) - Number(b.isDemo) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-5xl font-extrabold uppercase">Leagues</h1>
        <p className="mt-1 text-muted">Your tables for the season. Only live picks count here.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((l) => (
          <Link
            key={l.id}
            href={`/leagues/${l.id}`}
            className="rounded-lg border border-line bg-surface p-5 transition hover:border-accent"
          >
            <div className="text-xs uppercase tracking-[0.2em] text-muted">
              {l.isDemo ? "Everyone's in this one" : l.ownerId === userId ? "You run this" : "Private league"}
            </div>
            <div className="mt-1 font-display text-3xl font-bold uppercase">{l.name}</div>
            <div className="mt-2 text-sm text-muted">{membersOf.get(l.id) ?? 1} drivers</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="font-display text-2xl font-bold uppercase">Start a league</h2>
          <p className="mt-1 text-sm text-muted">You&apos;ll get a code to send to the group chat.</p>
          <CreateLeagueForm />
        </section>
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="font-display text-2xl font-bold uppercase">Got a code?</h2>
          <p className="mt-1 text-sm text-muted">Six characters, not case sensitive.</p>
          <JoinLeagueForm />
        </section>
      </div>
    </div>
  );
}

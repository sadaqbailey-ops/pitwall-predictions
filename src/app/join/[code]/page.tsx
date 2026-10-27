import { count, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/actions/auth";
import { JoinLeagueForm } from "@/app/(game)/leagues/forms";
import { auth } from "@/auth";
import { Logo } from "@/components/Nav";
import { db } from "@/db";
import { leagueMembers, leagues } from "@/db/schema";
import { isMember, normalizeInviteCode } from "@/lib/leagues";
import { getProfile } from "@/lib/session";

// Invite links land here. Works signed out too: sign in first, then come straight back.
export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const code = normalizeInviteCode((await params).code);
  const self = `/join/${code}`;
  const session = await auth();
  const userId = session?.user?.id;

  const [league] = await db.select().from(leagues).where(eq(leagues.inviteCode, code)).limit(1);
  const [members] = league
    ? await db.select({ n: count() }).from(leagueMembers).where(eq(leagueMembers.leagueId, league.id))
    : [{ n: 0 }];

  if (userId && league && (await isMember(league.id, userId))) redirect(`/leagues/${league.id}`);
  if (userId && !(await getProfile(userId))) redirect(`/onboarding?next=${encodeURIComponent(self)}`);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <Logo />
      <div className="mt-12 rounded-xl border border-line bg-surface p-6">
        {league ? (
          <>
            <p className="text-xs uppercase tracking-[0.25em] text-muted">You&apos;ve been invited to</p>
            <h1 className="mt-1 font-display text-5xl font-extrabold uppercase">{league.name}</h1>
            <p className="text-muted">{members.n} drivers on the grid so far</p>
            {userId ? (
              <JoinLeagueForm code={code} />
            ) : (
              <form action={signInWithGoogle} className="mt-6">
                <input type="hidden" name="next" value={self} />
                <button className="rounded-md bg-foreground px-6 py-3 font-medium text-black hover:bg-white">
                  Sign in with Google to join
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl font-extrabold uppercase">That code didn&apos;t work</h1>
            <p className="mt-1 text-muted">
              No league uses <span className="font-mono">{code || "that code"}</span>. Ask whoever sent it to double
              check.
            </p>
            <Link href="/" className="mt-4 inline-block text-accent underline">
              Back to Pit Wall
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

import Link from "next/link";
import { signInWithGoogle } from "@/app/actions/auth";
import { auth } from "@/auth";
import { Countdown } from "@/components/Countdown";
import { DriverChip } from "@/components/DriverChip";
import { Logo } from "@/components/Nav";
import { getNextRace, getSchedule, getSeasonResults } from "@/lib/f1";
import { POINTS } from "@/lib/scoring";

export default async function Landing({ searchParams }: PageProps<"/">) {
  const [{ next }, session, nextRace, schedule, results] = await Promise.all([
    searchParams,
    auth(),
    getNextRace(),
    getSchedule(),
    getSeasonResults(),
  ]);
  const lastRound = Math.max(0, ...results.keys());
  const last = results.get(lastRound);
  const lastRace = schedule.find((r) => r.round === lastRound);
  const signedIn = Boolean(session?.user);
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/race";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        {signedIn && (
          <Link href="/race" className="text-sm text-muted hover:text-foreground">
            Go to the pit wall →
          </Link>
        )}
      </header>

      <section className="mt-14 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">2026 season · predictions league</p>
          <h1 className="mt-3 font-display text-6xl leading-[0.9] font-extrabold uppercase sm:text-7xl">
            Call the podium
            <br />
            before lights out.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Pick the top three and the fastest lap for every Grand Prix. Picks lock when the race starts, get
            scored against the real result, and your mates find out who actually knows what they&apos;re talking
            about.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {signedIn ? (
              <Link
                href={nextPath}
                className="rounded-md bg-accent px-6 py-3 font-display text-xl font-bold uppercase tracking-wide text-black hover:brightness-110"
              >
                Make your picks
              </Link>
            ) : (
              <form action={signInWithGoogle}>
                <input type="hidden" name="next" value={nextPath} />
                <button className="flex items-center gap-3 rounded-md bg-foreground px-6 py-3 font-medium text-black hover:bg-white">
                  <GoogleMark />
                  Sign in with Google
                </button>
              </form>
            )}
            <span className="text-sm text-muted">Free. No ads. Bragging rights only.</span>
          </div>
        </div>

        {nextRace && (
          <div className="rounded-xl border border-line bg-surface p-6">
            <p className="text-xs uppercase tracking-[0.25em] text-muted">
              Round {nextRace.round} {nextRace.hasSprint && "· sprint weekend"}
            </p>
            <h2 className="mt-1 font-display text-4xl font-extrabold uppercase">{nextRace.name}</h2>
            <p className="text-muted">
              {nextRace.circuit} · {nextRace.locality}
            </p>
            <div className="mt-6">
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-muted">Picks lock in</p>
              <Countdown target={nextRace.raceStart.toISOString()} />
            </div>
          </div>
        )}
      </section>

      <div className="kerb mt-16 opacity-70" />

      <section className="mt-10 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-display text-xl font-bold uppercase">How scoring works</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Driver in the exact spot</span>
              <b className="font-mono">+{POINTS.exact}</b>
            </li>
            <li className="flex justify-between">
              <span>On the podium, wrong spot</span>
              <b className="font-mono">+{POINTS.onPodium}</b>
            </li>
            <li className="flex justify-between">
              <span>Fastest lap</span>
              <b className="font-mono">+{POINTS.fastestLap}</b>
            </li>
            <li className="flex justify-between">
              <span>Perfect podium bonus</span>
              <b className="font-mono">+{POINTS.perfectPodium}</b>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-display text-xl font-bold uppercase">Private leagues</h3>
          <p className="mt-3 text-sm text-muted">
            Start a league, share the six-letter code, and run your own table across the season. Everyone starts in
            the Paddock Club too, so there&apos;s always someone to beat.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-display text-xl font-bold uppercase">Between race weekends</h3>
          <p className="mt-3 text-sm text-muted">
            Replay any race from this season. Make your picks blind, hit reveal, and see how you&apos;d have
            scored.
          </p>
        </div>
      </section>

      {last && lastRace && (
        <section className="mt-10 rounded-xl border border-line bg-surface p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Last time out · {lastRace.name}</p>
          <ol className="mt-3 flex flex-wrap gap-6">
            {last.classification.slice(0, 3).map((d) => (
              <li key={d.driverId} className="flex items-center gap-3">
                <span className="font-display text-3xl font-extrabold text-muted">P{d.position}</span>
                <DriverChip driver={d} />
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="mt-16 pb-6 text-xs text-muted">
        Race data from the Jolpica F1 API. Not affiliated with Formula 1 or any team.
      </footer>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

# Pit Wall

A predictions game for Formula 1 race weekends. Before lights out you call the podium and the fastest lap. Picks lock when the race starts, get scored against the real result, and you see where you stand against your mates in a private league.

**Live:** https://pitwall-predictions.vercel.app

## Why this

I watch every race, and my group chat argues about the podium every Saturday night. Then nobody remembers who actually called it. This keeps the receipts.

## What you can do

- **Sign in with Google.** First sign-in asks for a name and the team you support, and that team's colour themes the app.
- **Make picks for the next race.** Tap drivers into P1, P2, P3 and fastest lap. Picks autosave as a draft, and you submit to make them count. You can change them until lights out, with a countdown to the lock. Once qualifying has run, the grid position shows next to each driver.
- **Scorecards.** After the race every pick gets its own line: where your driver actually finished and what it earned.
- **Replay any finished race.** Pick blind, hit reveal, and the result and your scorecard animate in. You also see how you'd have done against the Paddock Club, who made their picks live. Replays never count towards league tables.
- **Leagues.**
  - Create one, share the six-character code or the invite link, and get a season table with the last few rounds broken out.
  - The table shows who has picks in for the upcoming race, but never what they are.
  - Click a player to see their past picks.
- **Paddock Club.** Everyone lands in a demo league with six rivals. Each one plays a different strategy over every finished round of 2026, so the table is full from your first sign-in, even without a second person.
- **My season.** Your picks against the real podium, race by race, with a running total.

## Scoring

| | Points |
|---|---|
| Driver in the exact podium spot | 10 |
| Driver on the podium, wrong spot | 5 |
| Fastest lap | 5 |
| Perfect podium bonus | 10 |

A race is worth up to 45 points. Ties go to whoever has more exact calls, then more perfect podiums. Only submitted picks score. A draft left at lights out shows what it would have scored, but it doesn't count.

## How it's built

- **Next.js 16 (App Router), TypeScript, Tailwind.** Server components for reads, server actions for writes.
- **Auth.js v5 with Google.** Database sessions live in Postgres through the Drizzle adapter (`src/auth.ts`). Pages under `src/app/(game)` share a layout that checks the session and onboarding (`src/lib/session.ts`).
- **Neon Postgres and Drizzle ORM.** The schema is in `src/db/schema.ts`. Queries use Neon's HTTP driver on the pooled connection string.
- **Race data from the Jolpica F1 API.** It's free and needs no key. `src/lib/f1.ts` wraps it with types and caches responses with fetch revalidation: one day for the calendar, five minutes for results. Scores are computed when a page loads, from saved picks and cached results, so there are no stored scores to go stale and no cron job.
- **Scoring is one pure function.** `src/lib/scoring.ts` has no database or network calls and is covered by `src/lib/scoring.test.ts`. The same function scores real players, the seeded rivals and replays.

**Rules enforced on the server** (`src/app/actions`), not just in the UI:
- Live picks are rejected once the race has started.
- Replays only work on finished races, and they're frozen after the reveal.
- Podium drivers have to be distinct and on that race's entry list.
- An autosave can never turn submitted picks back into a draft.
- League pages return 404 to people who aren't members.

## Running it locally

You need Node 20+, a Postgres database (Neon's free tier is fine) and a Google OAuth client.

```sh
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run db:push              # create the tables
npm run db:seed              # Paddock Club rivals and their picks
npm run dev                  # http://localhost:3000
```

`.env.local` needs:

- `DATABASE_URL`: the pooled Postgres connection string. If you use the Neon CLI, `neon env pull` fills it in.
- `DATABASE_URL_UNPOOLED`: optional. The direct connection, used for schema changes.
- `AUTH_SECRET`: from `npx auth secret` or `openssl rand -base64 33`.
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`: from a Google Cloud OAuth client of type "Web application", with the redirect URI `http://localhost:3000/api/auth/callback/google`.

Other commands:

```sh
npm test         # scoring rules
npm run lint
npm run company  # prints a line, see below
```

`npm run company` was asked for in the brief. It's a standalone script that only prints a sentence, and it doesn't touch build, test or start.

## What's not done yet

- Sprint races aren't scored. Sprint weekends are flagged, but only the Grand Prix counts.
- No reminders before the lock.
- No way to rename or delete a league after creating it.
- Results are read from the API every time and never stored, so a correction to a result rescores everyone automatically. That's handy, but there's no history of changes.

// Seeds the Paddock Club demo league: six rivals with live picks for every finished round.
// Each rival follows a strategy using only what was known before that race, so the table
// looks like real people played it. Safe to re-run: everything is upserted on fixed ids.
//
//   npm run db:seed

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { leagueMembers, leagues, predictions, profiles, users } from "@/db/schema";
import { getQualifyingOrder, getSchedule, getSeasonResults, SEASON, type RaceResult } from "@/lib/f1";

const DEMO_LEAGUE_ID = "paddock-club";

type Ctx = {
  round: number;
  previous: RaceResult | null; // last race before this one
  grid: string[]; // qualifying order for this race
  standings: string[]; // drivers' championship order going into this race
  rng: () => number;
};
type Strategy = (ctx: Ctx) => [string, string, string, string | null];

// Deterministic PRNG so re-seeding gives the same table.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickDistinct(pool: string[], n: number, rng: () => number): string[] {
  const copy = [...pool];
  const out: string[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  return out;
}

const firstThree = (xs: string[]) => [xs[0], xs[1], xs[2]] as [string, string, string];

const RIVALS: { id: string; name: string; team: string; seed: number; strategy: Strategy }[] = [
  {
    // Trusts Saturday: podium straight off the front row, pole sitter for fastest lap.
    id: "bot-grid",
    name: "Grid Sheet Gaz",
    team: "williams",
    seed: 11,
    strategy: ({ grid, standings }) => {
      const order = grid.length >= 3 ? grid : standings;
      return [...firstThree(order), order[0]];
    },
  },
  {
    // Championship order, every single week.
    id: "bot-table",
    name: "Spreadsheet Sam",
    team: "mercedes",
    seed: 23,
    strategy: ({ standings, grid }) => [...firstThree(standings), grid[0] ?? standings[0]],
  },
  {
    // Last race's podium, again.
    id: "bot-form",
    name: "Form Guide Fi",
    team: "mclaren",
    seed: 37,
    strategy: ({ previous, standings }) => {
      const order = previous ? previous.classification.map((d) => d.driverId) : standings;
      return [...firstThree(order), previous?.classification.find((d) => d.fastestLapRank === 1)?.driverId ?? null];
    },
  },
  {
    // Ferrari on the podium no matter what, the rest from the top of the grid.
    id: "bot-tifosi",
    name: "Tifosi Tom",
    team: "ferrari",
    seed: 41,
    strategy: ({ grid, standings }) => {
      const order = grid.length >= 3 ? grid : standings;
      const ferrari = ["leclerc", "hamilton"].filter((d) => order.includes(d));
      const rest = order.filter((d) => !ferrari.includes(d));
      return [ferrari[0] ?? rest[0], rest[0], ferrari[1] ?? rest[1], "leclerc"];
    },
  },
  {
    // Shuffles the top six on the grid. Sometimes brilliant.
    id: "bot-gut",
    name: "Gut Feel Gabi",
    team: "red_bull",
    seed: 53,
    strategy: ({ grid, standings, rng }) => {
      const top = (grid.length >= 6 ? grid : standings).slice(0, 6);
      const [a, b, c, fl] = pickDistinct(top, 4, rng);
      return [a, b, c, fl ?? null];
    },
  },
  {
    // Backs the midfield every week, waiting for the chaos race.
    id: "bot-chaos",
    name: "Chaos Carlos",
    team: "haas",
    seed: 67,
    strategy: ({ grid, standings, rng }) => {
      const order = grid.length >= 10 ? grid : standings;
      const [a, b, c] = pickDistinct(order.slice(2, 10), 3, rng);
      return [a, b, c, pickDistinct(order.slice(0, 12), 1, rng)[0] ?? null];
    },
  },
];

function championshipOrder(results: RaceResult[]): string[] {
  const pts = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const total = new Map<string, number>();
  for (const r of results) {
    r.classification.forEach((d, i) => total.set(d.driverId, (total.get(d.driverId) ?? 0) + (pts[i] ?? 0)));
  }
  return [...total.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

async function main() {
  const [schedule, results] = await Promise.all([getSchedule(), getSeasonResults()]);
  const finished = schedule.filter((r) => results.has(r.round));
  console.log(`Seeding Paddock Club for ${finished.length} finished rounds of ${SEASON}`);

  await db
    .insert(leagues)
    .values({ id: DEMO_LEAGUE_ID, name: "Paddock Club", isDemo: true, inviteCode: null })
    .onConflictDoUpdate({ target: leagues.id, set: { name: "Paddock Club", isDemo: true } });

  for (const rival of RIVALS) {
    await db.insert(users).values({ id: rival.id, name: rival.name }).onConflictDoNothing();
    await db
      .insert(profiles)
      .values({ userId: rival.id, displayName: rival.name, favoriteTeam: rival.team, isBot: true })
      .onConflictDoUpdate({ target: profiles.userId, set: { displayName: rival.name, favoriteTeam: rival.team } });
    await db.insert(leagueMembers).values({ leagueId: DEMO_LEAGUE_ID, userId: rival.id }).onConflictDoNothing();
  }

  const rows: (typeof predictions.$inferInsert)[] = [];
  for (const race of finished) {
    const before = [...results.values()].filter((r) => r.round < race.round);
    const previous = before.sort((a, b) => b.round - a.round)[0] ?? null;
    const grid = [...(await getQualifyingOrder(race.round)).entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
    const standings = championshipOrder(before);
    // Round 1 has no standings yet: fall back to the grid, then to the race entry order.
    const fallback = standings.length ? standings : grid.length ? grid : results.get(race.round)!.classification.map((d) => d.driverId);

    for (const rival of RIVALS) {
      const rng = mulberry32(rival.seed * 1000 + race.round);
      const [p1, p2, p3, fastestLap] = rival.strategy({ round: race.round, previous, grid, standings: fallback, rng });
      const submittedAt = new Date(race.raceStart.getTime() - (2 + rng() * 40) * 3600_000);
      rows.push({
        id: `${rival.id}-${SEASON}-${race.round}`,
        userId: rival.id,
        season: SEASON,
        round: race.round,
        mode: "live",
        p1,
        p2,
        p3,
        fastestLap,
        status: "submitted",
        createdAt: submittedAt,
        updatedAt: submittedAt,
      });
    }
  }

  await db
    .insert(predictions)
    .values(rows)
    .onConflictDoUpdate({
      target: [predictions.userId, predictions.season, predictions.round, predictions.mode],
      set: {
        p1: sql`excluded.p1`,
        p2: sql`excluded.p2`,
        p3: sql`excluded.p3`,
        fastestLap: sql`excluded.fastest_lap`,
        status: sql`excluded.status`,
      },
    });

  // Anyone who signed up before the league existed gets added too.
  await db.execute(sql`
    insert into league_members (league_id, user_id)
    select ${DEMO_LEAGUE_ID}, user_id from profiles
    on conflict do nothing
  `);

  console.log(`Upserted ${RIVALS.length} rivals and ${rows.length} predictions.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

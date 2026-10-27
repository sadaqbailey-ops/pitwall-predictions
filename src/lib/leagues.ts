import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { leagueMembers, leagues, predictions, profiles, users } from "@/db/schema";
import { getSeasonResults, SEASON, type RaceResult } from "@/lib/f1";
import { outcomeFrom, scorePrediction, type RaceOutcome, type Score } from "@/lib/scoring";

export const DEMO_LEAGUE_NAME = "Paddock Club";

// No 0/O or 1/I/L, so codes survive being read out over a group chat.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function getDemoLeagueId(): Promise<string | null> {
  const [demo] = await db.select({ id: leagues.id }).from(leagues).where(eq(leagues.isDemo, true)).limit(1);
  return demo?.id ?? null;
}

export async function joinDemoLeague(userId: string): Promise<void> {
  const demoId = await getDemoLeagueId();
  if (!demoId) return;
  await db.insert(leagueMembers).values({ leagueId: demoId, userId }).onConflictDoNothing();
}

export async function isMember(leagueId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: leagueMembers.userId })
    .from(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

export function outcomesByRound(results: Map<number, RaceResult>): Map<number, RaceOutcome> {
  const out = new Map<number, RaceOutcome>();
  for (const [round, result] of results) {
    const outcome = outcomeFrom(result.classification);
    if (outcome) out.set(round, outcome);
  }
  return out;
}

export type StandingRow = {
  userId: string;
  displayName: string;
  favoriteTeam: string;
  isBot: boolean;
  total: number;
  exactHits: number;
  perfectPodiums: number;
  racesPlayed: number;
  byRound: Map<number, Score>;
};

/**
 * Season standings for a league. Only submitted live picks count; replays are practice.
 * Ties break on exact-position hits, then perfect podiums.
 */
export async function getStandings(leagueId: string): Promise<{ rows: StandingRow[]; rounds: number[] }> {
  const members = await db
    .select({
      userId: leagueMembers.userId,
      displayName: profiles.displayName,
      favoriteTeam: profiles.favoriteTeam,
      isBot: profiles.isBot,
      googleName: users.name,
    })
    .from(leagueMembers)
    .innerJoin(users, eq(users.id, leagueMembers.userId))
    .leftJoin(profiles, eq(profiles.userId, leagueMembers.userId))
    .where(eq(leagueMembers.leagueId, leagueId));

  if (members.length === 0) return { rows: [], rounds: [] };

  const [picks, results] = await Promise.all([
    db
      .select()
      .from(predictions)
      .where(
        and(
          inArray(
            predictions.userId,
            members.map((m) => m.userId),
          ),
          eq(predictions.season, SEASON),
          eq(predictions.mode, "live"),
          eq(predictions.status, "submitted"),
        ),
      ),
    getSeasonResults(),
  ]);
  const outcomes = outcomesByRound(results);

  const rows: StandingRow[] = members.map((m) => ({
    userId: m.userId,
    displayName: m.displayName ?? m.googleName ?? "New driver",
    favoriteTeam: m.favoriteTeam ?? "",
    isBot: m.isBot ?? false,
    total: 0,
    exactHits: 0,
    perfectPodiums: 0,
    racesPlayed: 0,
    byRound: new Map(),
  }));
  const rowByUser = new Map(rows.map((r) => [r.userId, r]));

  for (const p of picks) {
    const outcome = outcomes.get(p.round);
    const row = rowByUser.get(p.userId);
    if (!outcome || !row) continue;
    const score = scorePrediction(p, outcome);
    row.byRound.set(p.round, score);
    row.total += score.total;
    row.exactHits += score.exactHits;
    row.perfectPodiums += score.perfectPodium ? 1 : 0;
    row.racesPlayed += 1;
  }

  rows.sort(
    (a, b) =>
      b.total - a.total ||
      b.exactHits - a.exactHits ||
      b.perfectPodiums - a.perfectPodiums ||
      a.displayName.localeCompare(b.displayName),
  );

  return { rows, rounds: [...outcomes.keys()].sort((a, b) => a - b) };
}

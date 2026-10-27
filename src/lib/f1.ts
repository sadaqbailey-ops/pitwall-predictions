// Thin, typed layer over the Jolpica F1 API (the Ergast-compatible successor).
// Every call is server-side and cached, so pages never hit the API per request.

export const SEASON = 2026;
const BASE = "https://api.jolpi.ca/ergast/f1";

const DAY = 60 * 60 * 24;
const FIVE_MIN = 60 * 5;

export type Race = {
  season: number;
  round: number;
  name: string;
  circuit: string;
  locality: string;
  country: string;
  raceStart: Date;
  qualifyingStart: Date | null;
  hasSprint: boolean;
};

export type Driver = {
  driverId: string;
  code: string;
  givenName: string;
  familyName: string;
  number: string;
  teamId: string;
  teamName: string;
};

export type ClassifiedDriver = Driver & {
  position: number;
  grid: number;
  status: string;
  fastestLapRank: number | null;
};

export type RaceResult = {
  round: number;
  classification: ClassifiedDriver[];
};

type ApiSession = { date: string; time?: string };
type ApiRace = {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: { circuitName: string; Location: { locality: string; country: string } };
  Qualifying?: ApiSession;
  Sprint?: ApiSession;
};
type ApiDriver = {
  driverId: string;
  code: string;
  givenName: string;
  familyName: string;
  permanentNumber?: string;
};
type ApiResult = {
  number: string;
  position: string;
  grid: string;
  status: string;
  Driver: ApiDriver;
  Constructor: { constructorId: string; name: string };
  FastestLap?: { rank: string };
};
type ApiQualifying = { position: string; Driver: ApiDriver };

const MAX_ATTEMPTS = 4;

/**
 * The API allows a few requests per second and a few hundred per hour. Responses are cached
 * (so normal traffic barely touches it), and a 429 or 5xx is retried with backoff,
 * honouring Retry-After when the API sends one.
 */
async function api<T>(path: string, revalidate: number): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
    if (res.ok) {
      const body = (await res.json()) as { MRData: T };
      return body.MRData;
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      throw new Error(`F1 data API ${res.status} for ${path}`);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 8) * 1000 : 400 * 2 ** attempt;
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

function sessionDate(s: ApiSession | undefined): Date | null {
  if (!s) return null;
  return new Date(`${s.date}T${s.time ?? "00:00:00Z"}`);
}

export async function getSchedule(season = SEASON): Promise<Race[]> {
  const data = await api<{ RaceTable: { Races: ApiRace[] } }>(`/${season}.json?limit=40`, DAY);
  return data.RaceTable.Races.map((r) => ({
    season: Number(r.season),
    round: Number(r.round),
    name: r.raceName,
    circuit: r.Circuit.circuitName,
    locality: r.Circuit.Location.locality,
    country: r.Circuit.Location.country,
    raceStart: sessionDate({ date: r.date, time: r.time })!,
    qualifyingStart: sessionDate(r.Qualifying),
    hasSprint: Boolean(r.Sprint),
  }));
}

export async function getRace(round: number, season = SEASON): Promise<Race | null> {
  const schedule = await getSchedule(season);
  return schedule.find((r) => r.round === round) ?? null;
}

function toDriver(r: ApiResult): Driver {
  return {
    driverId: r.Driver.driverId,
    code: r.Driver.code,
    givenName: r.Driver.givenName,
    familyName: r.Driver.familyName,
    number: r.Driver.permanentNumber ?? r.number,
    teamId: r.Constructor.constructorId,
    teamName: r.Constructor.name,
  };
}

/** Every race result of the season, keyed by round. Paginates the API (100 rows per page). */
export async function getSeasonResults(season = SEASON): Promise<Map<number, RaceResult>> {
  const byRound = new Map<number, RaceResult>();
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const data = await api<{
      total: string;
      RaceTable: { Races: (ApiRace & { Results: ApiResult[] })[] };
    }>(`/${season}/results.json?limit=100&offset=${offset}`, FIVE_MIN);
    total = Number(data.total);
    for (const race of data.RaceTable.Races) {
      const round = Number(race.round);
      const entry = byRound.get(round) ?? { round, classification: [] };
      for (const r of race.Results) {
        entry.classification.push({
          ...toDriver(r),
          position: Number(r.position),
          grid: Number(r.grid),
          status: r.status,
          fastestLapRank: r.FastestLap ? Number(r.FastestLap.rank) : null,
        });
      }
      byRound.set(round, entry);
    }
    offset += 100;
    if (data.RaceTable.Races.length === 0) break;
  }
  for (const entry of byRound.values()) entry.classification.sort((a, b) => a.position - b.position);
  return byRound;
}

export async function getResult(round: number, season = SEASON): Promise<RaceResult | null> {
  return (await getSeasonResults(season)).get(round) ?? null;
}

/**
 * The drivers to pick from for a round. Uses that round's classification when the race
 * has run; otherwise the most recent classification, which is the current grid.
 */
export async function getEntryList(round: number, season = SEASON): Promise<Driver[]> {
  const results = await getSeasonResults(season);
  const own = results.get(round);
  const source = own ?? [...results.values()].sort((a, b) => b.round - a.round)[0];
  if (!source) return [];
  return source.classification
    .map(
      (d): Driver => ({
        driverId: d.driverId,
        code: d.code,
        givenName: d.givenName,
        familyName: d.familyName,
        number: d.number,
        teamId: d.teamId,
        teamName: d.teamName,
      }),
    )
    .sort((a, b) => a.teamName.localeCompare(b.teamName) || a.familyName.localeCompare(b.familyName));
}

/** Qualifying order for a round as driverId -> grid position, once qualifying has run. */
export async function getQualifyingOrder(round: number, season = SEASON): Promise<Map<string, number>> {
  const data = await api<{ RaceTable: { Races: { QualifyingResults: ApiQualifying[] }[] } }>(
    `/${season}/${round}/qualifying.json?limit=30`,
    FIVE_MIN,
  );
  const rows = data.RaceTable.Races[0]?.QualifyingResults ?? [];
  return new Map(rows.map((q) => [q.Driver.driverId, Number(q.position)]));
}

export type RacePhase = "open" | "locked" | "finished";

/** Picks are open until lights out, locked during the race, finished once results exist. */
export function racePhase(race: Race, hasResult: boolean, now = new Date()): RacePhase {
  if (hasResult) return "finished";
  return now < race.raceStart ? "open" : "locked";
}

export async function getNextRace(season = SEASON, now = new Date()): Promise<Race | null> {
  const schedule = await getSchedule(season);
  return schedule.find((r) => r.raceStart > now) ?? null;
}

export function driverName(d: Pick<Driver, "givenName" | "familyName">): string {
  return `${d.givenName} ${d.familyName}`;
}

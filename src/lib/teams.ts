// Constructor ids as they appear in the F1 data API for the 2026 season.
export const TEAMS = {
  mercedes: { name: "Mercedes", color: "#27F4D2" },
  ferrari: { name: "Ferrari", color: "#E8002D" },
  red_bull: { name: "Red Bull", color: "#3671C6" },
  mclaren: { name: "McLaren", color: "#FF8000" },
  aston_martin: { name: "Aston Martin", color: "#229971" },
  alpine: { name: "Alpine", color: "#FF87BC" },
  williams: { name: "Williams", color: "#64C4FF" },
  rb: { name: "Racing Bulls", color: "#6692FF" },
  haas: { name: "Haas", color: "#B6BABD" },
  audi: { name: "Audi", color: "#F50537" },
  cadillac: { name: "Cadillac", color: "#C9B37E" },
} as const;

export type TeamId = keyof typeof TEAMS;

export const TEAM_IDS = Object.keys(TEAMS) as TeamId[];

export function isTeamId(value: string): value is TeamId {
  return value in TEAMS;
}

export function teamColor(teamId: string | null | undefined): string {
  return teamId && isTeamId(teamId) ? TEAMS[teamId].color : "#E10600";
}

export function teamName(teamId: string | null | undefined): string {
  return teamId && isTeamId(teamId) ? TEAMS[teamId].name : "Independent";
}

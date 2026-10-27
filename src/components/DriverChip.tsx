import type { Driver } from "@/lib/f1";
import { teamColor } from "@/lib/teams";

export type DriverLite = Pick<Driver, "driverId" | "code" | "givenName" | "familyName" | "number" | "teamId" | "teamName">;

/** Compact driver label with the team colour stripe, used across scorecards and tables. */
export function DriverChip({ driver, size = "md" }: { driver: DriverLite | undefined; size?: "sm" | "md" }) {
  if (!driver) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-5 w-1 rounded-full" style={{ background: teamColor(driver.teamId) }} aria-hidden />
      <span className="font-display font-bold tracking-wide">{driver.code}</span>
      {size === "md" && <span className="text-muted">{driver.familyName}</span>}
    </span>
  );
}

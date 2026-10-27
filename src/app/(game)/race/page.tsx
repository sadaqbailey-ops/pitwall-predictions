import { redirect } from "next/navigation";
import { getNextRace, getSchedule } from "@/lib/f1";

// "/race" always means the race weekend that's coming up (or the finale once the season is over).
export default async function CurrentRace() {
  const next = await getNextRace();
  if (next) redirect(`/race/${next.round}`);
  const schedule = await getSchedule();
  redirect(`/race/${schedule.at(-1)?.round ?? 1}`);
}

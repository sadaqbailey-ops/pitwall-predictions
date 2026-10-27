"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { joinDemoLeague } from "@/lib/leagues";
import { isTeamId } from "@/lib/teams";
import type { FormState } from "./leagues";

export async function saveProfile(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const displayName = String(form.get("displayName") ?? "").trim().replace(/\s+/g, " ");
  const favoriteTeam = String(form.get("favoriteTeam") ?? "");
  const next = String(form.get("next") ?? "/race");

  if (displayName.length < 2 || displayName.length > 24) {
    return { error: "Pick a name between 2 and 24 characters." };
  }
  if (!isTeamId(favoriteTeam)) return { error: "Choose the team you support." };

  await db
    .insert(profiles)
    .values({ userId, displayName, favoriteTeam })
    .onConflictDoUpdate({ target: profiles.userId, set: { displayName, favoriteTeam } });
  // Belt and braces: covers accounts created before the demo league was seeded.
  await joinDemoLeague(userId);

  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/race");
}

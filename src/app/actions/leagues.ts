"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { leagueMembers, leagues } from "@/db/schema";
import { generateInviteCode, normalizeInviteCode } from "@/lib/leagues";

export type FormState = { error?: string } | undefined;

const MAX_LEAGUES_PER_OWNER = 10;

export async function createLeague(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 40) return { error: "League names are 3 to 40 characters." };

  const owned = await db.select({ id: leagues.id }).from(leagues).where(eq(leagues.ownerId, userId));
  if (owned.length >= MAX_LEAGUES_PER_OWNER) {
    return { error: `You can run up to ${MAX_LEAGUES_PER_OWNER} leagues.` };
  }

  // Codes are random; on the rare collision, roll again.
  let leagueId: string | null = null;
  for (let attempt = 0; attempt < 5 && !leagueId; attempt++) {
    const [row] = await db
      .insert(leagues)
      .values({ name, inviteCode: generateInviteCode(), ownerId: userId })
      .onConflictDoNothing({ target: leagues.inviteCode })
      .returning({ id: leagues.id });
    leagueId = row?.id ?? null;
  }
  if (!leagueId) return { error: "Couldn't create the league. Try again." };

  await db.insert(leagueMembers).values({ leagueId, userId });
  revalidatePath("/leagues");
  redirect(`/leagues/${leagueId}?created=1`);
}

export async function joinLeague(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const code = normalizeInviteCode(String(form.get("code") ?? ""));
  if (code.length !== 6) return { error: "Invite codes are 6 characters." };

  const [league] = await db.select().from(leagues).where(eq(leagues.inviteCode, code)).limit(1);
  if (!league) return { error: `No league with code ${code}. Check it with whoever sent it.` };

  // Joining twice is harmless: the membership already exists.
  await db.insert(leagueMembers).values({ leagueId: league.id, userId }).onConflictDoNothing();
  revalidatePath("/leagues");
  redirect(`/leagues/${league.id}`);
}

export async function leaveLeague(leagueId: string): Promise<void> {
  const userId = await requireUserId();
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  // The demo league is permanent, and owners can't strand their own league.
  if (!league || league.isDemo || league.ownerId === userId) return;
  await db
    .delete(leagueMembers)
    .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)));
  revalidatePath("/leagues");
  redirect("/leagues");
}

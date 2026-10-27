import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { profiles, type Profile } from "@/db/schema";

// Memoised per request: the layout and the page both ask, the database is hit once.
export const getSession = cache(() => auth());

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return row ?? null;
});

/** Signed in and onboarded, or redirected to whichever step is missing. */
export async function requirePlayer(next = "/race"): Promise<{ userId: string; profile: Profile }> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) redirect(`/?next=${encodeURIComponent(next)}`);
  const profile = await getProfile(userId);
  if (!profile) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  return { userId, profile };
}

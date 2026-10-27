import type { CSSProperties } from "react";
import { Nav } from "@/components/Nav";
import { getProfile, getSession } from "@/lib/session";
import { teamColor, teamName } from "@/lib/teams";

// Everything in here needs a signed-in, onboarded player. Each page calls requirePlayer()
// with its own path, so a redirect to sign-in can bring you back to the exact page.
export default async function GameLayout({ children }: LayoutProps<"/">) {
  const userId = (await getSession())?.user?.id;
  const profile = userId ? await getProfile(userId) : null;
  if (!profile) return <>{children}</>;

  return (
    <div className="flex flex-1 flex-col" style={{ "--accent": teamColor(profile.favoriteTeam) } as CSSProperties}>
      <Nav displayName={profile.displayName} teamName={teamName(profile.favoriteTeam)} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

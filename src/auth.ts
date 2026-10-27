import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { joinDemoLeague } from "@/lib/leagues";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Sessions live in Postgres, so signing out or deleting a user takes effect immediately.
  session: { strategy: "database" },
  // Vercel sets this automatically; `next start` anywhere else needs it explicitly.
  trustHost: true,
  providers: [Google],
  pages: { signIn: "/" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    // Every new player lands in the demo league so the standings are never empty.
    async createUser({ user }) {
      if (user.id) await joinDemoLeague(user.id);
    },
  },
});

/** For server components and actions: the signed-in user's id, or a redirect to the landing page. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/");
  return id;
}

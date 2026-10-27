import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/components/Nav";
import { getProfile } from "@/lib/session";
import { ProfileForm } from "./ProfileForm";

export default async function Onboarding({ searchParams }: PageProps<"/onboarding">) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const { next } = await searchParams;
  const profile = await getProfile(userId);
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/race";
  if (profile) redirect(nextPath);

  const firstName = session.user?.name?.split(" ")[0] ?? "";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Logo />
      <h1 className="mt-10 font-display text-5xl font-extrabold uppercase">
        Welcome to the paddock
      </h1>
      <p className="mt-2 text-muted">Two quick things, then you&apos;re on the grid.</p>
      <ProfileForm
        next={nextPath}
        defaultName={firstName}
        defaultTeam=""
      />
    </main>
  );
}

"use client";

import { useActionState, useState } from "react";
import { saveProfile } from "@/app/actions/profile";
import { TEAM_IDS, TEAMS } from "@/lib/teams";

export function ProfileForm({
  next,
  defaultName,
  defaultTeam,
}: {
  next: string;
  defaultName: string;
  defaultTeam: string;
}) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const [team, setTeam] = useState(defaultTeam);

  return (
    <form action={action} className="mt-8 space-y-8">
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="text-xs uppercase tracking-[0.25em] text-muted">What should the league call you?</span>
        <input
          name="displayName"
          defaultValue={defaultName}
          required
          minLength={2}
          maxLength={24}
          className="mt-2 w-full rounded-md border border-line bg-surface px-4 py-3 text-lg outline-none focus:border-foreground"
        />
      </label>

      <fieldset>
        <legend className="text-xs uppercase tracking-[0.25em] text-muted">Who do you support?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEAM_IDS.map((id) => (
            <label
              key={id}
              className="relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-md border-2 bg-surface px-4 py-3 transition"
              style={{ borderColor: team === id ? TEAMS[id].color : "var(--line)" }}
            >
              <input
                type="radio"
                name="favoriteTeam"
                value={id}
                checked={team === id}
                onChange={() => setTeam(id)}
                className="sr-only"
              />
              <span className="h-6 w-1.5 rounded-full" style={{ background: TEAMS[id].color }} />
              <span className="font-display text-lg font-bold uppercase">{TEAMS[id].name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error && <p className="text-red-400">{state.error}</p>}

      <button
        disabled={pending || !team}
        className="rounded-md px-6 py-3 font-display text-xl font-bold uppercase tracking-wide text-black transition disabled:opacity-40"
        style={{ background: team ? TEAMS[team as keyof typeof TEAMS].color : "var(--muted)" }}
      >
        {pending ? "Saving…" : "Let's go racing"}
      </button>
    </form>
  );
}

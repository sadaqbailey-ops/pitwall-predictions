"use client";

import { useActionState, useState } from "react";
import { createLeague, joinLeague } from "@/app/actions/leagues";

const input =
  "w-full rounded-md border border-line bg-surface-2 px-4 py-2.5 outline-none focus:border-foreground";
const button =
  "rounded-md bg-accent px-5 py-2.5 font-display text-lg font-bold uppercase tracking-wide text-black disabled:opacity-40";

export function CreateLeagueForm() {
  const [state, action, pending] = useActionState(createLeague, undefined);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input name="name" placeholder="Sunday Sofa GP" required minLength={3} maxLength={40} className={input} />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className={button}>
        {pending ? "Creating…" : "Create league"}
      </button>
    </form>
  );
}

export function JoinLeagueForm({ code = "" }: { code?: string }) {
  const [state, action, pending] = useActionState(joinLeague, undefined);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input
        name="code"
        defaultValue={code}
        placeholder="ABC234"
        required
        maxLength={8}
        autoCapitalize="characters"
        className={`${input} font-mono uppercase tracking-[0.3em]`}
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className={button}>
        {pending ? "Joining…" : "Join league"}
      </button>
    </form>
  );
}

export function CopyInvite({ code, url }: { code: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-md border border-dashed border-accent px-4 py-2 font-mono text-xl font-bold tracking-[0.35em]">
        {code}
      </span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className="rounded-md border border-line px-4 py-2 text-sm hover:border-foreground"
      >
        {copied ? "Link copied" : "Copy invite link"}
      </button>
    </div>
  );
}

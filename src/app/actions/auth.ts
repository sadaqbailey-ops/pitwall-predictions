"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithGoogle(form: FormData) {
  const next = String(form.get("next") ?? "/race");
  await signIn("google", { redirectTo: next.startsWith("/") ? next : "/race" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

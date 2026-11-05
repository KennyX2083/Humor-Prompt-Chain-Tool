import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";

export const readAccess = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { status: "signed-out" as const, supabase, user: null };
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("is_superadmin").eq("id", user.id).single();
  if (profileError || !profile) return { status: "error" as const, supabase, user };
  return { status: profile.is_superadmin === true ? "admin" as const : "denied" as const, supabase, user };
});

export async function adminContext() {
  const access = await readAccess();
  return access.status === "admin" && access.user
    ? { supabase: access.supabase, user: access.user }
    : null;
}

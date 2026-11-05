"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminContext } from "../lib/admin";
import { isChainId } from "../lib/validation";
import type { ActionState } from "../lib/types";

export async function editChain(_previous: ActionState, form: FormData): Promise<ActionState> {
  let result: ActionState & { destination?: string };
  try {
    result = await changeRecord(form);
  } catch {
    return { error: "Could not reach the server. Your edits are still here; try again." };
  }
  if (result.error) return { error: result.error };
  revalidatePath("/");
  // Next.js redirects throw internally; keep them outside the error handler.
  if (result.destination) redirect(result.destination);
  return { message: result.message };
}

async function changeRecord(form: FormData): Promise<ActionState & { destination?: string }> {
  const context = await adminContext();
  if (!context) return { error: "Administrator access required. Sign in with a superadmin account." };
  const { supabase } = context;
  const kind = String(form.get("kind") ?? "");
  const intent = String(form.get("intent") ?? "save");
  const id = String(form.get("id") ?? "");
  const chainId = String(form.get("chain_id") ?? "");
  if ((id && !isChainId(id)) || (chainId && !isChainId(chainId))) return { error: "Invalid record." };
  if (!["chain", "step"].includes(kind) || !["save", "delete", "up", "down"].includes(intent)) return { error: "Invalid action." };
  if (kind === "step" && !isChainId(chainId)) return { error: "Choose a chain first." };

  if (intent === "up" || intent === "down") {
    if (kind !== "step" || !id) return { error: "Choose a step to move." };
    const { error } = await supabase.rpc("studio_move_step", {
      p_step_id: id, p_chain_id: chainId, p_direction: intent === "up" ? -1 : 1,
    });
    return error ? { error: "Could not move the step. Refresh and try again." } : { message: "Step moved." };
  }

  if (intent === "delete") {
    if (!id || form.get("confirm_delete") !== "on") return { error: "Select the confirmation checkbox before deleting." };
    if (kind === "step") {
      const { error } = await supabase.rpc("studio_delete_step", { p_step_id: id, p_chain_id: chainId });
      if (error?.code === "23514") return { error: "Set this chain's live weight to 0 before deleting its last step." };
      return error ? { error: "Could not delete the step. Refresh and try again." } : { message: "Step deleted." };
    }
    const { error } = await supabase.rpc("studio_delete_chain", { p_chain_id: id });
    return error ? { error: "Could not delete the chain. Refresh and try again." }
      : { message: "Chain deleted.", destination: "/" };
  }

  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 100) return { error: "Enter a name between 1 and 100 characters." };
  if (kind === "chain") {
    const description = String(form.get("description") ?? "").trim();
    if (description.length > 2000) return { error: "Keep the description within 2,000 characters." };
    // Separate payloads avoid the earlier union-type insert error.
    const slug = String(form.get("slug") ?? "").trim();
    const rawWeight = String(form.get("weight") ?? "0");
    const weight = Number(rawWeight);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) return { error: "Use a unique slug of lowercase letters, numbers, and hyphens (up to 100 characters)." };
    if (!/^\d+$/.test(rawWeight) || !Number.isInteger(weight) || weight < 0 || weight > 10000) return { error: "Weight must be a whole number from 0 to 10,000." };
    const result = await supabase.rpc("studio_save_chain", { p_id: id || null, p_name: name, p_slug: slug, p_description: description, p_weight: weight });
    if (result.error?.code === "23505") return { error: "That slug is already in use. Choose another." };
    if (result.error?.code === "23514") return { error: "Add at least one step before setting a positive live weight." };
    if (result.error || !Number.isSafeInteger(Number(result.data)) || Number(result.data) < 1) return { error: "Could not save the shared chain. Check the integration SQL has been applied." };
    return { message: "Chain saved.", ...(!id ? { destination: "/?chain=" + String(result.data) } : {}) };
  }

  const instructions = String(form.get("instructions") ?? "").trim();
  if (!instructions || instructions.length > 8000) return { error: "Enter instructions between 1 and 8,000 characters." };
  if (id) {
    const { data, error } = await supabase.from("prompt_chain_steps").update({ name, instructions })
      .eq("id", id).eq("chain_id", chainId).select("id").single();
    return error || !data ? { error: "Could not save the step. Your edits are still here." } : { message: "Step saved." };
  }
  const { data, error } = await supabase.rpc("studio_append_step", { p_chain_id: chainId, p_name: name, p_instructions: instructions });
  return error || !Number.isSafeInteger(Number(data)) || Number(data) < 1 ? { error: "Could not add the step. A chain supports up to 10 steps." } : { message: "Step added." };
}

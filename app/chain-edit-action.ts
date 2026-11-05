"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminContext } from "../lib/admin";
import { uuid } from "../lib/validation";
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
  if ((id && !uuid.test(id)) || (chainId && !uuid.test(chainId))) return { error: "Invalid record." };
  if (!["chain", "step"].includes(kind) || !["save", "delete", "up", "down"].includes(intent)) return { error: "Invalid action." };
  if (kind === "step" && !uuid.test(chainId)) return { error: "Choose a chain first." };

  if (intent === "up" || intent === "down") {
    if (kind !== "step" || !id) return { error: "Choose a step to move." };
    const { error } = await supabase.rpc("move_prompt_tool_step", {
      p_step_id: id, p_chain_id: chainId, p_direction: intent === "up" ? -1 : 1,
    });
    return error ? { error: "Could not move the step. Refresh and try again." } : { message: "Step moved." };
  }

  if (intent === "delete") {
    if (!id || form.get("confirm_delete") !== "on") return { error: "Select the confirmation checkbox before deleting." };
    if (kind === "step") {
      const { error } = await supabase.rpc("delete_prompt_tool_step", { p_step_id: id, p_chain_id: chainId });
      return error ? { error: "Could not delete the step. Refresh and try again." } : { message: "Step deleted." };
    }
    const { data, error } = await supabase.from("prompt_tool_chains").delete().eq("id", id).select("id").single();
    return error || !data ? { error: "Could not delete the chain. Refresh and try again." }
      : { message: "Chain deleted.", destination: "/" };
  }

  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 100) return { error: "Enter a name between 1 and 100 characters." };
  if (kind === "chain") {
    const description = String(form.get("description") ?? "").trim();
    if (description.length > 2000) return { error: "Keep the description within 2,000 characters." };
    // Separate payloads avoid the earlier union-type insert error.
    const result = id
      ? await supabase.from("prompt_tool_chains").update({ name, description }).eq("id", id).select("id").single()
      : await supabase.from("prompt_tool_chains").insert({ name, description }).select("id").single();
    if (result.error || !result.data || typeof result.data.id !== "string") return { error: "Could not save the chain. Your edits are still here." };
    return { message: "Chain saved.", ...(!id ? { destination: `/?chain=${result.data.id}` } : {}) };
  }

  const instructions = String(form.get("instructions") ?? "").trim();
  if (!instructions || instructions.length > 8000) return { error: "Enter instructions between 1 and 8,000 characters." };
  if (id) {
    const { data, error } = await supabase.from("prompt_tool_steps").update({ name, instructions })
      .eq("id", id).eq("chain_id", chainId).select("id").single();
    return error || !data ? { error: "Could not save the step. Your edits are still here." } : { message: "Step saved." };
  }
  const { data, error } = await supabase.rpc("append_prompt_tool_step", { p_chain_id: chainId, p_name: name, p_instructions: instructions });
  return error || typeof data !== "string" ? { error: "Could not add the step. A chain supports up to 20 steps." } : { message: "Step added." };
}

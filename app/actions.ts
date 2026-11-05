"use server";

import { editChain as edit } from "./chain-edit-action";
import { runChain as run } from "./run-chain-action";
import type { ActionState } from "../lib/types";

export async function editChain(previous: ActionState, form: FormData): Promise<ActionState> {
  return edit(previous, form);
}

export async function runChain(previous: ActionState, form: FormData): Promise<ActionState> {
  return run(previous, form);
}

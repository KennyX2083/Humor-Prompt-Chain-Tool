"use server";

import { revalidatePath } from "next/cache";
import { GoogleGenAI } from "@google/genai";
import { adminContext } from "../lib/admin";
import { imageMime, isChainId } from "../lib/validation";
import { gameCharacters } from "../lib/game-characters";
import { runPromptChain, type PromptStep } from "../lib/run-prompt-chain";
import type { ActionState, Output } from "../lib/types";

export async function runChain(_previous: ActionState, form: FormData): Promise<ActionState> {
  try { return await generate(form); }
  catch { return { error: "Could not complete the test. Refresh history for any saved progress." }; }
  finally { revalidatePath("/"); }
}

async function generate(form: FormData): Promise<ActionState> {
  const deadline = Date.now() + 240000;
  const context = await adminContext();
  if (!context) return { error: "Administrator access required." };
  const { supabase, user } = context;
  const chainId = String(form.get("chain_id") ?? "");
  const game = String(form.get("game") ?? "");
  const character = String(form.get("character") ?? "").trim();
  const situation = String(form.get("situation") ?? "").trim();
  if (!isChainId(chainId) || !["valorant", "league", "overwatch"].includes(game) || situation.length < 5 || situation.length > 1000) return { error: "Select a game and describe the situation in 5–1,000 characters." };
  const canonicalCharacter = (gameCharacters[game] ?? []).find(name => name.toLowerCase() === character.toLowerCase());
  if (character && !canonicalCharacter) return { error: "Choose a character from the selected game's roster, or leave it blank." };
  const upload = form.get("image");
  const image = upload instanceof File && upload.size ? upload : null;
  if (image && image.size > 2000000) return { error: "Use an image under 2 MB." };
  const bytes = image ? new Uint8Array(await image.arrayBuffer()) : null;
  const mime = bytes ? imageMime(bytes) : null;
  if (image && (!mime || mime !== image.type)) return { error: "Use a valid PNG, JPEG, or WebP image." };
  if (!process.env.GEMINI_API_KEY?.trim()) return { error: "Set GEMINI_API_KEY on the server." };
  const [chain, steps, model] = await Promise.all([
    supabase.from("prompt_chains").select("id,name").eq("id", chainId).single(),
    supabase.from("prompt_chain_steps").select("id,position,name,instructions").eq("chain_id", chainId).order("position").returns<PromptStep[]>(),
    supabase.from("llm_models").select("id,model_identifier,llm_providers!inner(name)").eq("is_enabled", true).eq("llm_providers.name", "Google").order("id").limit(1).maybeSingle(),
  ]);
  if (chain.error || !chain.data || steps.error || !steps.data?.length) return { error: "This shared chain needs at least one step." };
  if (model.error || !model.data) return { error: "Enable a Google model in the admin panel's Models page first." };
  const { data: request, error: requestError } = await supabase.from("generation_request").insert({ user_id: user.id, model_id: model.data.id, chain_id: Number(chainId), game, character_name: canonicalCharacter || null, situation, status: "pending" }).select("id").single();
  if (requestError || !request) return { error: "Could not record the shared generation request." };
  const { data: run, error: runError } = await supabase.from("prompt_tool_runs").insert({ shared_chain_id: Number(chainId), request_id: request.id, chain_name: chain.data.name, user_id: user.id, input: JSON.stringify({ game, character: canonicalCharacter || null, situation, ...(image ? { image: image.name.slice(0,200) } : {}) }), outputs: [] }).select("id").single();
  if (runError || !run) {
    await supabase.from("generation_request").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", request.id);
    return { error: "Could not save test history. Apply the current database/setup.sql integration first." };
  }
  const outputs: Output[] = [];
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let calls = 0;
  let specificError = "";
  const result = await runPromptChain({
    steps: steps.data,
    context: { game: game === "valorant" ? "Valorant" : game === "league" ? "League of Legends" : "Overwatch", character: canonicalCharacter || "Not specified", situation },
    generate: async prompt => {
      const remaining = deadline - Date.now();
      if (remaining < 15000) { specificError = "Test reached its time limit. Completed outputs are saved."; throw new Error("Time limit"); }
      const response = await ai.models.generateContent({
        model: model.data!.model_identifier,
        contents: [{ role: "user", parts: [{ text: prompt }, ...(bytes && mime && calls++ === 0 ? [{ inlineData: { mimeType: mime, data: Buffer.from(bytes).toString("base64") } }] : [])] }],
        config: { maxOutputTokens: 2048, httpOptions: { timeout: Math.min(45000, remaining - 10000), retryOptions: { attempts: 1 } } },
      });
      return { text: response.text ?? "", inputTokens: response.usageMetadata?.promptTokenCount ?? null, outputTokens: response.usageMetadata?.candidatesTokenCount ?? null };
    },
    record: async step => {
      const metadata = steps.data!.find(item => item.id === step.stepId)!;
      const log = await supabase.from("llm_response").insert({ request_id: request.id, chain_id: Number(chainId), step_id: step.stepId, prompt: step.prompt, output: step.output, error: step.error, duration_ms: step.durationMs, input_tokens: step.inputTokens, output_tokens: step.outputTokens });
      if (step.output) outputs.push({ name: metadata.name, instructions: metadata.instructions, output: step.output });
      const checkpoint = await supabase.from("prompt_tool_runs").update({ outputs }).eq("id", run.id).select("id").single();
      return !log.error && !checkpoint.error && !!checkpoint.data;
    },
  });
  const failure = specificError || result.error || null;
  const [savedRequest, savedRun] = await Promise.all([
    supabase.from("generation_request").update({ status: failure ? "failed" : "succeeded", completed_at: new Date().toISOString() }).eq("id", request.id).select("id").single(),
    supabase.from("prompt_tool_runs").update({ outputs, error: failure, finished_at: new Date().toISOString() }).eq("id", run.id).select("id").single(),
  ]);
  if (savedRequest.error || savedRun.error || !savedRequest.data || !savedRun.data) return { error: "The test finished, but its final status could not be saved. Refresh history." };
  return failure ? { error: failure } : { message: "Test complete. The output is saved here and in the admin generation logs; it has not been published as an excuse." };
}

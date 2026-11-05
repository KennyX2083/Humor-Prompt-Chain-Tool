import "server-only";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { runPromptChain, type PromptStep } from "./run-prompt-chain";
import { choosePromptChain, type ChainMixEntry } from "./prompt-chain-mix";

type Result = { ok: true; excuse: string; prompt: string } | { ok: false; error: string; status: number };

// Called only by the route AFTER getUser() and roster/input validation.
// Service access keeps model configurations/prompts private from normal clients.
export async function generateFromSharedChain(context: { userId: string; game: string; character: string; situation: string }): Promise<Result> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!url || !key || !apiKey) return { ok: false, status: 503, error: "Shared excuse generation is not configured." };
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: mix, error: mixError, count } = await db.from("prompt_chain_mix").select("chain_id,weight,prompt_chains(id,name,slug)", { count: "exact" }).gt("weight", 0).order("chain_id").limit(1000).returns<ChainMixEntry[]>();
  if (mixError || (count ?? 0) > 1000) return { ok: false, status: 503, error: "Could not load the prompt chain mix." };
  const chain = choosePromptChain(mix ?? []);
  if (!chain) return { ok: false, status: 503, error: "No active excuse chains are available." };
  const [steps, model] = await Promise.all([
    db.from("prompt_chain_steps").select("id,position,name,instructions").eq("chain_id", chain.id).order("position").returns<PromptStep[]>(),
    db.from("llm_models").select("id,model_identifier,llm_providers!inner(name)").eq("is_enabled", true).eq("llm_providers.name", "Google").order("id").limit(1).maybeSingle(),
  ]);
  if (steps.error || !steps.data?.length || model.error || !model.data) return { ok: false, status: 503, error: "An active chain or enabled Google model is unavailable." };
  const { data: request, error } = await db.from("generation_request").insert({ user_id: context.userId, model_id: model.data.id, chain_id: chain.id, game: context.game, character_name: context.character || null, situation: context.situation, status: "pending" }).select("id").single();
  if (error || !request) return { ok: false, status: 500, error: "Could not record the generation request." };
  const ai = new GoogleGenAI({ apiKey });
  const deadline = Date.now() + 240000;
  const result = await runPromptChain({
    steps: steps.data,
    context: { game: context.game === "valorant" ? "Valorant" : context.game === "league" ? "League of Legends" : "Overwatch", character: context.character || "Not specified", situation: context.situation },
    generate: async prompt => {
      const remaining = deadline - Date.now();
      if (remaining < 15000) throw new Error("Chain time limit reached");
      const response = await ai.models.generateContent({ model: model.data!.model_identifier, contents: prompt, config: { maxOutputTokens: 2048, httpOptions: { timeout: Math.min(45000, remaining - 10000), retryOptions: { attempts: 1 } } } });
      return { text: response.text ?? "", inputTokens: response.usageMetadata?.promptTokenCount ?? null, outputTokens: response.usageMetadata?.candidatesTokenCount ?? null };
    },
    record: async step => {
      const saved = await db.from("llm_response").insert({ request_id: request.id, chain_id: chain.id, step_id: step.stepId, prompt: step.prompt, output: step.output, error: step.error, duration_ms: step.durationMs, input_tokens: step.inputTokens, output_tokens: step.outputTokens });
      return !saved.error;
    },
  });
  const saved = await db.from("generation_request").update({ status: result.error ? "failed" : "succeeded", completed_at: new Date().toISOString() }).eq("id", request.id).select("id").single();
  if (saved.error || !saved.data || result.loggingFailed) return { ok: false, status: 500, error: "Could not save generation history." };
  if (result.error) return { ok: false, status: 502, error: "The prompt chain could not generate a usable excuse. Please try again." };
  return { ok: true, excuse: result.output, prompt: result.lastPrompt.length <= 2000 ? result.lastPrompt : "Prompt chain: " + chain.name + ". Generation request: " + request.id + ". Full prompts are in the response log." };
}

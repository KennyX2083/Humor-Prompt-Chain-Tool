"use client";

import { useActionState, useRef, useState } from "react";
import { editChain, runChain } from "../actions";
import { gameCharacters } from "../../lib/game-characters";
import CharacterAutocomplete from "./character-autocomplete";
import type { ActionState, Chain, Step } from "../../lib/types";

const emptyState: ActionState = {};

export function Editor({ chain, step, createStep, first, last }: {
  chain?: Chain; step?: Step; createStep?: boolean; first?: boolean; last?: boolean;
}) {
  const isStep = !!step || !!createStep;
  const [name, setName] = useState(step?.name ?? (isStep ? "" : chain?.name) ?? "");
  const [description, setDescription] = useState(chain?.description ?? "");
  const [instructions, setInstructions] = useState(step?.instructions ?? "");
  const [slug, setSlug] = useState(chain?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!chain);
  const [weight, setWeight] = useState(String(chain?.weight ?? 0));
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(async (previous: ActionState, form: FormData) => {
    const result = await editChain(previous, form);
    if (!result.error) {
      setConfirmed(false);
      if (result.message === "Step added.") { setName(""); setInstructions(""); }
    }
    return result;
  }, emptyState);

  return <form action={action} className="editor" aria-label={isStep ? "Prompt step editor" : "Prompt chain editor"}>
    <input type="hidden" name="kind" value={isStep ? "step" : "chain"} />
    <input type="hidden" name="id" value={step?.id ?? (isStep ? "" : chain?.id) ?? ""} />
    <input type="hidden" name="chain_id" value={chain?.id ?? ""} />
    <fieldset disabled={pending}>
      <label>Name<input name="name" value={name} onChange={e => { setName(e.target.value); if (!isStep && !slugTouched) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g, "").slice(0,100)); }} required maxLength={100} placeholder={isStep ? "e.g. Invent the final excuse" : "e.g. Explain the misplay"} /></label>
      {isStep ? <label>Instructions<textarea name="instructions" value={instructions} onChange={e => setInstructions(e.target.value)} required maxLength={8000} rows={5} placeholder="Describe what this step should produce. It receives the original input and previous step's output." /><span className="field-hint">{instructions.length}/8,000 characters</span></label>
        : <label>Description<textarea name="description" value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={2} placeholder="What does this chain create?" /></label>}
      {!isStep ? <>
        <label>Slug<input name="slug" value={slug} onChange={e => { setSlug(e.target.value); setSlugTouched(true); }} required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="e.g. explain-the-misplay" /><span className="field-hint">Unique lowercase identifier shared with the original app.</span></label>
        <label>Live selection weight<input type="number" name="weight" value={weight} onChange={e => setWeight(e.target.value)} min={0} max={10000} step={1} disabled={!chain} /><span className="field-hint">0 = inactive. Positive weights enter the original app&apos;s weighted chain mix. Add a step before activation.</span></label>
        {chain && chain.weight>0 ? <p className="live-notice">This chain is live. Saved edits change future excuse generations.</p> : null}
      </> : null}
      <div className="actions">
        <button type="submit" name="intent" value="save">{pending ? "Working…" : step || (!isStep && chain) ? "Save changes" : isStep ? "Add step" : "Create chain"}</button>
        {step ? <>
          <button type="submit" className="secondary" name="intent" value="up" disabled={first} formNoValidate aria-label={"Move " + step.name + " up"}>↑ Move up</button>
          <button type="submit" className="secondary" name="intent" value="down" disabled={last} formNoValidate aria-label={"Move " + step.name + " down"}>↓ Move down</button>
        </> : null}
      </div>
      {step || (!isStep && chain) ? <div className="delete-row">
        <label className="check"><input type="checkbox" name="confirm_delete" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirm deletion{isStep ? " of this step" : " of this chain and its steps. Existing generation logs and Studio history are retained."}</label>
        <button type="submit" className="danger" name="intent" value="delete" disabled={!confirmed} formNoValidate>Delete {isStep ? "step" : "chain"}</button>
      </div> : null}
    </fieldset>
    <Feedback state={state} pending={pending} />
  </form>;
}

export function RunForm({ chainId, disabled }: { chainId: number; disabled: boolean }) {
  const [input, setInput] = useState("");
  const [game, setGame] = useState("valorant");
  const [image, setImage] = useState<File | null>(null);
  const [clientError, setClientError] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(async (previous: ActionState, form: FormData) => {
    // Keep the selected file available after a validation/service error.
    if (image) form.set("image", image);
    const result = await runChain(previous, form);
    if (!result.error) {
      setImage(null);
      if (imageInput.current) imageInput.current.value = "";
    }
    return result;
  }, emptyState);
  return <form action={action} className="editor" aria-label="Run selected prompt chain" onSubmit={event => {
    let error = "";
    const character = String(new FormData(event.currentTarget).get("character") ?? "").trim();
    if (input.trim().length < 5) error = "Describe the gaming situation in at least five characters.";
    else if (character && !(gameCharacters[game] ?? []).some(name => name.toLowerCase() === character.toLowerCase())) error = "Choose a character from the selected game, or leave it blank.";
    else if (image && (image.size > 2_000_000 || !["image/png", "image/jpeg", "image/webp"].includes(image.type))) error = "Use a PNG, JPEG, or WebP image under 2 MB.";
    setClientError(error);
    if (error) event.preventDefault();
  }}>
    <input type="hidden" name="chain_id" value={chainId} />
    <fieldset disabled={pending || disabled}>
      <label>Game<select name="game" value={game} onChange={e => { setGame(e.target.value); setClientError(""); }}><option value="valorant">Valorant</option><option value="league">League of Legends</option><option value="overwatch">Overwatch</option></select></label>
      <div className="studio-character"><label htmlFor="character">{game === "valorant" ? "Agent" : game === "league" ? "Champion" : "Hero"} (optional)</label><CharacterAutocomplete key={game} options={gameCharacters[game] ?? []} placeholder="Search the selected game’s roster" /></div>
      <label>Gaming situation<textarea name="situation" value={input} onChange={e => setInput(e.target.value)} required minLength={5} maxLength={1000} rows={3} placeholder="e.g. I flashed my team and missed every shot." /><span className="field-hint">{input.length}/1,000 characters</span></label>
      <label>Optional image<input ref={imageInput} type="file" name="image" accept="image/png,image/jpeg,image/webp" onChange={e => { setImage(e.target.files?.[0] ?? null); setClientError(""); }} /></label>
      {image ? <div className="selected-image"><span>{image.name}</span><button type="button" className="secondary" onClick={() => { setImage(null); if (imageInput.current) imageInput.current.value = ""; }}>Remove image</button></div> : null}
      <p className="muted">Tests use the same Game/Character/Situation context and configured model as the original generator. An optional image (PNG/JPEG/WebP under 2 MB) is supplied to the first step only; public-app requests do not contain images. Tests are logged, not published.</p>
      <button type="submit">{pending ? "Running chain…" : "Run prompt chain"}</button>
    </fieldset>
    {disabled ? <p className="muted">Add a step to start generating.</p> : null}
    {pending ? <p className="run-progress" role="status">Running the steps in order. Completed outputs are saved as the chain progresses. Keep this page open.</p> : clientError ? <p role="alert">{clientError}</p> : <Feedback state={state} />}
  </form>;
}

function Feedback({ state, pending = false }: { state: ActionState; pending?: boolean }) {
  return <><p role="status" aria-live="polite">{pending ? "Working…" : state.message}</p>{!pending && state.error ? <p role="alert">{state.error}</p> : null}</>;
}

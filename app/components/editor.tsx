"use client";

import { useActionState, useRef, useState } from "react";
import { editChain, runChain } from "../actions";
import type { ActionState, Chain, Step } from "../../lib/types";

const emptyState: ActionState = {};

export function Editor({ chain, step, createStep, first, last }: {
  chain?: Chain; step?: Step; createStep?: boolean; first?: boolean; last?: boolean;
}) {
  const isStep = !!step || !!createStep;
  const [name, setName] = useState(step?.name ?? (isStep ? "" : chain?.name) ?? "");
  const [description, setDescription] = useState(chain?.description ?? "");
  const [instructions, setInstructions] = useState(step?.instructions ?? "");
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
      <label>Name<input name="name" value={name} onChange={e => setName(e.target.value)} required maxLength={100} placeholder={isStep ? "e.g. Write five captions" : "e.g. Image to funny captions"} /></label>
      {isStep ? <label>Instructions<textarea name="instructions" value={instructions} onChange={e => setInstructions(e.target.value)} required maxLength={8000} rows={5} placeholder="Describe what this step should produce. It receives the original input and previous step's output." /><span className="field-hint">{instructions.length}/8,000 characters</span></label>
        : <label>Description<textarea name="description" value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={2} placeholder="What does this chain create?" /></label>}
      <div className="actions">
        <button type="submit" name="intent" value="save">{pending ? "Working…" : step || (!isStep && chain) ? "Save changes" : isStep ? "Add step" : "Create chain"}</button>
        {step ? <>
          <button type="submit" className="secondary" name="intent" value="up" disabled={first} formNoValidate aria-label={"Move " + step.name + " up"}>↑ Move up</button>
          <button type="submit" className="secondary" name="intent" value="down" disabled={last} formNoValidate aria-label={"Move " + step.name + " down"}>↓ Move down</button>
        </> : null}
      </div>
      {step || (!isStep && chain) ? <div className="delete-row">
        <label className="check"><input type="checkbox" name="confirm_delete" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirm deletion{isStep ? " of this step" : " of this chain and its steps. Saved runs remain in All history."}</label>
        <button type="submit" className="danger" name="intent" value="delete" disabled={!confirmed} formNoValidate>Delete {isStep ? "step" : "chain"}</button>
      </div> : null}
    </fieldset>
    <Feedback state={state} pending={pending} />
  </form>;
}

export function RunForm({ chainId, disabled }: { chainId: string; disabled: boolean }) {
  const [input, setInput] = useState("");
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
    if (!input.trim() && !image) error = "Enter starting text or select an image.";
    else if (image && (image.size > 2_000_000 || !["image/png", "image/jpeg", "image/webp"].includes(image.type))) error = "Use a PNG, JPEG, or WebP image under 2 MB.";
    setClientError(error);
    if (error) event.preventDefault();
  }}>
    <input type="hidden" name="chain_id" value={chainId} />
    <fieldset disabled={pending || disabled}>
      <label>Starting input<textarea name="input" value={input} onChange={e => setInput(e.target.value)} maxLength={8000} rows={3} placeholder="Give your chain a subject, situation, or idea…" /><span className="field-hint">{input.length}/8,000 characters</span></label>
      <label>Optional image<input ref={imageInput} type="file" name="image" accept="image/png,image/jpeg,image/webp" onChange={e => { setImage(e.target.files?.[0] ?? null); setClientError(""); }} /></label>
      {image ? <div className="selected-image"><span>{image.name}</span><button type="button" className="secondary" onClick={() => { setImage(null); if (imageInput.current) imageInput.current.value = ""; }}>Remove image</button></div> : null}
      <p className="muted">PNG, JPEG, or WebP under 2 MB. The first step receives the image; later steps receive the previous text output.</p>
      <button type="submit">{pending ? "Running chain…" : "Run prompt chain"}</button>
    </fieldset>
    {disabled ? <p className="muted">Add a step to start generating.</p> : null}
    {pending ? <p className="run-progress" role="status">Running the steps in order. Completed outputs are saved as the chain progresses. Keep this page open.</p> : clientError ? <p role="alert">{clientError}</p> : <Feedback state={state} />}
  </form>;
}

function Feedback({ state, pending = false }: { state: ActionState; pending?: boolean }) {
  return <><p role="status" aria-live="polite">{pending ? "Working…" : state.message}</p>{!pending && state.error ? <p role="alert">{state.error}</p> : null}</>;
}

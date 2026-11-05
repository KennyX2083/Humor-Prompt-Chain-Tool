export type ChainMixEntry = {
  chain_id: number;
  weight: number;
  prompt_chains: { id: number; name: string; slug: string } | null;
};

export function choosePromptChain(entries: ChainMixEntry[], random: () => number = Math.random) {
  const active = entries.filter(entry => Number.isInteger(entry.weight) && entry.weight > 0 && entry.prompt_chains);
  const total = active.reduce((sum, entry) => sum + entry.weight, 0);
  if (!total) return null;
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error("Random value must be in [0, 1).");
  let cursor = sample * total;
  for (const entry of active) {
    if (cursor < entry.weight) return entry.prompt_chains;
    cursor -= entry.weight;
  }
  return active[active.length - 1].prompt_chains;
}

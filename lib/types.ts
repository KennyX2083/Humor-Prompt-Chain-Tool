export type Chain = { id: number; name: string; slug: string; description: string; weight: number };
export type Step = { id: number; chain_id: number; position: number; name: string; instructions: string };
export type Output = { name: string; instructions: string; output: string };
export type Run = {
  id: string;
  chain_id: string | null;
  shared_chain_id: number | null;
  request_id: number | null;
  created_at: string;
  finished_at: string | null;
  input: string;
  outputs: Output[];
  error: string | null;
  chain_name: string;
};
export type ActionState = { error?: string; message?: string };

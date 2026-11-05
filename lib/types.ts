export type Chain = { id: string; name: string; description: string };
export type Step = { id: string; chain_id: string; position: number; name: string; instructions: string };
export type Output = { name: string; instructions: string; output: string };
export type Run = {
  id: string;
  chain_id: string | null;
  created_at: string;
  finished_at: string | null;
  input: string;
  outputs: Output[];
  error: string | null;
  chain_name: string;
};
export type ActionState = { error?: string; message?: string };

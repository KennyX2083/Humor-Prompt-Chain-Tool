import { adminContext } from "../../lib/admin";
import { readHistoryTime } from "../../lib/history-time";
import OutputActions from "./output-actions";
import RefreshHistory from "./refresh-history";

type RequestRow = { id: number; chain_id: number | null; created_at: string; completed_at: string | null; status: string; game: string; character_name: string | null; situation: string };
type ResponseRow = { id: number; request_id: number; prompt: string; output: string | null; error: string | null };

export default async function SharedGenerationHistory({ chainId }: { chainId?: number }) {
  const context = await adminContext();
  if (!context) return null;
  const referenceTime = await readHistoryTime();
  let query = context.supabase.from("generation_request").select("id,chain_id,created_at,completed_at,status,game,character_name,situation");
  if (chainId !== undefined) query = query.eq("chain_id", chainId);
  const requests = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(10).returns<RequestRow[]>();
  const ids = (requests.data ?? []).map(row => row.id);
  const responses = ids.length
    ? await context.supabase.from("llm_response").select("id,request_id,prompt,output,error").in("request_id", ids).order("id").returns<ResponseRow[]>()
    : { data: [], error: null };
  return <section aria-labelledby="shared-history-heading">
    <div className="section-heading"><h2 id="shared-history-heading">Shared generator activity</h2><RefreshHistory /></div>
    <p className="field-hint">Latest 10 requests from the original app and Studio tests. These are the same request/response records shown in the admin panel.</p>
    {requests.error || responses.error ? <p role="alert">Could not load shared generation logs. Check the project configuration and permissions.</p>
      : !requests.data?.length ? <div className="empty">Generate an excuse in the original app, or test this chain here, to see its outputs.</div>
      : requests.data.map(request => {
        const steps = (responses.data ?? []).filter(response => response.request_id === request.id);
        const interrupted = request.status === "pending" && referenceTime - new Date(request.created_at).getTime() > 300000;
        return <details className="panel history" key={request.id}>
          <summary><span>Request #{request.id} · {request.game}</span><span className="history-meta">{interrupted ? "Interrupted" : request.status} · {new Date(request.created_at).toISOString().replace("T", " ").slice(0, 16)} UTC</span></summary>
          <p className="instructions">{request.character_name || "No character selected"}<br />{request.situation}</p>
          {steps.map((step, index) => <section className="step-output" key={step.id}>
            <h3>Step {index + 1}{index === steps.length - 1 && request.status === "succeeded" ? " · Final excuse" : ""}</h3>
            {step.output ? <><p className="output">{step.output}</p><OutputActions text={step.output} filename={`excuse-request-${request.id}-step-${index + 1}.txt`} /></> : null}
            {step.error ? <p role="alert">{step.error}</p> : null}
            <details className="instruction-snapshot"><summary>Full prompt used</summary><p className="instructions muted">{step.prompt}</p></details>
          </section>)}
          {interrupted ? <p role="alert">This request did not finish. Saved responses are retained.</p> : !steps.length ? <p className="muted">No step responses have been saved yet.</p> : null}
        </details>;
      })}
  </section>;
}

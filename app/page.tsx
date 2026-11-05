import Link from "next/link";
import { redirect } from "next/navigation";
import { readAccess } from "../lib/admin";
import type { Chain, Run, Step } from "../lib/types";
import { Editor, RunForm } from "./components/editor";
import OutputActions from "./components/output-actions";
import RefreshHistory from "./components/refresh-history";
import Theme from "./components/theme";
import SignIn from "./components/google-sign-in-button";
import SignOut from "./components/google-sign-out-button";

type SearchParams = { chain?: string | string[]; view?: string | string[]; history_page?: string | string[] };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const access = await readAccess();
  return <main className="shell" id="main">
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <header>
      <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">↗</span>Humor Lab <span className="muted">/ Prompt Studio</span></Link>
      <div className="header-controls"><Theme />{access.user ? <SignOut /> : null}</div>
    </header>
    {access.status === "admin" ? <Workspace access={access} searchParams={searchParams} /> : <section className="welcome" id="workspace">
      <p className="eyebrow">A little structure. A lot of possibility.</p>
      <h1>Good humor starts<br />with a chain reaction.</h1>
      <p>Turn an image into an observation, an observation into a joke, and a joke into five funny captions.</p>
      <div className="panel">
        <h2>{access.status === "denied" ? "Administrator access required" : access.status === "error" ? "Could not verify your account" : "Administrator workspace"}</h2>
        {access.status === "denied" ? <p role="alert">This account does not have superadmin access. Sign out and use an administrator account.</p>
          : access.status === "error" ? <p role="alert">Your profile permissions could not be checked. Refresh or sign out and try again.</p>
          : <><p>Sign in with your Humor Lab administrator account to manage and run prompt chains.</p><SignIn /></>}
      </div>
    </section>}
    <footer>Humor Lab · Week 8 / Prompt Chain Tool</footer>
  </main>;
}

async function Workspace({ access, searchParams }: {
  access: Awaited<ReturnType<typeof readAccess>>; searchParams: Promise<SearchParams>;
}) {
  const { supabase } = access;
  const params = await searchParams;
  const selectedId = typeof params.chain === "string" ? params.chain : "";
  const allHistory = params.view === "history";
  const rawPage = Number(typeof params.history_page === "string" ? params.history_page : "1");
  const historyPage = Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 100000 ? rawPage : 1;
  const { data: chains, error } = await supabase.from("prompt_tool_chains")
    .select("id,name,description").order("created_at", { ascending: false }).order("id").returns<Chain[]>();
  if (error) return <section className="panel" id="workspace"><h1>Could not load the workspace</h1><p role="alert">Confirm that database/setup.sql has been applied to the configured Supabase project, then refresh.</p></section>;
  const selected = allHistory ? undefined : selectedId ? chains?.find(c => c.id === selectedId) : chains?.[0];

  const stepsResult = selected
    ? await supabase.from("prompt_tool_steps").select("id,chain_id,position,name,instructions").eq("chain_id", selected.id).order("position").returns<Step[]>()
    : { data: [], error: null };
  const steps = stepsResult.data ?? [];
  return <>
    <section className="intro"><p className="eyebrow">The creative control room</p><h1>One idea. Many possibilities.</h1><p className="muted">Build the steps. Connect the outputs. See where your humor goes.</p></section>
    <div className="workspace" id="workspace">
      <aside>
        <div className="section-heading"><h2>Your chains</h2><span className="count">{chains?.length ?? 0}</span></div>
        <nav className="chain-list" aria-label="Prompt chains">
          {chains?.map(chain => <Link key={chain.id} href={"/?chain=" + chain.id} aria-current={selected?.id === chain.id ? "page" : undefined}><strong>{chain.name}</strong><span>{chain.description || "No description yet"}</span></Link>)}
          <Link href="/?view=history" aria-current={allHistory ? "page" : undefined}><strong>All history</strong><span>Saved runs, including deleted chains</span></Link>
        </nav>
        <details className="panel"><summary>+ Create a chain</summary><Editor /></details>
      </aside>
      <div className="canvas">
        {selected ? <>
          <section className="panel">
            <div className="section-heading"><div><p className="eyebrow">Prompt chain</p><h2>{selected.name}</h2></div><span className="count">{steps.length}/20 steps</span></div>
            <p>{selected.description || "Add a description to explain what this chain produces."}</p>
            <details><summary>Edit chain</summary><Editor key={selected.id} chain={selected} /></details>
          </section>
          <section aria-labelledby="steps-heading">
            <div className="section-heading"><h2 id="steps-heading">The sequence</h2><span className="muted">Outputs flow into the next step</span></div>
            {stepsResult.error ? <p role="alert">Could not load steps. Refresh and try again.</p>
              : !steps.length ? <div className="empty">Add a first step, such as describing an image. Then add a funny observation and caption-writing step.</div>
              : <ol className="steps">{steps.map((step, index) => <li key={step.id}>
                <span className="step-number" aria-hidden="true">{index + 1}</span>
                <div className="panel"><h3>{index + 1}. {step.name}</h3><p className="instructions">{step.instructions}</p>
                  <details><summary>Edit / reorder step</summary><Editor chain={selected} step={step} first={index === 0} last={index === steps.length - 1} /></details>
                </div>
              </li>)}</ol>}
            {!stepsResult.error && steps.length < 20 ? <details className="panel"><summary>+ Add a step</summary><Editor key={"add-" + selected.id} chain={selected} createStep /></details> : null}
            {steps.length >= 20 ? <p className="muted">This chain has reached the 20-step limit.</p> : null}
          </section>
          <section className="panel run-panel"><p className="eyebrow">Bring it to life</p><h2>Try this chain</h2><RunForm key={selected.id} chainId={selected.id} disabled={!steps.length || !!stepsResult.error} /></section>
        </> : !allHistory ? <section className="panel empty"><h2>{selectedId ? "Chain unavailable" : "Your next idea starts here"}</h2><p>{selectedId ? "This chain may have been deleted. Choose another chain, or open All history for its saved outputs." : "Create a chain using the form on the left to begin."}</p></section> : null}
        {selected || allHistory ? <History access={access} chain={selected} page={historyPage} /> : null}
      </div>
    </div>
  </>;
}

async function History({ access, chain, page }: {
  access: Awaited<ReturnType<typeof readAccess>>; chain?: Chain; page: number;
}) {
  let query = access.supabase.from("prompt_tool_runs")
    .select("id,chain_id,created_at,finished_at,input,outputs,error,chain_name", { count: "exact" });
  if (chain) query = query.eq("chain_id", chain.id);
  const { data: runs, error, count } = await query.order("created_at", { ascending: false }).order("id", { ascending: false })
    .range((page - 1) * 10, page * 10 - 1).returns<Run[]>();
  const pages = Math.max(1, Math.ceil((count ?? 0) / 10));
  function href(next: number) {
    const params = new URLSearchParams();
    if (chain) params.set("chain", chain.id);
    else params.set("view", "history");
    if (next > 1) params.set("history_page", String(next));
    return "/?" + params.toString() + "#history-heading";
  }
  if (page > 1 && (error?.code === "PGRST103" || (!error && !runs?.length))) redirect(href(1));
  return <section aria-labelledby="history-heading">
    <div className="section-heading"><h2 id="history-heading">{chain ? "Generation history" : "All generation history"}</h2><span className="muted">{count ?? 0} saved runs</span></div>
    <div className="history-toolbar"><RefreshHistory /><span className="field-hint">Dates shown in UTC</span></div>
    {error ? <p role="alert">Could not load generation history. Refresh and try again.</p>
      : !runs?.length ? <div className="empty">Your generated descriptions, jokes, and captions will appear here.</div>
      : runs.map(run => {
        const interrupted = !run.finished_at && Date.now() - new Date(run.created_at).getTime() > 300000;
        const status = run.error ? "Stopped" : run.finished_at ? "Complete" : interrupted ? "Interrupted" : "Running";
        const outputs = Array.isArray(run.outputs) ? run.outputs : [];
        return <details className="panel history" key={run.id}>
          <summary><span>{run.chain_name}{!run.chain_id ? <span className="archived-label"> · deleted chain</span> : null}</span><span className="history-meta"><span className="run-status" data-status={status.toLowerCase()}>{status}</span><time dateTime={run.created_at}>{new Date(run.created_at).toISOString().replace("T", " ").slice(0, 16)} UTC</time></span></summary>
          <h3>Starting input</h3><p className="instructions">{run.input}</p>
          {outputs.map((output, index) => <section className="step-output" key={index}>
            <div className="section-heading"><h3>{index + 1}. {output.name}</h3>{index === outputs.length - 1 ? <span className="count">{status === "Complete" ? "Final output" : "Latest saved output"}</span> : null}</div>
            <p className="output">{output.output}</p>
            <OutputActions text={output.output} filename={"prompt-" + run.id + "-step-" + (index + 1) + ".txt"} />
            <details className="instruction-snapshot"><summary>Instructions used</summary><p className="instructions muted">{output.instructions}</p></details>
          </section>)}
          {run.error ? <p role="alert">{run.error}</p> : interrupted ? <p role="alert">This run did not finish. Its saved outputs are shown above. You can run the chain again.</p> : status === "Running" ? <p className="muted">Generation is in progress. Refresh history to check for saved outputs.</p> : null}
        </details>;
      })}
    {!error && pages > 1 ? <nav className="history-pagination" aria-label="Generation history pages">
      {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : <span className="muted">← Previous</span>}
      <span>Page {page} of {pages}</span>
      {page < pages ? <Link href={href(page + 1)}>Next →</Link> : <span className="muted">Next →</span>}
    </nav> : null}
  </section>;
}

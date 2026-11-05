"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="shell"><section className="welcome panel">
    <h1>Could not load Prompt Studio</h1>
    <p role="alert">Check your connection and project configuration, then try again.</p>
    <button type="button" onClick={reset}>Try again</button>
  </section></main>;
}

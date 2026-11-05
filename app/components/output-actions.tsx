"use client";

import { useState } from "react";

export default function OutputActions({ text, filename }: { text: string; filename: string }) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied.");
    } catch {
      setMessage("Could not copy. Select the text or download it instead.");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Download started.");
  }

  return <div className="output-actions">
    <button type="button" className="secondary" onClick={copy}>Copy text</button>
    <button type="button" className="secondary" onClick={download}>Download .txt</button>
    <span role="status" aria-live="polite">{message}</span>
  </div>;
}

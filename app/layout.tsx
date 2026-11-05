import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Prompt Studio | Humor Lab", description: "Build prompt chains, connect ideas, and create funny captions." };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('prompt-tool-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:'system'}catch{}` }} /></head><body>{children}</body></html>;
}

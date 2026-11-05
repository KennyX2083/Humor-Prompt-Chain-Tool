"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function signIn() {
    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch {
      setErrorMessage("Could not start Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button-primary" type="button" onClick={signIn} disabled={loading}>
        {loading ? "Redirecting…" : "Sign in with Google"}
      </button>

      {errorMessage && <p role="alert">{errorMessage}</p>}
    </div>
  );
}
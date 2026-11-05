"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function SignOutButton() {
    const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function signOut() {
    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      router.replace("/");
      router.refresh();
    } catch {
      setErrorMessage("Could not sign out. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="account-action">
      <button className="button-quiet" type="button" onClick={signOut} disabled={loading}>
        {loading ? "Signing out…" : "Sign out"}
      </button>

      {errorMessage && <p role="alert">{errorMessage}</p>}
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    setAllowed(true);
    setChecking(false);
  }

  if (checking) {
    return (
      <div className="authPage">
        <div className="authCard">
          <h2>Checking session...</h2>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return children;
}

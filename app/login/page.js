"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event) {
    event.preventDefault();
    setErrorMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setErrorMessage("Please enter your email address and password.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const requestedRedirect = params.get("redirect");

      const safeRedirect =
        requestedRedirect &&
        requestedRedirect.startsWith("/") &&
        !requestedRedirect.startsWith("//")
          ? requestedRedirect
          : "/dashboard";

      router.replace(safeRedirect);
      router.refresh();
    } catch (error) {
      console.error("Login error:", error);
      setErrorMessage("Unable to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authCard">
        <div className="authBrand">
          <h2>SaiNal One</h2>
          <span>AI Business Operating System</span>
        </div>

        <h1>Welcome Back</h1>
        <p>Log in to manage your business.</p>

        {errorMessage && (
          <div className="authError" role="alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="authForm">
          <div className="authField">
            <label htmlFor="email">Email address</label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="authField">
            <div className="authFieldHeader">
              <label htmlFor="password">Password</label>

              <Link href="/forgot-password" className="leadLink">
                Forgot password?
              </Link>
            </div>

            <div className="passwordInputWrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                required
              />

              <button
                type="button"
                className="passwordToggle"
                onClick={() => setShowPassword((current) => !current)}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            className="primaryBtn"
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="helperText">
          New to SaiNal One?{" "}
          <Link href="/register" className="leadLink">
            Create Account
          </Link>
        </p>
      </section>
    </main>
  );
}

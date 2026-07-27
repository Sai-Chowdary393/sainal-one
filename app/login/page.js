"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import styles from "./login.module.css";

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
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>SN</div>
          <span className={styles.logoText}>SaiNal One</span>
        </div>

        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>One platform. Smarter business.</p>

          <h1 className={styles.heroTitle}>
            Run your entire business from one intelligent workspace.
          </h1>

          <p className={styles.heroText}>
            Manage leads, customers, quotes, projects, invoices and AI-powered
            workflows in one connected platform.
          </p>

          <div className={styles.featureList}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>✓</span>
              <span>Manage your complete customer journey</span>
            </div>

            <div className={styles.feature}>
              <span className={styles.featureIcon}>✓</span>
              <span>Generate insights and business content with AI</span>
            </div>

            <div className={styles.feature}>
              <span className={styles.featureIcon}>✓</span>
              <span>Keep projects, tasks and invoices connected</span>
            </div>
          </div>
        </div>

        <div className={styles.panelFooter}>
          © {new Date().getFullYear()} SaiNal Technologies Ltd
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formContainer}>
          <div className={styles.mobileLogo}>
            <div className={styles.mobileLogoMark}>SN</div>
            <span className={styles.mobileLogoText}>SaiNal One</span>
          </div>

          <h2 className={styles.heading}>Welcome back</h2>

          <p className={styles.subtitle}>
            Enter your details to access your SaiNal One workspace.
          </p>

          {errorMessage && (
            <div className={styles.errorMessage} role="alert">
              {errorMessage}
            </div>
          )}

          <form className={styles.form} onSubmit={handleLogin}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">
                Email address
              </label>

              <input
                className={styles.input}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className={styles.field}>
              <div className={styles.fieldHeader}>
                <label className={styles.label} htmlFor="password">
                  Password
                </label>

                <Link href="/forgot-password" className={styles.link}>
                  Forgot password?
                </Link>
              </div>

              <div className={styles.passwordWrapper}>
                <input
                  className={styles.input}
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
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((current) => !current)}
                  disabled={loading}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              className={styles.submitButton}
              type="submit"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className={styles.helperText}>
            New to SaiNal One?{" "}
            <Link href="/register" className={styles.link}>
              Create an account
            </Link>
          </p>

          <div className={styles.securityMessage}>
            <span className={styles.securityIcon}>🔒</span>
            <span>Your account is protected by secure authentication.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import {
  useState,
} from "react";

import Link from "next/link";

import {
  supabase,
} from "../../lib/supabase";

import styles from "./forgot-password.module.css";

export default function ForgotPasswordPage() {
  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  async function handleResetPassword(
    event
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (!cleanEmail) {
      setErrorMessage(
        "Please enter your email address."
      );

      return;
    }

    setLoading(true);

    try {
      const callbackUrl =
        new URL(
          "/auth/callback",
          window.location.origin
        );

      callbackUrl.searchParams.set(
        "next",
        "/reset-password"
      );

      const {
        error,
      } =
        await supabase.auth
          .resetPasswordForEmail(
            cleanEmail,
            {
              redirectTo:
                callbackUrl.toString(),
            }
          );

      if (error) {
        setErrorMessage(
          error.message
        );

        return;
      }

      setSuccessMessage(
        "Password reset instructions have been sent. Please check your inbox and spam folder."
      );
    } catch (error) {
      console.error(
        "Password reset error:",
        error
      );

      setErrorMessage(
        "We could not send the password reset email. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            SN
          </div>

          <span className={styles.logoText}>
            SaiNal One
          </span>
        </div>

        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>
            Secure account recovery
          </p>

          <h1 className={styles.heroTitle}>
            Get back to running your business.
          </h1>

          <p className={styles.heroText}>
            Enter your account email and we will send you a secure link to
            create a new password.
          </p>

          <div className={styles.featureList}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>
                ✓
              </span>

              <span>
                Secure password recovery
              </span>
            </div>

            <div className={styles.feature}>
              <span className={styles.featureIcon}>
                ✓
              </span>

              <span>
                Time-limited reset link
              </span>
            </div>

            <div className={styles.feature}>
              <span className={styles.featureIcon}>
                ✓
              </span>

              <span>
                Your business data remains protected
              </span>
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
            <div className={styles.mobileLogoMark}>
              SN
            </div>

            <span className={styles.mobileLogoText}>
              SaiNal One
            </span>
          </div>

          <Link
            href="/login"
            className={styles.backLink}
          >
            ← Back to login
          </Link>

          <h2 className={styles.heading}>
            Forgot your password?
          </h2>

          <p className={styles.subtitle}>
            Enter the email address connected to your SaiNal One account.
          </p>

          {errorMessage && (
            <div
              className={styles.errorMessage}
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              className={styles.successMessage}
              role="status"
            >
              <strong>
                Check your email
              </strong>

              <span>
                {successMessage}
              </span>
            </div>
          )}

          {!successMessage && (
            <form
              className={styles.form}
              onSubmit={handleResetPassword}
            >
              <div className={styles.field}>
                <label
                  className={styles.label}
                  htmlFor="email"
                >
                  Email address
                </label>

                <input
                  className={styles.input}
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  disabled={loading}
                  required
                />
              </div>

              <button
                className={styles.submitButton}
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Sending reset link..."
                  : "Send reset link"}
              </button>
            </form>
          )}

          {successMessage && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setSuccessMessage("");
                setEmail("");
              }}
            >
              Send to another email
            </button>
          )}

          <p className={styles.helperText}>
            Remembered your password?{" "}

            <Link
              href="/login"
              className={styles.link}
            >
              Log in
            </Link>
          </p>

          <div className={styles.securityMessage}>
            <span>
              🔒
            </span>

            <span>
              We will never ask you to share your password by email.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

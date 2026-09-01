"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Link from "next/link";

import {
  supabase,
} from "../../lib/supabase";

import styles from "./reset-password.module.css";

export default function ResetPasswordPage() {
  const router =
    useRouter();

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    checkingSession,
    setCheckingSession,
  ] =
    useState(true);

  const [
    hasRecoverySession,
    setHasRecoverySession,
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

  useEffect(() => {
    let mounted =
      true;

    async function checkRecoverySession() {
      try {
        const {
          data,
          error,
        } =
          await supabase.auth
            .getSession();

        if (
          !mounted
        ) {
          return;
        }

        if (
          error ||
          !data?.session
        ) {
          setHasRecoverySession(
            false
          );

          setErrorMessage(
            "This password reset link is invalid, expired or has already been used. Please request a new reset link."
          );

          return;
        }

        setHasRecoverySession(
          true
        );
      } catch (
        error
      ) {
        console.error(
          "Recovery session check error:",
          error
        );

        if (
          mounted
        ) {
          setHasRecoverySession(
            false
          );

          setErrorMessage(
            "Unable to verify the password reset session. Please request a new reset link."
          );
        }
      } finally {
        if (
          mounted
        ) {
          setCheckingSession(
            false
          );
        }
      }
    }

    checkRecoverySession();

    return () => {
      mounted =
        false;
    };
  }, []);

  async function handleResetPassword(
    event
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (
      !hasRecoverySession
    ) {
      setErrorMessage(
        "Your password reset session is missing or expired. Please request a new reset link."
      );

      return;
    }

    if (
      !password ||
      !confirmPassword
    ) {
      setErrorMessage(
        "Please enter your new password."
      );

      return;
    }

    if (
      password.length <
      8
    ) {
      setErrorMessage(
        "Password must contain at least 8 characters."
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setErrorMessage(
        "Passwords do not match."
      );

      return;
    }

    setLoading(true);

    try {
      const {
        error,
      } =
        await supabase.auth
          .updateUser({
            password,
          });

      if (error) {
        setErrorMessage(
          error.message
        );

        return;
      }

      /*
       * End the recovery session after changing the password.
       * The user then signs in normally using the new password.
       */
      await supabase.auth
        .signOut();

      setSuccessMessage(
        "Your password has been changed successfully. You can now sign in with your new password."
      );

      setTimeout(() => {
        router.replace(
          "/login"
        );
      }, 2000);
    } catch (error) {
      console.error(
        "Password update error:",
        error
      );

      setErrorMessage(
        "Unable to reset your password."
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
            ACCOUNT SECURITY
          </p>

          <h1 className={styles.heroTitle}>
            Create a new password.
          </h1>

          <p className={styles.heroText}>
            Choose a strong password to protect your SaiNal One account.
          </p>

          <div className={styles.featureList}>
            <div className={styles.feature}>
              <span className={styles.featureIcon}>
                ✓
              </span>

              <span>
                Secure encrypted authentication
              </span>
            </div>

            <div className={styles.feature}>
              <span className={styles.featureIcon}>
                ✓
              </span>

              <span>
                Password never stored in plain text
              </span>
            </div>

            <div className={styles.feature}>
              <span className={styles.featureIcon}>
                ✓
              </span>

              <span>
                Enterprise-grade security
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
          <Link
            href="/login"
            className={styles.backLink}
          >
            ← Back to Login
          </Link>

          <h2 className={styles.heading}>
            Reset Password
          </h2>

          <p className={styles.subtitle}>
            Enter your new password below.
          </p>

          {checkingSession && (
            <div className={styles.securityMessage}>
              Verifying your secure password reset link...
            </div>
          )}

          {!checkingSession &&
            errorMessage && (
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
              {successMessage}
            </div>
          )}

          {!checkingSession &&
            hasRecoverySession &&
            !successMessage && (
              <form
                className={styles.form}
                onSubmit={handleResetPassword}
              >
                <div className={styles.field}>
                  <label
                    className={styles.label}
                    htmlFor="new-password"
                  >
                    New Password
                  </label>

                  <div className={styles.passwordWrapper}>
                    <input
                      id="new-password"
                      className={styles.input}
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="new-password"
                      placeholder="New password"
                      value={password}
                      onChange={(
                        event
                      ) =>
                        setPassword(
                          event.target.value
                        )
                      }
                      disabled={loading}
                      required
                    />

                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() =>
                        setShowPassword(
                          !showPassword
                        )
                      }
                    >
                      {showPassword
                        ? "Hide"
                        : "Show"}
                    </button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label
                    className={styles.label}
                    htmlFor="confirm-password"
                  >
                    Confirm Password
                  </label>

                  <div className={styles.passwordWrapper}>
                    <input
                      id="confirm-password"
                      className={styles.input}
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="new-password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(
                        event
                      ) =>
                        setConfirmPassword(
                          event.target.value
                        )
                      }
                      disabled={loading}
                      required
                    />

                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() =>
                        setShowConfirmPassword(
                          !showConfirmPassword
                        )
                      }
                    >
                      {showConfirmPassword
                        ? "Hide"
                        : "Show"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={loading}
                >
                  {loading
                    ? "Updating..."
                    : "Update Password"}
                </button>
              </form>
            )}

          {!checkingSession &&
            !hasRecoverySession &&
            !successMessage && (
              <Link
                href="/forgot-password"
                className={styles.submitButton}
              >
                Request a new reset link
              </Link>
            )}

          <div className={styles.securityMessage}>
            🔒 Your password is securely encrypted.
          </div>
        </div>
      </section>
    </main>
  );
}

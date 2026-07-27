"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import styles from "./reset-password.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleResetPassword(e) {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!password || !confirmPassword) {
      setErrorMessage("Please enter your new password.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        "Password must contain at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        "Passwords do not match."
      );
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(
        "Your password has been changed successfully."
      );

      setTimeout(() => {
        router.replace("/login");
      }, 2500);

    } catch (error) {
      console.error(error);

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
          <div className={styles.logoMark}>SN</div>

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
            Choose a strong password to
            protect your SaiNal One account.
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

          {errorMessage && (
            <div className={styles.errorMessage}>
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className={styles.successMessage}>
              {successMessage}
            </div>
          )}

          {!successMessage && (
            <form
              className={styles.form}
              onSubmit={handleResetPassword}
            >

              <div className={styles.field}>
                <label className={styles.label}>
                  New Password
                </label>

                <div className={styles.passwordWrapper}>
                  <input
                    className={styles.input}
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="New password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                  />

                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                  >
                    {showPassword
                      ? "Hide"
                      : "Show"}
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  Confirm Password
                </label>

                <div className={styles.passwordWrapper}>
                  <input
                    className={styles.input}
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
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
                className={styles.submitButton}
                disabled={loading}
              >
                {loading
                  ? "Updating..."
                  : "Update Password"}
              </button>

            </form>
          )}

          <div className={styles.securityMessage}>
            🔒 Your password is securely encrypted.
          </div>

        </div>
      </section>
    </main>
  );
}

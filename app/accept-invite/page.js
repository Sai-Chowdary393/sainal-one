"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "../../lib/supabase";

import styles from "./accept-invite.module.css";

export default function AcceptInvitePage() {
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
    userEmail,
    setUserEmail,
  ] =
    useState("");

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
    let mounted = true;

    async function loadSession() {
      try {
        /*
         * Supabase automatically processes authentication
         * information contained in the invitation redirect.
         */
        const {
          data,
          error,
        } =
          await supabase.auth
            .getSession();

        if (!mounted) {
          return;
        }

        if (error) {
          setErrorMessage(
            error.message
          );

          setCheckingSession(
            false
          );

          return;
        }

        if (
          data?.session?.user
        ) {
          setUserEmail(
            data.session.user
              .email || ""
          );

          setCheckingSession(
            false
          );

          return;
        }

        /*
         * Authentication state can arrive just after the
         * page loads, so listen for the Supabase event too.
         */
        const {
          data:
            listenerData,
        } =
          supabase.auth
            .onAuthStateChange(
              (
                _event,
                session
              ) => {
                if (
                  !mounted
                ) {
                  return;
                }

                if (
                  session?.user
                ) {
                  setUserEmail(
                    session.user
                      .email || ""
                  );

                  setCheckingSession(
                    false
                  );
                }
              }
            );

        /*
         * Give the invitation session a moment to initialise.
         */
        window.setTimeout(
          () => {
            if (
              mounted
            ) {
              setCheckingSession(
                false
              );
            }
          },
          2500
        );

        return () => {
          listenerData
            .subscription
            .unsubscribe();
        };
      } catch (error) {
        console.error(
          "Invite session error:",
          error
        );

        if (
          mounted
        ) {
          setErrorMessage(
            "Unable to verify the invitation."
          );

          setCheckingSession(
            false
          );
        }
      }
    }

    const cleanup =
      loadSession();

    return () => {
      mounted = false;

      Promise.resolve(
        cleanup
      ).then(
        (
          cleanupFunction
        ) => {
          if (
            typeof cleanupFunction ===
            "function"
          ) {
            cleanupFunction();
          }
        }
      );
    };
  }, []);

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

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

    try {
      setLoading(
        true
      );

      /*
       * Confirm that the invitation has created
       * an authenticated Supabase session.
       */
      const {
        data:
          sessionData,
        error:
          sessionError,
      } =
        await supabase.auth
          .getSession();

      if (
        sessionError
      ) {
        throw sessionError;
      }

      if (
        !sessionData?.session
          ?.user
      ) {
        throw new Error(
          "Your invitation session is no longer available. Please open the invitation link again."
        );
      }

      /*
       * Set the employee's password.
       */
      const {
        error:
          passwordError,
      } =
        await supabase.auth
          .updateUser({
            password,
          });

      if (
        passwordError
      ) {
        throw passwordError;
      }

      /*
       * Tell SaiNal One that onboarding is complete.
       */
      const response =
        await fetch(
          "/api/auth/complete-invite",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to complete employee onboarding."
        );
      }

      setSuccessMessage(
        "Your SaiNal One account is ready."
      );

      /*
       * Small delay so the success state is visible.
       */
      window.setTimeout(
        () => {
          router.replace(
            "/dashboard"
          );

          router.refresh();
        },
        900
      );
    } catch (error) {
      console.error(
        "Invitation completion error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to complete your account setup."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  if (
    checkingSession
  ) {
    return (
      <main
        className={
          styles.page
        }
      >
        <section
          className={
            styles.card
          }
        >
          <div
            className={
              styles.logo
            }
          >
            SN
          </div>

          <h1>
            Preparing your account
          </h1>

          <p
            className={
              styles.subtitle
            }
          >
            We&apos;re verifying your SaiNal One invitation.
          </p>

          <div
            className={
              styles.loadingBar
            }
          />
        </section>
      </main>
    );
  }

  return (
    <main
      className={
        styles.page
      }
    >
      <section
        className={
          styles.card
        }
      >
        <div
          className={
            styles.brand
          }
        >
          <div
            className={
              styles.logo
            }
          >
            SN
          </div>

          <div>
            <strong>
              SaiNal One
            </strong>

            <span>
              Employee onboarding
            </span>
          </div>
        </div>

        <span
          className={
            styles.eyebrow
          }
        >
          Invitation accepted
        </span>

        <h1>
          Set up your account
        </h1>

        <p
          className={
            styles.subtitle
          }
        >
          Create your password to finish joining your organisation.
        </p>

        {userEmail && (
          <div
            className={
              styles.emailPanel
            }
          >
            <span>
              Account
            </span>

            <strong>
              {userEmail}
            </strong>
          </div>
        )}

        {errorMessage && (
          <div
            className={
              styles.errorMessage
            }
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className={
              styles.successMessage
            }
          >
            {successMessage}
          </div>
        )}

        {!userEmail &&
        !successMessage ? (
          <div
            className={
              styles.invalidInvite
            }
          >
            <h2>
              Invitation could not be verified
            </h2>

            <p>
              The invitation may have expired or already been used.
            </p>

            <button
              type="button"
              className={
                styles.secondaryButton
              }
              onClick={() =>
                router.replace(
                  "/login"
                )
              }
            >
              Go to login
            </button>
          </div>
        ) : (
          !successMessage && (
            <form
              className={
                styles.form
              }
              onSubmit={
                handleSubmit
              }
            >
              <div
                className={
                  styles.field
                }
              >
                <label
                  htmlFor="password"
                >
                  Password
                </label>

                <div
                  className={
                    styles.passwordWrapper
                  }
                >
                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={
                      password
                    }
                    onChange={(
                      event
                    ) =>
                      setPassword(
                        event.target
                          .value
                      )
                    }
                    placeholder="Create a password"
                    autoComplete="new-password"
                    disabled={
                      loading
                    }
                    required
                  />

                  <button
                    type="button"
                    className={
                      styles.passwordToggle
                    }
                    onClick={() =>
                      setShowPassword(
                        (
                          current
                        ) =>
                          !current
                      )
                    }
                  >
                    {showPassword
                      ? "Hide"
                      : "Show"}
                  </button>
                </div>

                <small>
                  Minimum 8 characters.
                </small>
              </div>

              <div
                className={
                  styles.field
                }
              >
                <label
                  htmlFor="confirm-password"
                >
                  Confirm password
                </label>

                <input
                  id="confirm-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    confirmPassword
                  }
                  onChange={(
                    event
                  ) =>
                    setConfirmPassword(
                      event.target
                        .value
                    )
                  }
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  disabled={
                    loading
                  }
                  required
                />
              </div>

              <button
                type="submit"
                className={
                  styles.primaryButton
                }
                disabled={
                  loading
                }
              >
                {loading
                  ? "Setting up account..."
                  : "Complete account setup"}
              </button>
            </form>
          )
        )}

        <div
          className={
            styles.securityMessage
          }
        >
          🔒 Your account is protected by Supabase authentication.
        </div>
      </section>
    </main>
  );
}

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
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    checkingInvite,
    setCheckingInvite,
  ] = useState(true);

  const [
    invitationValid,
    setInvitationValid,
  ] = useState(false);

  const [
    userEmail,
    setUserEmail,
  ] = useState("");

  const [
    employeeName,
    setEmployeeName,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  // =======================================================
  // PROCESS INVITATION
  // =======================================================

  useEffect(() => {
    let cancelled =
      false;

    async function processInvitation() {
      try {
        setCheckingInvite(
          true
        );

        setErrorMessage("");

        /*
         * Supabase's default invitation email verifies the
         * invitation first, then redirects to this page with
         * authentication details in the URL hash:
         *
         * #access_token=...
         * &refresh_token=...
         * &type=invite
         */
        const hash =
          window.location.hash
            .replace(/^#/, "");

        const hashParams =
          new URLSearchParams(
            hash
          );

        const accessToken =
          hashParams.get(
            "access_token"
          );

        const refreshToken =
          hashParams.get(
            "refresh_token"
          );

        const authType =
          hashParams.get(
            "type"
          );

        /*
         * Never trust a pre-existing session.
         *
         * This page must only work when opened from an
         * actual Supabase invitation URL.
         */
        if (
          authType !==
            "invite" ||
          !accessToken ||
          !refreshToken
        ) {
          throw new Error(
            "This page was not opened from a valid employee invitation. Please use the invitation link from your email."
          );
        }

        /*
         * Explicitly replace any existing browser session
         * with the session supplied by the invitation.
         */
        const {
          data:
            sessionData,
          error:
            sessionError,
        } =
          await supabase.auth
            .setSession({
              access_token:
                accessToken,

              refresh_token:
                refreshToken,
            });

        if (
          sessionError
        ) {
          throw sessionError;
        }

        if (
          !sessionData
            ?.session
            ?.user
        ) {
          throw new Error(
            "The invitation session could not be created."
          );
        }

        /*
         * Remove tokens from the visible address bar once
         * they have been consumed.
         */
        window.history
          .replaceState(
            {},
            document.title,
            window.location.pathname
          );

        /*
         * Now ask the SaiNal One backend to confirm that
         * this Auth user really belongs to an employee
         * currently awaiting invitation acceptance.
         */
        const response =
          await fetch(
            "/api/auth/invite-status",
            {
              method:
                "GET",

              cache:
                "no-store",
            }
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
              "This invitation could not be verified."
          );
        }

        if (
          !data.valid
        ) {
          throw new Error(
            "This invitation is not valid for an employee awaiting onboarding."
          );
        }

        if (
          cancelled
        ) {
          return;
        }

        setUserEmail(
          data.employee
            ?.email ||
            sessionData
              .session
              .user
              .email ||
            ""
        );

        setEmployeeName(
          data.employee
            ?.full_name ||
            ""
        );

        setInvitationValid(
          true
        );
      } catch (error) {
        console.error(
          "Invitation verification error:",
          error
        );

        if (
          cancelled
        ) {
          return;
        }

        /*
         * Do not leave an unexpected account authenticated
         * after a failed invitation check.
         */
        try {
          await supabase.auth
            .signOut();
        } catch (
          signOutError
        ) {
          console.error(
            "Invite cleanup sign-out error:",
            signOutError
          );
        }

        setInvitationValid(
          false
        );

        setErrorMessage(
          error.message ||
            "Unable to verify this employee invitation."
        );
      } finally {
        if (
          !cancelled
        ) {
          setCheckingInvite(
            false
          );
        }
      }
    }

    processInvitation();

    return () => {
      cancelled =
        true;
    };
  }, []);

  // =======================================================
  // COMPLETE SETUP
  // =======================================================

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (
      !invitationValid
    ) {
      setErrorMessage(
        "Your employee invitation has not been verified."
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

    try {
      setLoading(
        true
      );

      /*
       * Verify the currently authenticated user again
       * immediately before changing their password.
       */
      const {
        data:
          userData,
        error:
          userError,
      } =
        await supabase.auth
          .getUser();

      if (
        userError ||
        !userData?.user
      ) {
        throw new Error(
          "Your invitation session has expired. Please use a new invitation link."
        );
      }

      /*
       * Verify employee invitation state again.
       */
      const verificationResponse =
        await fetch(
          "/api/auth/invite-status",
          {
            method:
              "GET",

            cache:
              "no-store",
          }
        );

      const verificationData =
        await verificationResponse
          .json();

      if (
        !verificationResponse.ok ||
        !verificationData.valid
      ) {
        throw new Error(
          verificationData.error ||
            "This employee invitation is no longer valid."
        );
      }

      /*
       * Set the invited employee's password.
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
       * Change employment status:
       *
       * Invited -> Active
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
        "Account setup error:",
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

  // =======================================================
  // LOADING
  // =======================================================

  if (
    checkingInvite
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
            Verifying your invitation
          </h1>

          <p
            className={
              styles.subtitle
            }
          >
            We&apos;re securely preparing your SaiNal One account.
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

  // =======================================================
  // PAGE
  // =======================================================

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

        {invitationValid ? (
          <>
            <span
              className={
                styles.eyebrow
              }
            >
              Invitation verified
            </span>

            <h1>
              Set up your account
            </h1>

            <p
              className={
                styles.subtitle
              }
            >
              {employeeName
                ? `Welcome ${employeeName}. Create your password to finish joining your organisation.`
                : "Create your password to finish joining your organisation."}
            </p>

            <div
              className={
                styles.emailPanel
              }
            >
              <span>
                Employee account
              </span>

              <strong>
                {userEmail}
              </strong>
            </div>

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

            {!successMessage && (
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
                          event
                            .target
                            .value
                        )
                      }
                      autoComplete="new-password"
                      placeholder="Create a password"
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
                      disabled={
                        loading
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
                        event
                          .target
                          .value
                      )
                    }
                    autoComplete="new-password"
                    placeholder="Enter your password again"
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
            )}
          </>
        ) : (
          <>
            <span
              className={
                styles.eyebrow
              }
            >
              Invitation problem
            </span>

            <h1>
              Invitation could not be verified
            </h1>

            <p
              className={
                styles.subtitle
              }
            >
              We couldn&apos;t verify this employee invitation.
            </p>

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

            <div
              className={
                styles.invalidInvite
              }
            >
              <h2>
                Need another invitation?
              </h2>

              <p>
                Ask your organisation owner to send you a new employee invitation.
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
          </>
        )}

        <div
          className={
            styles.securityMessage
          }
        >
          🔒 Your account is protected by secure authentication.
        </div>
      </section>
    </main>
  );
}

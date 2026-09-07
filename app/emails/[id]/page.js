"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import {
  useParams,
} from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import StatusBadge from "../../../components/StatusBadge";

import styles from "./email-details.module.css";

// =========================================================
// PAGE
// =========================================================

export default function EmailDetailsPage() {
  const params =
    useParams();

  const emailId =
    params?.id;

  const [
    email,
    setEmail,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  useEffect(() => {
    if (
      emailId
    ) {
      loadEmail();
    }
  }, [
    emailId,
  ]);

  async function loadEmail() {
    try {
      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      const response =
        await fetch(
          `/api/email-logs/${emailId}`,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await safeJson(
          response
        );

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to load email details."
        );
      }

      setEmail(
        data.email ||
          null
      );
    } catch (error) {
      setEmail(
        null
      );

      setErrorMessage(
        error.message ||
          "Unable to load email details."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  return (
    <ProtectedRoute>
      <AppLayout
        title="Email details"
        description="Review business email delivery information and related CRM context."
      >
        <div
          className={
            styles.page
          }
        >
          <div
            className={
              styles.topRow
            }
          >
            <Link
              href="/emails"
              className={
                styles.backLink
              }
            >
              ← Back to Emails
            </Link>

            {email &&
              getRelatedLink(
                email
              ) && (
                <div
                  className={
                    styles.topActions
                  }
                >
                  <Link
                    href={
                      getRelatedLink(
                        email
                      )
                    }
                    className={
                      styles.secondaryButton
                    }
                  >
                    Open related record
                  </Link>
                </div>
              )}
          </div>

          {loading ? (
            <LoadingState />
          ) : errorMessage ? (
            <section
              className={
                styles.errorCard
              }
            >
              <strong>
                Unable to load email
              </strong>

              <p>
                {
                  errorMessage
                }
              </p>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  loadEmail
                }
              >
                Try again
              </button>
            </section>
          ) : email ? (
            <>
              <section
                className={
                  styles.heroCard
                }
              >
                <div
                  className={
                    styles.heroIcon
                  }
                >
                  ✉
                </div>

                <div
                  className={
                    styles.heroCopy
                  }
                >
                  <span
                    className={
                      styles.eyebrow
                    }
                  >
                    {email.email_type ||
                      "Email"}
                  </span>

                  <h1>
                    {email.subject ||
                      "Email without subject"}
                  </h1>

                  <div
                    className={
                      styles.heroMeta
                    }
                  >
                    <StatusBadge
                      status={
                        email.status ||
                        "Unknown"
                      }
                    />

                    <span>
                      {formatDateTime(
                        email.sent_at ||
                          email.created_at
                      )}
                    </span>
                  </div>
                </div>
              </section>

              <div
                className={
                  styles.contentGrid
                }
              >
                <section
                  className={
                    styles.messageCard
                  }
                >
                  <div
                    className={
                      styles.sectionHeader
                    }
                  >
                    <div>
                      <h2>
                        Email message
                      </h2>

                      <p>
                        The message content stored when this email was sent.
                      </p>
                    </div>
                  </div>

                  <div
                    className={
                      styles.messageEnvelope
                    }
                  >
                    <div
                      className={
                        styles.addressRow
                      }
                    >
                      <span>
                        To
                      </span>

                      <strong>
                        {email.recipient ||
                          "Not available"}
                      </strong>
                    </div>

                    <div
                      className={
                        styles.addressRow
                      }
                    >
                      <span>
                        Subject
                      </span>

                      <strong>
                        {email.subject ||
                          "No subject"}
                      </strong>
                    </div>

                    <div
                      className={
                        styles.messageBody
                      }
                    >
                      {email.message_body ? (
                        <p>
                          {
                            email.message_body
                          }
                        </p>
                      ) : (
                        <div
                          className={
                            styles.noMessage
                          }
                        >
                          <strong>
                            Message body not stored
                          </strong>

                          <span>
                            This is an older email record created before message-body history was enabled.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <aside
                  className={
                    styles.detailsCard
                  }
                >
                  <div
                    className={
                      styles.sectionHeader
                    }
                  >
                    <div>
                      <h2>
                        Delivery details
                      </h2>

                      <p>
                        Email status and CRM linkage.
                      </p>
                    </div>
                  </div>

                  <DetailRow
                    label="Recipient"
                    value={
                      email.recipient ||
                      "Not available"
                    }
                  />

                  <DetailRow
                    label="Type"
                    value={
                      email.email_type ||
                      "General"
                    }
                  />

                  <DetailRow
                    label="Status"
                    value={
                      email.status ||
                      "Unknown"
                    }
                  />

                  <DetailRow
                    label="Related record"
                    value={
                      email.related_record_number ||
                      getRelatedRecordName(
                        email
                      ) ||
                      "Not linked"
                    }
                  />

                  <DetailRow
                    label="Provider"
                    value={
                      email.provider ||
                      "Not available"
                    }
                  />

                  <DetailRow
                    label="Provider email ID"
                    value={
                      email.provider_email_id ||
                      "Not available"
                    }
                  />

                  <DetailRow
                    label="Sent"
                    value={
                      formatDateTime(
                        email.sent_at ||
                          email.created_at
                      )
                    }
                  />

                  {email.error_message && (
                    <div
                      className={
                        styles.errorDetail
                      }
                    >
                      <span>
                        Delivery error
                      </span>

                      <p>
                        {
                          email.error_message
                        }
                      </p>
                    </div>
                  )}
                </aside>
              </div>
            </>
          ) : null}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// COMPONENTS
// =========================================================

function DetailRow({
  label,
  value,
}) {
  return (
    <div
      className={
        styles.detailRow
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className={
        styles.loadingState
      }
    >
      <div />
      <div />
      <div />
    </div>
  );
}

// =========================================================
// HELPERS
// =========================================================

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function normalise(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getRelatedLink(
  email
) {
  if (
    !email?.related_record_id
  ) {
    return null;
  }

  const type =
    normalise(
      email.email_type
    );

  if (
    type ===
    "lead"
  ) {
    return `/leads/${email.related_record_id}`;
  }

  if (
    type ===
    "customer"
  ) {
    return `/customers/${email.related_record_id}`;
  }

  if (
    type ===
    "project"
  ) {
    return `/projects/${email.related_record_id}`;
  }

  if (
    type ===
    "proposal"
  ) {
    return `/proposals/${email.related_record_id}`;
  }

  if (
    type ===
    "invoice"
  ) {
    return `/invoices/${email.related_record_id}`;
  }

  return null;
}

function getRelatedRecordName(
  email
) {
  const record =
    email?.related_record;

  if (
    !record
  ) {
    return "";
  }

  return (
    record.name ||
    record.customer_name ||
    record.project_name ||
    record.title ||
    record.company ||
    record.proposal_number ||
    record.invoice_number ||
    ""
  );
}

function formatDateTime(
  value
) {
  if (
    !value
  ) {
    return "Not available";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return date.toLocaleString(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}

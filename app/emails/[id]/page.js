"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import StatusBadge from "../../../components/StatusBadge";

import styles from "./email-details.module.css";

export default function EmailDetailsPage() {
  const params = useParams();
  const emailLogId = params?.id;

  const [emailLog, setEmailLog] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (emailLogId) {
      fetchEmailLog();
    }
  }, [emailLogId]);

  async function fetchEmailLog() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(
        "/api/email-logs",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load email record."
        );
      }

      const selectedEmail = (
        Array.isArray(data) ? data : []
      ).find(
        (log) =>
          String(log.id) ===
          String(emailLogId)
      );

      setEmailLog(
        selectedEmail || null
      );
    } catch (error) {
      console.error(
        "Email record loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load this email record."
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyValue(
    value,
    label
  ) {
    if (!value) {
      alert(`${label} is not available.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(
        String(value)
      );

      alert(`${label} copied.`);
    } catch (error) {
      console.error(
        "Clipboard error:",
        error
      );

      alert(
        `Unable to copy ${label.toLowerCase()}.`
      );
    }
  }

  const relatedLink = useMemo(
    () =>
      emailLog
        ? getRelatedLink(emailLog)
        : null,
    [emailLog]
  );

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Email Workspace"
          description="Loading email delivery information."
        >
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (errorMessage) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Email Workspace"
          description="Review communication delivery."
        >
          <section
            className={styles.errorPanel}
          >
            <div>
              <strong>
                Unable to load email
              </strong>

              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              className={
                styles.secondaryButton
              }
              onClick={fetchEmailLog}
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!emailLog) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Email Workspace"
          description="Review communication delivery."
        >
          <section
            className={styles.notFound}
          >
            <span
              className={
                styles.notFoundIcon
              }
            >
              ✉
            </span>

            <h2>Email record not found</h2>

            <p>
              This email record may have been
              removed or is no longer
              available.
            </p>

            <Link
              href="/emails"
              className={
                styles.primaryButton
              }
            >
              Return to emails
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const failed =
    normaliseValue(
      emailLog.status
    ) === "failed";

  const sent =
    normaliseValue(
      emailLog.status
    ) === "sent";

  const recommendations =
    buildRecommendations(emailLog);

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          emailLog.subject ||
          "Email Workspace"
        }
        description="Review recipient, delivery status and related business records."
      >
        <div className={styles.page}>
          <section
            className={styles.pageHeader}
          >
            <div
              className={styles.headerCopy}
            >
              <Link
                href="/emails"
                className={styles.backLink}
              >
                ← Back to emails
              </Link>

              <span
                className={styles.eyebrow}
              >
                Communication workspace
              </span>

              <h2>
                {emailLog.subject ||
                  "Email without subject"}
              </h2>

              <p>
                Review email delivery,
                recipient details and the
                related business document.
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={() =>
                  copyValue(
                    emailLog.recipient,
                    "Recipient"
                  )
                }
              >
                Copy recipient
              </button>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={() =>
                  copyValue(
                    emailLog.subject,
                    "Subject"
                  )
                }
              >
                Copy subject
              </button>

              {relatedLink && (
                <Link
                  href={relatedLink}
                  className={
                    styles.primaryButton
                  }
                >
                  Open related record
                </Link>
              )}
            </div>
          </section>

          <section
            className={styles.heroCard}
          >
            <div
              className={
                styles.emailIdentity
              }
            >
              <span
                className={styles.emailIcon}
              >
                ✉
              </span>

              <div
                className={styles.identityCopy}
              >
                <span
                  className={
                    styles.identityLabel
                  }
                >
                  Business email
                </span>

                <h3>
                  {emailLog.subject ||
                    "Email without subject"}
                </h3>

                <p>
                  Sent to{" "}
                  {emailLog.recipient ||
                    "an unknown recipient"}
                </p>

                <div
                  className={
                    styles.identityMeta
                  }
                >
                  <StatusBadge
                    status={
                      emailLog.status ||
                      "Unknown"
                    }
                  />

                  <span
                    className={
                      styles.metaBadge
                    }
                  >
                    {emailLog.email_type ||
                      "General"}
                  </span>

                  <span
                    className={
                      failed
                        ? styles.failedBadge
                        : styles.metaBadge
                    }
                  >
                    {failed
                      ? "Delivery failed"
                      : `Sent ${formatDateTime(
                          emailLog.sent_at ||
                            emailLog.created_at
                        )}`}
                  </span>
                </div>
              </div>
            </div>

            <div
              className={styles.heroMetrics}
            >
              <HeroMetric
                label="Delivery"
                value={
                  emailLog.status ||
                  "Unknown"
                }
                danger={failed}
                success={sent}
              />

              <HeroMetric
                label="Email type"
                value={
                  emailLog.email_type ||
                  "General"
                }
              />

              <HeroMetric
                label="Related record"
                value={
                  emailLog.related_record_number ||
                  "Not linked"
                }
              />
            </div>
          </section>

          <section
            className={styles.workspaceGrid}
          >
            <section className={styles.panel}>
              <div
                className={styles.panelHeader}
              >
                <div>
                  <h3>Email information</h3>

                  <p>
                    Recipient, subject and
                    document relationship
                  </p>
                </div>
              </div>

              <div
                className={styles.detailList}
              >
                <DetailRow
                  label="Recipient"
                  value={emailLog.recipient}
                  href={
                    emailLog.recipient
                      ? `mailto:${emailLog.recipient}`
                      : null
                  }
                />

                <DetailRow
                  label="Subject"
                  value={emailLog.subject}
                />

                <DetailRow
                  label="Email type"
                  value={
                    emailLog.email_type
                  }
                />

                <DetailRow
                  label="Delivery status"
                  customValue={
                    <StatusBadge
                      status={
                        emailLog.status ||
                        "Unknown"
                      }
                    />
                  }
                />

                <DetailRow
                  label="Related record"
                  customValue={
                    relatedLink ? (
                      <Link
                        href={relatedLink}
                        className={
                          styles.relatedLink
                        }
                      >
                        {emailLog.related_record_number ||
                          "Open record"}{" "}
                        →
                      </Link>
                    ) : (
                      <strong
                        className={
                          styles.emptyValue
                        }
                      >
                        {emailLog.related_record_number ||
                          "Not linked"}
                      </strong>
                    )
                  }
                />

                <DetailRow
                  label="Sent"
                  value={formatDateTime(
                    emailLog.sent_at
                  )}
                />

                <DetailRow
                  label="Created"
                  value={formatDateTime(
                    emailLog.created_at
                  )}
                />
              </div>
            </section>

            <section className={styles.aiPanel}>
              <div
                className={styles.aiHeader}
              >
                <span
                  className={styles.aiIcon}
                >
                  ✦
                </span>

                <div>
                  <span>
                    Communication intelligence
                  </span>

                  <h3>
                    Delivery overview
                  </h3>
                </div>
              </div>

              <div className={styles.riskGrid}>
                <RiskMetric
                  label="Delivery"
                  value={
                    emailLog.status ||
                    "Unknown"
                  }
                />

                <RiskMetric
                  label="Recipient"
                  value={
                    emailLog.recipient
                      ? "Available"
                      : "Missing"
                  }
                />

                <RiskMetric
                  label="Document"
                  value={
                    relatedLink
                      ? "Linked"
                      : "Not linked"
                  }
                />

                <RiskMetric
                  label="Error"
                  value={
                    emailLog.error_message
                      ? "Recorded"
                      : "None"
                  }
                />
              </div>

              <div
                className={
                  styles.aiRecommendations
                }
              >
                <span>
                  Recommended actions
                </span>

                {recommendations.map(
                  (
                    recommendation,
                    index
                  ) => (
                    <div
                      key={`${recommendation}-${index}`}
                      className={
                        styles.recommendationItem
                      }
                    >
                      <span>→</span>

                      <p>
                        {recommendation}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>
          </section>

          {emailLog.error_message && (
            <section
              className={styles.errorDetail}
            >
              <div
                className={
                  styles.errorDetailHeader
                }
              >
                <span>!</span>

                <div>
                  <h3>Delivery error</h3>

                  <p>
                    The email service returned
                    the following information.
                  </p>
                </div>
              </div>

              <pre>
                {emailLog.error_message}
              </pre>
            </section>
          )}

          <section className={styles.panel}>
            <div
              className={styles.panelHeader}
            >
              <div>
                <h3>Email activity</h3>

                <p>
                  Delivery lifecycle for this
                  communication
                </p>
              </div>
            </div>

            <div className={styles.timeline}>
              <TimelineItem
                title="Email record created"
                description="SaiNal One created the email delivery record."
                date={emailLog.created_at}
              />

              {sent && (
                <TimelineItem
                  title="Email sent"
                  description={`The ${emailLog.email_type || "business"} email was successfully sent to ${emailLog.recipient || "the recipient"}.`}
                  date={
                    emailLog.sent_at ||
                    emailLog.created_at
                  }
                />
              )}

              {failed && (
                <TimelineItem
                  title="Delivery failed"
                  description="The email provider could not complete delivery."
                  date={
                    emailLog.sent_at ||
                    emailLog.created_at
                  }
                  danger
                />
              )}
            </div>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function DetailRow({
  label,
  value,
  href,
  customValue,
}) {
  return (
    <div className={styles.detailRow}>
      <span>{label}</span>

      {customValue ? (
        customValue
      ) : href && value ? (
        <a href={href}>{value}</a>
      ) : (
        <strong
          className={
            value
              ? ""
              : styles.emptyValue
          }
        >
          {value || "Not available"}
        </strong>
      )}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  danger = false,
  success = false,
}) {
  return (
    <div
      className={`${styles.heroMetric} ${
        danger
          ? styles.heroMetricDanger
          : ""
      } ${
        success
          ? styles.heroMetricSuccess
          : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RiskMetric({
  label,
  value,
}) {
  return (
    <div className={styles.riskMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TimelineItem({
  title,
  description,
  date,
  danger = false,
}) {
  return (
    <div className={styles.timelineItem}>
      <span
        className={`${styles.timelineDot} ${
          danger
            ? styles.timelineDotDanger
            : ""
        }`}
      />

      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <time>
        {formatDateTime(date)}
      </time>
    </div>
  );
}

function LoadingState() {
  return (
    <section
      className={styles.loadingPanel}
    >
      {Array.from({
        length: 5,
      }).map((_, index) => (
        <div
          key={index}
          className={styles.loadingRow}
        />
      ))}
    </section>
  );
}

function getRelatedLink(log) {
  if (!log.related_record_id) {
    return null;
  }

  if (
    normaliseValue(
      log.email_type
    ) === "proposal"
  ) {
    return `/proposals/${log.related_record_id}`;
  }

  if (
    normaliseValue(
      log.email_type
    ) === "invoice"
  ) {
    return `/invoices/${log.related_record_id}`;
  }

  return null;
}

function buildRecommendations(log) {
  const recommendations = [];

  if (
    normaliseValue(log.status) ===
    "failed"
  ) {
    recommendations.push(
      "Confirm the recipient address and retry sending from the related record."
    );
  } else {
    recommendations.push(
      "No delivery action is currently required."
    );
  }

  if (!log.recipient) {
    recommendations.push(
      "Add a valid recipient address before attempting another send."
    );
  }

  if (!log.related_record_id) {
    recommendations.push(
      "Link the email to a proposal or invoice for a complete business history."
    );
  }

  if (log.error_message) {
    recommendations.push(
      "Review the provider error before retrying delivery."
    );
  }

  return recommendations.slice(0, 4);
}

function normaliseValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "Not available";
  }

  return date.toLocaleString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

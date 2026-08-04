"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatusBadge from "../../components/StatusBadge";

import styles from "./emails.module.css";

const EMAIL_TYPE_OPTIONS = [
  "Proposal",
  "Invoice",
];

const STATUS_OPTIONS = [
  "Sent",
  "Failed",
];

export default function EmailsPage() {
  const [emailLogs, setEmailLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchValue, setSearchValue] = useState("");
  const [emailTypeFilter, setEmailTypeFilter] =
    useState("All");
  const [statusFilter, setStatusFilter] =
    useState("All");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetchEmailLogs();
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    searchValue,
    emailTypeFilter,
    statusFilter,
  ]);

  async function fetchEmailLogs() {
    try {
      setLoading(true);
      setErrorMessage("");

      const params = new URLSearchParams();

      if (searchValue.trim()) {
        params.set(
          "search",
          searchValue.trim()
        );
      }

      if (emailTypeFilter !== "All") {
        params.set(
          "email_type",
          emailTypeFilter
        );
      }

      if (statusFilter !== "All") {
        params.set(
          "status",
          statusFilter
        );
      }

      const query = params.toString();

      const response = await fetch(
        `/api/email-logs${
          query ? `?${query}` : ""
        }`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load email history."
        );
      }

      setEmailLogs(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Email history loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load the email history."
      );
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const sent = emailLogs.filter(
      (log) =>
        normaliseValue(log.status) ===
        "sent"
    ).length;

    const failed = emailLogs.filter(
      (log) =>
        normaliseValue(log.status) ===
        "failed"
    ).length;

    const proposals = emailLogs.filter(
      (log) =>
        normaliseValue(
          log.email_type
        ) === "proposal"
    ).length;

    const invoices = emailLogs.filter(
      (log) =>
        normaliseValue(
          log.email_type
        ) === "invoice"
    ).length;

    return {
      total: emailLogs.length,
      sent,
      failed,
      proposals,
      invoices,
    };
  }, [emailLogs]);

  const filtersActive =
    Boolean(searchValue) ||
    emailTypeFilter !== "All" ||
    statusFilter !== "All";

  function clearFilters() {
    setSearchValue("");
    setEmailTypeFilter("All");
    setStatusFilter("All");
  }

  return (
    <ProtectedRoute>
      <AppLayout
        title="Emails"
        description="Review business email delivery and document communication."
      >
        <div className={styles.page}>
          <section
            className={styles.pageHeader}
          >
            <div
              className={
                styles.pageHeaderCopy
              }
            >
              <span
                className={styles.eyebrow}
              >
                Communication workspace
              </span>

              <h2>Email activity centre</h2>

              <p>
                Review proposal and invoice
                emails sent from SaiNal One,
                including recipients, delivery
                status and related business
                records.
              </p>
            </div>

            <Link
              href="/ai-assistant"
              className={
                styles.primaryButton
              }
            >
              <span>✦</span>
              Create with AI
            </Link>
          </section>

          <section
            className={styles.summaryGrid}
          >
            <SummaryCard
              icon="✉"
              label="Email records"
              value={summary.total}
              detail="All delivery attempts"
              tone="Gold"
            />

            <SummaryCard
              icon="✓"
              label="Sent"
              value={summary.sent}
              detail="Successfully delivered"
              tone="Green"
            />

            <SummaryCard
              icon="!"
              label="Failed"
              value={summary.failed}
              detail="Require attention"
              tone="Red"
            />

            <SummaryCard
              icon="▤"
              label="Documents"
              value={
                summary.proposals +
                summary.invoices
              }
              detail={`${summary.proposals} proposals · ${summary.invoices} invoices`}
              tone="Blue"
            />
          </section>

          <section
            className={styles.toolbarPanel}
          >
            <label
              className={styles.searchBox}
            >
              <span aria-hidden="true">
                ⌕
              </span>

              <input
                type="search"
                placeholder="Search recipient, subject or document number..."
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(
                    event.target.value
                  )
                }
                aria-label="Search email history"
              />
            </label>

            <div className={styles.filters}>
              <select
                className={
                  styles.filterSelect
                }
                value={emailTypeFilter}
                onChange={(event) =>
                  setEmailTypeFilter(
                    event.target.value
                  )
                }
                aria-label="Filter by email type"
              >
                <option value="All">
                  All email types
                </option>

                {EMAIL_TYPE_OPTIONS.map(
                  (emailType) => (
                    <option
                      key={emailType}
                      value={emailType}
                    >
                      {emailType}
                    </option>
                  )
                )}
              </select>

              <select
                className={
                  styles.filterSelect
                }
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                aria-label="Filter by status"
              >
                <option value="All">
                  All statuses
                </option>

                {STATUS_OPTIONS.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  )
                )}
              </select>

              {filtersActive && (
                <button
                  type="button"
                  className={
                    styles.clearButton
                  }
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          {loading ? (
            <LoadingState />
          ) : errorMessage ? (
            <section
              className={styles.errorPanel}
            >
              <div>
                <strong>
                  Unable to load emails
                </strong>

                <p>{errorMessage}</p>
              </div>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={fetchEmailLogs}
              >
                Try again
              </button>
            </section>
          ) : (
            <section
              className={styles.tablePanel}
            >
              <div
                className={styles.tableHeading}
              >
                <div>
                  <h3>Email delivery records</h3>

                  <p>
                    Open an email record to
                    review delivery information
                    and related documents.
                  </p>
                </div>

                <span
                  className={styles.resultCount}
                >
                  {emailLogs.length} result
                  {emailLogs.length === 1
                    ? ""
                    : "s"}
                </span>
              </div>

              {emailLogs.length === 0 ? (
                <EmptyState
                  filtersActive={
                    filtersActive
                  }
                  onClearFilters={
                    clearFilters
                  }
                />
              ) : (
                <div
                  className={
                    styles.tableWrapper
                  }
                >
                  <table
                    className={
                      styles.emailTable
                    }
                  >
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Recipient</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Related record</th>
                        <th>Sent</th>
                        <th
                          aria-label="Open email"
                        />
                      </tr>
                    </thead>

                    <tbody>
                      {emailLogs.map(
                        (log) => (
                          <EmailRow
                            key={log.id}
                            log={log}
                          />
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function EmailRow({ log }) {
  const relatedLink =
    getRelatedLink(log);

  const failed =
    normaliseValue(log.status) ===
    "failed";

  return (
    <tr>
      <td>
        <div
          className={styles.emailIdentity}
        >
          <span
            className={styles.emailIcon}
          >
            ✉
          </span>

          <div
            className={
              styles.emailIdentityCopy
            }
          >
            <Link
              href={`/emails/${log.id}`}
              className={styles.emailLink}
            >
              {log.subject ||
                "Email without subject"}
            </Link>

            <small>
              {failed
                ? "Delivery requires attention"
                : "Open email activity"}
            </small>
          </div>
        </div>
      </td>

      <td>
        <span
          className={styles.recipient}
        >
          {log.recipient ||
            "No recipient"}
        </span>
      </td>

      <td>
        <span
          className={styles.typeBadge}
        >
          {log.email_type ||
            "General"}
        </span>
      </td>

      <td>
        <StatusBadge
          status={
            log.status || "Unknown"
          }
        />
      </td>

      <td>
        {relatedLink ? (
          <Link
            href={relatedLink}
            className={
              styles.relatedLink
            }
          >
            {log.related_record_number ||
              "View record"}
          </Link>
        ) : (
          <span
            className={
              styles.emptyValue
            }
          >
            {log.related_record_number ||
              "Not linked"}
          </span>
        )}
      </td>

      <td>
        <span
          className={styles.dateText}
        >
          {formatDateTime(
            log.sent_at ||
              log.created_at
          )}
        </span>
      </td>

      <td>
        <Link
          href={`/emails/${log.id}`}
          className={styles.openButton}
        >
          Open →
        </Link>
      </td>
    </tr>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  tone,
}) {
  return (
    <div
      className={`${styles.summaryCard} ${
        styles[`summary${tone}`] || ""
      }`}
    >
      <span
        className={styles.summaryIcon}
      >
        {icon}
      </span>

      <span
        className={styles.summaryLabel}
      >
        {label}
      </span>

      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function EmptyState({
  filtersActive,
  onClearFilters,
}) {
  return (
    <div className={styles.emptyState}>
      <span
        className={styles.emptyIcon}
      >
        ✉
      </span>

      <h3>
        {filtersActive
          ? "No matching email records"
          : "No email history yet"}
      </h3>

      <p>
        {filtersActive
          ? "Try changing or clearing the current email filters."
          : "Send a proposal or invoice to create your first email delivery record."}
      </p>

      {filtersActive ? (
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onClearFilters}
        >
          Clear filters
        </button>
      ) : (
        <Link
          href="/proposals"
          className={styles.primaryButton}
        >
          Open proposals
        </Link>
      )}
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

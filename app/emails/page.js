"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatusBadge from "../../components/StatusBadge";

import styles from "./emails.module.css";

// =========================================================
// CONSTANTS
// =========================================================

const EMAIL_TYPE_OPTIONS = [
  "General",
  "Lead",
  "Customer",
  "Project",
  "Proposal",
  "Invoice",
];

const STATUS_OPTIONS = [
  "Sent",
  "Failed",
];

const RELATED_TYPES = [
  "General",
  "Lead",
  "Customer",
  "Project",
];

const EMPTY_COMPOSE_FORM = {
  related_type:
    "General",

  related_id:
    "",

  to:
    "",

  subject:
    "",

  message:
    "",
};

// =========================================================
// PAGE
// =========================================================

export default function EmailsPage() {
  const [
    emailLogs,
    setEmailLogs,
  ] =
    useState([]);

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

  const [
    searchValue,
    setSearchValue,
  ] =
    useState("");

  const [
    emailTypeFilter,
    setEmailTypeFilter,
  ] =
    useState("All");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("All");

  const [
    showCompose,
    setShowCompose,
  ] =
    useState(false);

  const [
    sending,
    setSending,
  ] =
    useState(false);

  const [
    generatingDraft,
    setGeneratingDraft,
  ] =
    useState(false);

  const [
    aiDraftError,
    setAiDraftError,
  ] =
    useState("");

  const [
    composeForm,
    setComposeForm,
  ] =
    useState(
      EMPTY_COMPOSE_FORM
    );

  const [
    leads,
    setLeads,
  ] =
    useState([]);

  const [
    customers,
    setCustomers,
  ] =
    useState([]);

  const [
    projects,
    setProjects,
  ] =
    useState([]);

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    const timeout =
      window.setTimeout(
        () => {
          fetchEmailLogs();
        },
        250
      );

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [
    searchValue,
    emailTypeFilter,
    statusFilter,
  ]);

  useEffect(() => {
    loadComposeData();
  }, []);

  async function fetchEmailLogs() {
    try {
      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      const params =
        new URLSearchParams();

      if (
        searchValue.trim()
      ) {
        params.set(
          "search",
          searchValue.trim()
        );
      }

      if (
        emailTypeFilter !==
        "All"
      ) {
        params.set(
          "email_type",
          emailTypeFilter
        );
      }

      if (
        statusFilter !==
        "All"
      ) {
        params.set(
          "status",
          statusFilter
        );
      }

      const query =
        params.toString();

      const response =
        await fetch(
          `/api/email-logs${
            query
              ? `?${query}`
              : ""
          }`,
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
            "Failed to load email history."
        );
      }

      setEmailLogs(
        Array.isArray(
          data
        )
          ? data
          : []
      );
    } catch (error) {
      console.error(
        "Email history loading error:",
        error
      );

      setEmailLogs(
        []
      );

      setErrorMessage(
        error.message ||
          "We could not load the email history."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function loadComposeData() {
    try {
      const [
        leadsResponse,
        customersResponse,
        projectsResponse,
      ] =
        await Promise.all([
          fetch(
            "/api/leads",
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            "/api/customers",
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            "/api/projects",
            {
              cache:
                "no-store",
            }
          ),
        ]);

      const [
        leadsData,
        customersData,
        projectsData,
      ] =
        await Promise.all([
          safeJson(
            leadsResponse
          ),
          safeJson(
            customersResponse
          ),
          safeJson(
            projectsResponse
          ),
        ]);

      setLeads(
        leadsResponse.ok &&
          Array.isArray(
            leadsData.leads
          )
          ? leadsData.leads
          : []
      );

      setCustomers(
        customersResponse.ok &&
          Array.isArray(
            customersData.customers
          )
          ? customersData.customers
          : []
      );

      setProjects(
        projectsResponse.ok &&
          Array.isArray(
            projectsData.projects
          )
          ? projectsData.projects
          : []
      );
    } catch (error) {
      console.error(
        "Email compose data loading error:",
        error
      );
    }
  }

  // =======================================================
  // COMPOSE
  // =======================================================

  function openCompose() {
    setComposeForm(
      EMPTY_COMPOSE_FORM
    );

    setAiDraftError(
      ""
    );

    setShowCompose(
      true
    );
  }

  function closeCompose() {
    if (
      sending ||
      generatingDraft
    ) {
      return;
    }

    setAiDraftError(
      ""
    );

    setShowCompose(
      false
    );
  }

  function handleComposeChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setComposeForm(
      (
        current
      ) => {
        const next = {
          ...current,

          [name]:
            value,
        };

        if (
          name ===
          "related_type"
        ) {
          next.related_id =
            "";

          /*
           * Do not clear a manually typed recipient when
           * switching back to General.
           */
          if (
            value !==
            "General"
          ) {
            next.to =
              "";
          }
        }

        if (
          name ===
          "related_id"
        ) {
          const email =
            getRelatedEmail({
              relatedType:
                current.related_type,

              relatedId:
                value,

              leads,

              customers,
            });

          if (
            email
          ) {
            next.to =
              email;
          }
        }

        return next;
      }
    );
  }

  async function generateAiDraft() {
    if (
      composeForm.related_type !==
        "General" &&
      !composeForm.related_id
    ) {
      alert(
        `Please select a ${composeForm.related_type.toLowerCase()} first.`
      );

      return;
    }

    try {
      setGeneratingDraft(
        true
      );

      setAiDraftError(
        ""
      );

      const relatedRecord =
        getSelectedRelatedRecord({
          relatedType:
            composeForm.related_type,

          relatedId:
            composeForm.related_id,

          leads,

          customers,

          projects,
        });

      const response =
        await fetch(
          "/api/emails/ai-draft",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                related_type:
                  composeForm.related_type,

                related_id:
                  composeForm.related_id ||
                  null,

                to:
                  composeForm.to.trim(),

                current_subject:
                  composeForm.subject.trim(),

                current_message:
                  composeForm.message.trim(),

                related_record:
                  relatedRecord,
              }),
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
            "Unable to generate an AI email draft."
        );
      }

      setComposeForm(
        (
          current
        ) => ({
          ...current,

          subject:
            data.subject ||
            current.subject,

          message:
            data.message ||
            current.message,
        })
      );
    } catch (error) {
      setAiDraftError(
        error.message ||
          "Unable to generate an AI email draft."
      );
    } finally {
      setGeneratingDraft(
        false
      );
    }
  }

  async function sendEmail(
    event
  ) {
    event.preventDefault();

    if (
      !composeForm.to.trim()
    ) {
      alert(
        "Recipient email is required."
      );

      return;
    }

    if (
      !composeForm.subject.trim()
    ) {
      alert(
        "Subject is required."
      );

      return;
    }

    if (
      !composeForm.message.trim()
    ) {
      alert(
        "Message is required."
      );

      return;
    }

    if (
      composeForm.related_type !==
        "General" &&
      !composeForm.related_id
    ) {
      alert(
        `Please select a ${composeForm.related_type.toLowerCase()}.`
      );

      return;
    }

    try {
      setSending(
        true
      );

      const response =
        await fetch(
          "/api/emails/send",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                to:
                  composeForm.to.trim(),

                subject:
                  composeForm.subject.trim(),

                message:
                  composeForm.message.trim(),

                related_type:
                  composeForm.related_type,

                related_id:
                  composeForm.related_id ||
                  null,
              }),
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
            "Unable to send email."
        );
      }

      setShowCompose(
        false
      );

      setComposeForm(
        EMPTY_COMPOSE_FORM
      );

      await fetchEmailLogs();

      alert(
        data.message ||
          "Email sent successfully."
      );
    } catch (error) {
      alert(
        error.message ||
          "Unable to send email."
      );

      await fetchEmailLogs();
    } finally {
      setSending(
        false
      );
    }
  }

  // =======================================================
  // SUMMARY / FILTERS
  // =======================================================

  const summary =
    useMemo(
      () => {
        const sent =
          emailLogs.filter(
            (
              log
            ) =>
              normaliseValue(
                log.status
              ) ===
              "sent"
          ).length;

        const failed =
          emailLogs.filter(
            (
              log
            ) =>
              normaliseValue(
                log.status
              ) ===
              "failed"
          ).length;

        const proposals =
          emailLogs.filter(
            (
              log
            ) =>
              normaliseValue(
                log.email_type
              ) ===
              "proposal"
          ).length;

        const invoices =
          emailLogs.filter(
            (
              log
            ) =>
              normaliseValue(
                log.email_type
              ) ===
              "invoice"
          ).length;

        return {
          total:
            emailLogs.length,

          sent,

          failed,

          proposals,

          invoices,
        };
      },
      [
        emailLogs,
      ]
    );

  const filtersActive =
    Boolean(
      searchValue
    ) ||
    emailTypeFilter !==
      "All" ||
    statusFilter !==
      "All";

  function clearFilters() {
    setSearchValue(
      ""
    );

    setEmailTypeFilter(
      "All"
    );

    setStatusFilter(
      "All"
    );
  }

  const relatedRecords =
    getRelatedRecords({
      relatedType:
        composeForm.related_type,

      leads,

      customers,

      projects,
    });

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Emails"
        description="Review business email delivery and document communication."
      >
        <div
          className={
            styles.page
          }
        >
          <section
            className={
              styles.pageHeader
            }
          >
            <div
              className={
                styles.pageHeaderCopy
              }
            >
              <span
                className={
                  styles.eyebrow
                }
              >
                Communication workspace
              </span>

              <h2>
                Email activity centre
              </h2>

              <p>
                Send business emails and review proposal, invoice and CRM communication from one place.
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              <Link
                href="/ai-assistant"
                className={
                  styles.secondaryButton
                }
              >
                <span>
                  ✦
                </span>

                Create with AI
              </Link>

              <button
                type="button"
                className={
                  styles.primaryButton
                }
                onClick={
                  openCompose
                }
              >
                <span>
                  ✉
                </span>

                + Compose email
              </button>
            </div>
          </section>

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              icon="✉"
              label="Email records"
              value={
                summary.total
              }
              detail="All delivery attempts"
              tone="Gold"
            />

            <SummaryCard
              icon="✓"
              label="Sent"
              value={
                summary.sent
              }
              detail="Successfully delivered"
              tone="Green"
            />

            <SummaryCard
              icon="!"
              label="Failed"
              value={
                summary.failed
              }
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
            className={
              styles.toolbarPanel
            }
          >
            <label
              className={
                styles.searchBox
              }
            >
              <span
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                placeholder="Search recipient, subject, status or related record..."
                value={
                  searchValue
                }
                onChange={(
                  event
                ) =>
                  setSearchValue(
                    event.target.value
                  )
                }
                aria-label="Search email history"
              />
            </label>

            <div
              className={
                styles.filters
              }
            >
              <select
                className={
                  styles.filterSelect
                }
                value={
                  emailTypeFilter
                }
                onChange={(
                  event
                ) =>
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
                  (
                    emailType
                  ) => (
                    <option
                      key={
                        emailType
                      }
                      value={
                        emailType
                      }
                    >
                      {
                        emailType
                      }
                    </option>
                  )
                )}
              </select>

              <select
                className={
                  styles.filterSelect
                }
                value={
                  statusFilter
                }
                onChange={(
                  event
                ) =>
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
                  (
                    status
                  ) => (
                    <option
                      key={
                        status
                      }
                      value={
                        status
                      }
                    >
                      {
                        status
                      }
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
                  onClick={
                    clearFilters
                  }
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
              className={
                styles.errorPanel
              }
            >
              <div>
                <strong>
                  Unable to load emails
                </strong>

                <p>
                  {
                    errorMessage
                  }
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  fetchEmailLogs
                }
              >
                Try again
              </button>
            </section>
          ) : (
            <section
              className={
                styles.tablePanel
              }
            >
              <div
                className={
                  styles.tableHeading
                }
              >
                <div>
                  <h3>
                    Email delivery records
                  </h3>

                  <p>
                    Open an email record to review delivery information and related business records.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {
                    emailLogs.length
                  }{" "}
                  result
                  {emailLogs.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {emailLogs.length ===
              0 ? (
                <EmptyState
                  filtersActive={
                    filtersActive
                  }
                  onClearFilters={
                    clearFilters
                  }
                  onCompose={
                    openCompose
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
                        <th>
                          Email
                        </th>

                        <th>
                          Recipient
                        </th>

                        <th>
                          Type
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Related record
                        </th>

                        <th>
                          Sent
                        </th>

                        <th
                          aria-label="Open email"
                        />
                      </tr>
                    </thead>

                    <tbody>
                      {emailLogs.map(
                        (
                          log
                        ) => (
                          <EmailRow
                            key={
                              log.id
                            }
                            log={
                              log
                            }
                          />
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {showCompose && (
            <ComposeEmailModal
              form={
                composeForm
              }
              relatedRecords={
                relatedRecords
              }
              sending={
                sending
              }
              generatingDraft={
                generatingDraft
              }
              aiDraftError={
                aiDraftError
              }
              onChange={
                handleComposeChange
              }
              onClose={
                closeCompose
              }
              onGenerateDraft={
                generateAiDraft
              }
              onSubmit={
                sendEmail
              }
            />
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// COMPOSE MODAL
// =========================================================

function ComposeEmailModal({
  form,
  relatedRecords,
  sending,
  generatingDraft,
  aiDraftError,
  onChange,
  onClose,
  onGenerateDraft,
  onSubmit,
}) {
  return (
    <div
      className={
        styles.modalOverlay
      }
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className={
          styles.composePanel
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-email-title"
      >
        <div
          className={
            styles.composeHeader
          }
        >
          <div>
            <span
              className={
                styles.eyebrow
              }
            >
              New email
            </span>

            <h3
              id="compose-email-title"
            >
              Compose email
            </h3>

            <p>
              Send a business email and optionally link it to a CRM record.
            </p>
          </div>

          <button
            type="button"
            className={
              styles.modalClose
            }
            onClick={
              onClose
            }
            disabled={
              sending ||
              generatingDraft
            }
            aria-label="Close compose email"
          >
            ×
          </button>
        </div>

        <form
          className={
            styles.composeForm
          }
          onSubmit={
            onSubmit
          }
        >
          <div
            className={
              styles.composeGrid
            }
          >
            <label
              className={
                styles.composeField
              }
            >
              <span>
                Related to
              </span>

              <select
                name="related_type"
                value={
                  form.related_type
                }
                onChange={
                  onChange
                }
                disabled={
                  sending
                }
              >
                {RELATED_TYPES.map(
                  (
                    type
                  ) => (
                    <option
                      key={
                        type
                      }
                      value={
                        type
                      }
                    >
                      {
                        type
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            {form.related_type ===
            "General" ? (
              <div
                className={
                  styles.composeContext
                }
              >
                <strong>
                  General email
                </strong>

                <span>
                  This email will not be linked to a CRM record.
                </span>
              </div>
            ) : (
              <label
                className={
                  styles.composeField
                }
              >
                <span>
                  {
                    form.related_type
                  }
                </span>

                <select
                  name="related_id"
                  value={
                    form.related_id
                  }
                  onChange={
                    onChange
                  }
                  disabled={
                    sending
                  }
                >
                  <option value="">
                    Select{" "}
                    {form.related_type.toLowerCase()}
                  </option>

                  {relatedRecords.map(
                    (
                      record
                    ) => (
                      <option
                        key={
                          record.id
                        }
                        value={
                          record.id
                        }
                      >
                        {
                          record.label
                        }
                      </option>
                    )
                  )}
                </select>
              </label>
            )}

            <label
              className={`${styles.composeField} ${styles.composeFieldFull}`}
            >
              <span>
                To
              </span>

              <input
                type="email"
                name="to"
                value={
                  form.to
                }
                onChange={
                  onChange
                }
                disabled={
                  sending
                }
                placeholder="recipient@example.com"
              />

              {form.related_type !==
                "General" &&
                !form.to && (
                  <small>
                    If the selected record has no email address, enter one manually.
                  </small>
                )}
            </label>

            <label
              className={`${styles.composeField} ${styles.composeFieldFull}`}
            >
              <span>
                Subject
              </span>

              <input
                name="subject"
                value={
                  form.subject
                }
                onChange={
                  onChange
                }
                disabled={
                  sending
                }
                placeholder="Email subject"
              />
            </label>

            <label
              className={`${styles.composeField} ${styles.composeFieldFull}`}
            >
              <span>
                Message
              </span>

              <textarea
                name="message"
                rows={10}
                value={
                  form.message
                }
                onChange={
                  onChange
                }
                disabled={
                  sending
                }
                placeholder="Write your message..."
              />
            </label>
          </div>

          <div
            className={
              styles.composeFooter
            }
          >
            <div
              className={
                styles.aiDraftArea
              }
            >
              <button
                type="button"
                className={
                  styles.aiDraftButton
                }
                onClick={
                  onGenerateDraft
                }
                disabled={
                  sending ||
                  generatingDraft
                }
              >
                {generatingDraft
                  ? "✦ Drafting..."
                  : "✦ Draft with AI"}
              </button>

              {aiDraftError && (
                <small
                  className={
                    styles.aiDraftError
                  }
                >
                  {
                    aiDraftError
                  }
                </small>
              )}
            </div>

            <div
              className={
                styles.composeActions
              }
            >
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  onClose
                }
                disabled={
                  sending
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className={
                  styles.primaryButton
                }
                disabled={
                  sending ||
                  generatingDraft
                }
              >
                {sending
                  ? "Sending..."
                  : "Send email"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

// =========================================================
// EMAIL ROW
// =========================================================

function EmailRow({
  log,
}) {
  const relatedLink =
    getRelatedLink(
      log
    );

  const failed =
    normaliseValue(
      log.status
    ) ===
    "failed";

  return (
    <tr>
      <td>
        <div
          className={
            styles.emailIdentity
          }
        >
          <span
            className={
              styles.emailIcon
            }
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
              className={
                styles.emailLink
              }
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
          className={
            styles.recipient
          }
        >
          {log.recipient ||
            log.recipient_email ||
            "No recipient"}
        </span>
      </td>

      <td>
        <span
          className={
            styles.typeBadge
          }
        >
          {log.email_type ||
            log.record_type ||
            "General"}
        </span>
      </td>

      <td>
        <StatusBadge
          status={
            log.status ||
            "Unknown"
          }
        />
      </td>

      <td>
        {relatedLink ? (
          <Link
            href={
              relatedLink
            }
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
          className={
            styles.dateText
          }
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
          className={
            styles.openButton
          }
        >
          Open →
        </Link>
      </td>
    </tr>
  );
}

// =========================================================
// SUPPORTING COMPONENTS
// =========================================================

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
        styles[
          `summary${tone}`
        ] ||
        ""
      }`}
    >
      <span
        className={
          styles.summaryIcon
        }
      >
        {icon}
      </span>

      <span
        className={
          styles.summaryLabel
        }
      >
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {detail}
      </small>
    </div>
  );
}

function EmptyState({
  filtersActive,
  onClearFilters,
  onCompose,
}) {
  return (
    <div
      className={
        styles.emptyState
      }
    >
      <span
        className={
          styles.emptyIcon
        }
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
          : "Compose an email or send a proposal/invoice to create your first delivery record."}
      </p>

      {filtersActive ? (
        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={
            onClearFilters
          }
        >
          Clear filters
        </button>
      ) : (
        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={
            onCompose
          }
        >
          Compose email
        </button>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <section
      className={
        styles.loadingPanel
      }
    >
      {Array.from({
        length:
          5,
      }).map(
        (
          _,
          index
        ) => (
          <div
            key={
              index
            }
            className={
              styles.loadingRow
            }
          />
        )
      )}
    </section>
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

function getRelatedRecords({
  relatedType,
  leads,
  customers,
  projects,
}) {
  if (
    relatedType ===
    "Lead"
  ) {
    return leads.map(
      (
        lead
      ) => ({
        id:
          lead.id,

        label:
          [
            lead.name ||
              "Unnamed lead",

            lead.company,
          ]
            .filter(
              Boolean
            )
            .join(
              " — "
            ),
      })
    );
  }

  if (
    relatedType ===
    "Customer"
  ) {
    return customers.map(
      (
        customer
      ) => ({
        id:
          customer.id,

        label:
          customer.customer_name ||
          customer.name ||
          customer.company ||
          "Unnamed customer",
      })
    );
  }

  if (
    relatedType ===
    "Project"
  ) {
    return projects.map(
      (
        project
      ) => ({
        id:
          project.id,

        label:
          project.project_name ||
          project.name ||
          project.title ||
          "Unnamed project",
      })
    );
  }

  return [];
}

function getSelectedRelatedRecord({
  relatedType,
  relatedId,
  leads,
  customers,
  projects,
}) {
  if (
    !relatedId
  ) {
    return null;
  }

  const source =
    relatedType ===
    "Lead"
      ? leads
      : relatedType ===
          "Customer"
        ? customers
        : relatedType ===
            "Project"
          ? projects
          : [];

  return (
    source.find(
      (
        item
      ) =>
        String(
          item.id
        ) ===
        String(
          relatedId
        )
    ) ||
    null
  );
}

function getRelatedEmail({
  relatedType,
  relatedId,
  leads,
  customers,
}) {
  if (
    !relatedId
  ) {
    return "";
  }

  if (
    relatedType ===
    "Lead"
  ) {
    const lead =
      leads.find(
        (
          item
        ) =>
          String(
            item.id
          ) ===
          String(
            relatedId
          )
      );

    return lead?.email ||
      "";
  }

  if (
    relatedType ===
    "Customer"
  ) {
    const customer =
      customers.find(
        (
          item
        ) =>
          String(
            item.id
          ) ===
          String(
            relatedId
          )
      );

    return customer?.email ||
      "";
  }

  return "";
}

function getRelatedLink(
  log
) {
  const id =
    log.related_record_id ||
    log.record_id;

  if (
    !id
  ) {
    return null;
  }

  const type =
    normaliseValue(
      log.email_type ||
      log.record_type
    );

  if (
    type ===
    "proposal"
  ) {
    return `/proposals/${id}`;
  }

  if (
    type ===
    "invoice"
  ) {
    return `/invoices/${id}`;
  }

  if (
    type ===
    "lead"
  ) {
    return `/leads/${id}`;
  }

  if (
    type ===
    "customer"
  ) {
    return `/customers/${id}`;
  }

  if (
    type ===
    "project"
  ) {
    return `/projects/${id}`;
  }

  return null;
}

function normaliseValue(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
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

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";

import styles from "./approvals.module.css";

export default function ApprovalsPage() {
  const [
    approvals,
    setApprovals,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    summary,
    setSummary,
  ] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    changesRequested: 0,
  });

  const [
    canManage,
    setCanManage,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("Pending");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    selectedApproval,
    setSelectedApproval,
  ] = useState(null);

  const [
    decisionType,
    setDecisionType,
  ] = useState("");

  const [
    decisionComment,
    setDecisionComment,
  ] = useState("");

  const [
    delegatedTo,
    setDelegatedTo,
  ] = useState("");

  const [
    processing,
    setProcessing,
  ] = useState(false);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const loadApprovals =
    useCallback(async () => {
      try {
        setLoading(true);

        setErrorMessage("");

        const response =
          await fetch(
            "/api/approvals",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load approvals."
          );
        }

        setApprovals(
          data.approvals ||
            []
        );

        setEmployees(
          data.employees ||
            []
        );

        setSummary(
          data.summary || {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            changesRequested: 0,
          }
        );

        setCanManage(
          Boolean(
            data.canManage
          )
        );
      } catch (error) {
        console.error(
          "Approval loading error:",
          error
        );

        setErrorMessage(
          error.message ||
            "Unable to load approvals."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const filteredApprovals =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return approvals.filter(
        (approval) => {
          const pending =
            approval.status ===
              "Pending" ||
            approval.status ===
              "Waiting";

          let matchesStatus =
            true;

          if (
            statusFilter ===
            "Pending"
          ) {
            matchesStatus =
              pending;
          }

          if (
            statusFilter ===
            "Approved"
          ) {
            matchesStatus =
              approval.decision ===
              "Approved";
          }

          if (
            statusFilter ===
            "Rejected"
          ) {
            matchesStatus =
              approval.decision ===
              "Rejected";
          }

          if (
            statusFilter ===
            "RequestChanges"
          ) {
            matchesStatus =
              approval.decision ===
              "RequestChanges";
          }

          if (!matchesStatus) {
            return false;
          }

          if (!query) {
            return true;
          }

          const searchable =
            [
              approval.workflow
                ?.name,
              approval.workflow
                ?.code,
              approval.step
                ?.name,
              approval.workflow_run
                ?.record_type,
              approval.assigned_employee
                ?.full_name,
              approval.assigned_employee
                ?.email,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

          return searchable.includes(
            query
          );
        }
      );
    }, [
      approvals,
      search,
      statusFilter,
    ]);

  function openDecision(
    approval,
    decision
  ) {
    setSelectedApproval(
      approval
    );

    setDecisionType(
      decision
    );

    setDecisionComment(
      ""
    );

    setDelegatedTo(
      ""
    );

    setSuccessMessage(
      ""
    );
  }

  function closeDecision() {
    if (processing) {
      return;
    }

    setSelectedApproval(
      null
    );

    setDecisionType(
      ""
    );

    setDecisionComment(
      ""
    );

    setDelegatedTo(
      ""
    );
  }

  async function submitDecision() {
    if (
      !selectedApproval ||
      !decisionType
    ) {
      return;
    }

    if (
      decisionType ===
        "Delegate" &&
      !delegatedTo
    ) {
      setErrorMessage(
        "Please select an employee to delegate this approval to."
      );

      return;
    }

    try {
      setProcessing(true);

      setErrorMessage("");

      const response =
        await fetch(
          `/api/approvals/${selectedApproval.id}/decision`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                decision:
                  decisionType,

                comment:
                  decisionComment,

                delegated_to:
                  decisionType ===
                  "Delegate"
                    ? delegatedTo
                    : null,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to process approval."
        );
      }

      setSuccessMessage(
        data.message ||
          "Approval updated successfully."
      );

      await loadApprovals();

      setTimeout(() => {
        closeDecision();
      }, 800);
    } catch (error) {
      console.error(
        "Approval decision error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to process approval."
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <ProtectedRoute>
      <AppLayout
        title="My Approvals"
        description="Review and action business approvals assigned to you."
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
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                My Work
              </span>

              <h2>
                Approval Inbox
              </h2>

              <p>
                Review pending
                business decisions
                and keep workflows
                moving.
              </p>
            </div>

            {canManage && (
              <span
                className={
                  styles.adminBadge
                }
              >
                Administrator view
              </span>
            )}
          </section>

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              label="Pending"
              value={
                summary.pending
              }
              icon="◷"
            />

            <SummaryCard
              label="Approved"
              value={
                summary.approved
              }
              icon="✓"
            />

            <SummaryCard
              label="Rejected"
              value={
                summary.rejected
              }
              icon="×"
            />

            <SummaryCard
              label="Changes requested"
              value={
                summary.changesRequested
              }
              icon="↻"
            />
          </section>

          <section
            className={
              styles.toolbar
            }
          >
            <div
              className={
                styles.searchWrapper
              }
            >
              <span>
                ⌕
              </span>

              <input
                value={
                  search
                }
                placeholder="Search workflow, approval or employee..."
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
              />
            </div>

            <select
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
            >
              <option value="Pending">
                Pending
              </option>

              <option value="Approved">
                Approved
              </option>

              <option value="Rejected">
                Rejected
              </option>

              <option value="RequestChanges">
                Changes requested
              </option>

              <option value="All">
                All approvals
              </option>
            </select>
          </section>

          {errorMessage && (
            <div
              className={
                styles.errorMessage
              }
            >
              {errorMessage}
            </div>
          )}

          <section
            className={
              styles.approvalPanel
            }
          >
            <div
              className={
                styles.panelHeader
              }
            >
              <div>
                <h3>
                  {statusFilter ===
                  "Pending"
                    ? "Pending approvals"
                    : "Approval history"}
                </h3>

                <p>
                  {
                    filteredApprovals.length
                  }{" "}
                  approval
                  {filteredApprovals.length ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>
            </div>

            {loading ? (
              <div
                className={
                  styles.loadingList
                }
              >
                <div />
                <div />
                <div />
              </div>
            ) : filteredApprovals.length ===
              0 ? (
              <div
                className={
                  styles.emptyState
                }
              >
                <span>
                  ✓
                </span>

                <h3>
                  Nothing waiting
                  here
                </h3>

                <p>
                  There are no
                  approvals matching
                  the selected filter.
                </p>
              </div>
            ) : (
              <div
                className={
                  styles.approvalList
                }
              >
                {filteredApprovals.map(
                  (
                    approval
                  ) => (
                    <ApprovalCard
                      key={
                        approval.id
                      }
                      approval={
                        approval
                      }
                      onDecision={
                        openDecision
                      }
                    />
                  )
                )}
              </div>
            )}
          </section>
        </div>

        {selectedApproval && (
          <div
            className={
              styles.modalBackdrop
            }
            onMouseDown={
              closeDecision
            }
          >
            <section
              className={
                styles.modal
              }
              onMouseDown={(
                event
              ) =>
                event.stopPropagation()
              }
            >
              <div
                className={
                  styles.modalHeader
                }
              >
                <div>
                  <span
                    className={
                      styles.eyebrow
                    }
                  >
                    Approval decision
                  </span>

                  <h3>
                    {
                      selectedApproval
                        .step
                        ?.name
                    }
                  </h3>

                  <p>
                    {
                      selectedApproval
                        .workflow
                        ?.name
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeDecision
                  }
                  disabled={
                    processing
                  }
                >
                  ×
                </button>
              </div>

              <div
                className={
                  styles.modalBody
                }
              >
                <div
                  className={
                    styles.decisionSummary
                  }
                >
                  <span>
                    Decision
                  </span>

                  <strong>
                    {decisionLabel(
                      decisionType
                    )}
                  </strong>
                </div>

                {decisionType ===
                  "Delegate" && (
                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      Delegate to
                    </span>

                    <select
                      value={
                        delegatedTo
                      }
                      onChange={(
                        event
                      ) =>
                        setDelegatedTo(
                          event
                            .target
                            .value
                        )
                      }
                      disabled={
                        processing
                      }
                    >
                      <option value="">
                        Select employee
                      </option>

                      {employees.map(
                        (
                          employee
                        ) => (
                          <option
                            key={
                              employee.id
                            }
                            value={
                              employee.id
                            }
                          >
                            {
                              employee.full_name
                            }
                            {employee.job_title
                              ? ` — ${employee.job_title}`
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                )}

                <label
                  className={
                    styles.field
                  }
                >
                  <span>
                    Comment
                    {decisionType ===
                    "RequestChanges"
                      ? " *"
                      : ""}
                  </span>

                  <textarea
                    rows={5}
                    value={
                      decisionComment
                    }
                    placeholder={
                      decisionType ===
                      "RequestChanges"
                        ? "Explain what needs to be changed..."
                        : "Add an optional comment..."
                    }
                    onChange={(
                      event
                    ) =>
                      setDecisionComment(
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      processing
                    }
                  />
                </label>

                {successMessage && (
                  <div
                    className={
                      styles.successMessage
                    }
                  >
                    {
                      successMessage
                    }
                  </div>
                )}
              </div>

              <div
                className={
                  styles.modalFooter
                }
              >
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={
                    closeDecision
                  }
                  disabled={
                    processing
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={
                    decisionType ===
                    "Reject"
                      ? styles.dangerButton
                      : styles.primaryButton
                  }
                  onClick={
                    submitDecision
                  }
                  disabled={
                    processing ||
                    (
                      decisionType ===
                        "RequestChanges" &&
                      !decisionComment.trim()
                    )
                  }
                >
                  {processing
                    ? "Processing..."
                    : confirmLabel(
                        decisionType
                      )}
                </button>
              </div>
            </section>
          </div>
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}

function ApprovalCard({
  approval,
  onDecision,
}) {
  const pending =
    approval.status ===
      "Pending" ||
    approval.status ===
      "Waiting";

  return (
    <article
      className={
        styles.approvalCard
      }
    >
      <div
        className={
          styles.approvalIcon
        }
      >
        ✓
      </div>

      <div
        className={
          styles.approvalMain
        }
      >
        <div
          className={
            styles.approvalTitleRow
          }
        >
          <div>
            <span
              className={
                styles.workflowCode
              }
            >
              {approval.workflow
                ?.code ||
                "WORKFLOW"}
            </span>

            <h3>
              {approval.step
                ?.name ||
                "Approval"}
            </h3>

            <p>
              {approval.workflow
                ?.name ||
                "Business approval"}
            </p>
          </div>

          <DecisionBadge
            approval={
              approval
            }
          />
        </div>

        <div
          className={
            styles.metaGrid
          }
        >
          <Meta
            label="Module"
            value={
              approval.workflow
                ?.module ||
              "—"
            }
          />

          <Meta
            label="Record"
            value={
              approval.workflow_run
                ?.record_type ||
              "Test record"
            }
          />

          <Meta
            label="Assigned to"
            value={
              approval
                .assigned_employee
                ?.full_name ||
              "Not resolved"
            }
          />

          <Meta
            label="Created"
            value={formatDate(
              approval.created_at
            )}
          />
        </div>

        {approval.decision_comment && (
          <div
            className={
              styles.commentBox
            }
          >
            {
              approval.decision_comment
            }
          </div>
        )}

        {pending && (
          <div
            className={
              styles.actions
            }
          >
            <button
              type="button"
              className={
                styles.approveButton
              }
              onClick={() =>
                onDecision(
                  approval,
                  "Approve"
                )
              }
            >
              Approve
            </button>

            <button
              type="button"
              className={
                styles.changeButton
              }
              onClick={() =>
                onDecision(
                  approval,
                  "RequestChanges"
                )
              }
            >
              Request changes
            </button>

            <button
              type="button"
              className={
                styles.rejectButton
              }
              onClick={() =>
                onDecision(
                  approval,
                  "Reject"
                )
              }
            >
              Reject
            </button>

            <button
              type="button"
              className={
                styles.delegateButton
              }
              onClick={() =>
                onDecision(
                  approval,
                  "Delegate"
                )
              }
            >
              Delegate
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function DecisionBadge({
  approval,
}) {
  let label =
    approval.decision ||
    approval.status ||
    "Pending";

  if (
    label ===
    "RequestChanges"
  ) {
    label =
      "Changes requested";
  }

  return (
    <span
      className={`${styles.decisionBadge} ${
        approval.decision ===
        "Approved"
          ? styles.approvedBadge
          : approval.decision ===
              "Rejected"
            ? styles.rejectedBadge
            : approval.decision ===
                "RequestChanges"
              ? styles.changesBadge
              : styles.pendingBadge
      }`}
    >
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}) {
  return (
    <div
      className={
        styles.summaryCard
      }
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
    </div>
  );
}

function Meta({
  label,
  value,
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function decisionLabel(
  decision
) {
  switch (decision) {
    case "Approve":
      return "Approve";

    case "Reject":
      return "Reject";

    case "RequestChanges":
      return "Request changes";

    case "Delegate":
      return "Delegate";

    default:
      return "Decision";
  }
}

function confirmLabel(
  decision
) {
  switch (decision) {
    case "Approve":
      return "Approve";

    case "Reject":
      return "Reject approval";

    case "RequestChanges":
      return "Request changes";

    case "Delegate":
      return "Delegate approval";

    default:
      return "Confirm";
  }
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
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

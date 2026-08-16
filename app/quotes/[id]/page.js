"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import StatusBadge from "../../../components/StatusBadge";
import ProtectedRoute from "../../../components/ProtectedRoute";

import styles from "./quote-details.module.css";

export default function QuoteDetailsPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const quoteId =
    params?.id;

  const [
    quote,
    setQuote,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    converting,
    setConverting,
  ] = useState(false);

  const [
    submittingApproval,
    setSubmittingApproval,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    approvalMessage,
    setApprovalMessage,
  ] = useState("");

  const [
    workflowResult,
    setWorkflowResult,
  ] = useState(null);

  const [
    workflowHistory,
    setWorkflowHistory,
  ] = useState([]);

  const [
    workflowHistoryLoading,
    setWorkflowHistoryLoading,
  ] = useState(false);

  const [
    workflowHistoryError,
    setWorkflowHistoryError,
  ] = useState("");

  const [
    expandedRuns,
    setExpandedRuns,
  ] = useState({});

  const [
    relatedTasks,
    setRelatedTasks,
  ] = useState([]);

  const [
    relatedTasksLoading,
    setRelatedTasksLoading,
  ] = useState(false);

  const [
    relatedTasksError,
    setRelatedTasksError,
  ] = useState("");

  useEffect(() => {
    if (!quoteId) {
      return;
    }

    fetchQuote();
    fetchWorkflowHistory();
    fetchRelatedTasks();
  }, [
    quoteId,
  ]);

  // =======================================================
  // QUOTE
  // =======================================================

  async function fetchQuote() {
    try {
      setLoading(true);

      setErrorMessage("");

      const directResponse =
        await fetch(
          `/api/quotes/${quoteId}`,
          {
            cache:
              "no-store",
          }
        );

      if (
        directResponse.ok
      ) {
        const directData =
          await directResponse.json();

        const selectedQuote =
          Array.isArray(
            directData
          )
            ? directData[0]
            : directData;

        setQuote(
          selectedQuote ||
            null
        );

        return;
      }

      const response =
        await fetch(
          "/api/quotes",
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load quote."
        );
      }

      const selectedQuote =
        (
          Array.isArray(
            data
          )
            ? data
            : []
        ).find(
          (item) =>
            String(
              item.id
            ) ===
            String(
              quoteId
            )
        );

      setQuote(
        selectedQuote ||
          null
      );
    } catch (error) {
      console.error(
        "Quote loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load this quote."
      );
    } finally {
      setLoading(false);
    }
  }

  // =======================================================
  // RELATED TASKS
  // =======================================================

  async function fetchRelatedTasks() {
    if (!quoteId) {
      return;
    }

    try {
      setRelatedTasksLoading(
        true
      );

      setRelatedTasksError(
        ""
      );

      const response =
        await fetch(
          `/api/tasks?scope=record&record_type=quote&record_id=${encodeURIComponent(
            quoteId
          )}`,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load related work."
        );
      }

      setRelatedTasks(
        Array.isArray(
          data?.tasks
        )
          ? data.tasks
          : []
      );
    } catch (error) {
      console.error(
        "Quote related work loading error:",
        error
      );

      setRelatedTasksError(
        error.message ||
          "Unable to load related work."
      );
    } finally {
      setRelatedTasksLoading(
        false
      );
    }
  }

  // =======================================================
  // WORKFLOW HISTORY
  // =======================================================

  async function fetchWorkflowHistory() {
    if (!quoteId) {
      return;
    }

    try {
      setWorkflowHistoryLoading(
        true
      );

      setWorkflowHistoryError(
        ""
      );

      const response =
        await fetch(
          `/api/quotes/${quoteId}/workflow-history`,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load workflow history."
        );
      }

      const runs =
        Array.isArray(
          data.runs
        )
          ? data.runs
          : [];

      setWorkflowHistory(
        runs
      );

      if (
        runs.length >
        0
      ) {
        setExpandedRuns(
          (
            current
          ) => {
            const next = {
              ...current,
            };

            runs.forEach(
              (
                run,
                index
              ) => {
                if (
                  next[
                    run.id
                  ] ===
                  undefined
                ) {
                  next[
                    run.id
                  ] =
                    index ===
                    0;
                }
              }
            );

            return next;
          }
        );
      }
    } catch (error) {
      console.error(
        "Workflow history loading error:",
        error
      );

      setWorkflowHistoryError(
        error.message ||
          "Unable to load workflow history."
      );
    } finally {
      setWorkflowHistoryLoading(
        false
      );
    }
  }

  function toggleRun(
    runId
  ) {
    setExpandedRuns(
      (
        current
      ) => ({
        ...current,

        [runId]:
          !current[
            runId
          ],
      })
    );
  }

  function downloadPDF() {
    window.print();
  }

  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(
        quote?.quote_text ||
          ""
      );

      alert(
        "Quote copied successfully."
      );
    } catch (error) {
      console.error(
        "Quote copy error:",
        error
      );

      alert(
        "Unable to copy the quote."
      );
    }
  }

  // =======================================================
  // APPROVAL
  // =======================================================

  async function submitForApproval() {
    if (
      !quote ||
      submittingApproval
    ) {
      return;
    }

    const currentStatus =
      normaliseStatus(
        quote.status
      );

    if (
      currentStatus ===
      "pending approval"
    ) {
      setApprovalMessage(
        "This quote is already pending approval."
      );

      return;
    }

    if (
      currentStatus ===
        "approved" ||
      currentStatus ===
        "accepted"
    ) {
      setApprovalMessage(
        `This quote is already ${quote.status}.`
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Submit ${
          quote.quote_number ||
          "this quote"
        } for approval?\n\nOnce submitted, the quote will move to Pending Approval and the configured workflow will start.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSubmittingApproval(
        true
      );

      setErrorMessage("");
      setApprovalMessage("");
      setWorkflowResult(
        null
      );

      const response =
        await fetch(
          `/api/quotes/${quote.id}`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "submit_for_approval",
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to submit quote for approval."
        );
      }

      if (data.quote) {
        setQuote(
          data.quote
        );
      } else {
        await fetchQuote();
      }

      setWorkflowResult(
        data.workflow ||
          null
      );

      setApprovalMessage(
        data.message ||
          "Quote submitted for approval successfully."
      );

      await Promise.all([
        fetchWorkflowHistory(),
        fetchRelatedTasks(),
      ]);
    } catch (error) {
      console.error(
        "Quote approval submission error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to submit quote for approval."
      );
    } finally {
      setSubmittingApproval(
        false
      );
    }
  }

  // =======================================================
  // CONVERT
  // =======================================================

  async function convertToCustomer() {
    if (
      !quote ||
      converting
    ) {
      return;
    }

    if (
      quote.customer_id
    ) {
      router.push(
        `/customers/${quote.customer_id}`
      );

      return;
    }

    try {
      setConverting(true);

      const response =
        await fetch(
          `/api/quotes/${quote.id}/convert`,
          {
            method:
              "POST",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to convert quote to customer."
        );
      }

      if (
        !data.customer?.id
      ) {
        throw new Error(
          "Customer conversion completed, but no customer ID was returned."
        );
      }

      setQuote(
        data.quote ||
          quote
      );

      alert(
        data.message ||
          "Quote converted successfully."
      );

      router.push(
        `/customers/${data.customer.id}`
      );
    } catch (error) {
      console.error(
        "Quote conversion error:",
        error
      );

      alert(
        error.message ||
          "Error converting quote to customer."
      );
    } finally {
      setConverting(false);
    }
  }

  // =======================================================
  // STATES
  // =======================================================

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Quote Workspace"
          description="Loading quotation information."
        >
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (
    errorMessage &&
    !quote
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Quote Workspace"
          description="Review a commercial quotation."
        >
          <section
            className={
              styles.errorPanel
            }
          >
            <div>
              <strong>
                Unable to load quote
              </strong>

              <p>
                {errorMessage}
              </p>
            </div>

            <button
              type="button"
              className={
                styles.secondaryButton
              }
              onClick={
                fetchQuote
              }
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!quote) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Quote Workspace"
          description="Review a commercial quotation."
        >
          <section
            className={
              styles.notFound
            }
          >
            <span
              className={
                styles.notFoundIcon
              }
            >
              ◇
            </span>

            <h2>
              Quote not found
            </h2>

            <p>
              This quotation may
              have been deleted or
              you may not have
              access to it.
            </p>

            <Link
              href="/quotes"
              className={
                styles.primaryButton
              }
            >
              Return to quotes
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // DERIVED VALUES
  // =======================================================

  const amount =
    formatQuoteAmount(
      quote.amount
    );

  const quoteStatus =
    normaliseStatus(
      quote.status
    );

  const isPendingApproval =
    quoteStatus ===
    "pending approval";

  const isApproved =
    quoteStatus ===
    "approved";

  const isAccepted =
    quoteStatus ===
    "accepted";

  const isRejected =
    quoteStatus ===
    "rejected";

  const canSubmitForApproval =
    !isPendingApproval &&
    !isApproved &&
    !isAccepted;

  const canConvertToCustomer =
    isApproved ||
    isAccepted ||
    Boolean(
      quote.customer_id
    );

  const openTaskCount =
    relatedTasks.filter(
      (task) =>
        !isTaskCompleted(
          task.status
        )
    ).length;

  const completedTaskCount =
    relatedTasks.filter(
      (task) =>
        isTaskCompleted(
          task.status
        )
    ).length;

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          quote.quote_number ||
          "Quote Workspace"
        }
        description="Quotation details, client information and approval workflow."
      >
        <div
          className={
            styles.page
          }
        >
          {/* HEADER */}

          <section
            className={`${styles.pageHeader} ${styles.noPrint}`}
          >
            <div
              className={
                styles.headerCopy
              }
            >
              <Link
                href="/quotes"
                className={
                  styles.backLink
                }
              >
                ← Back to quotes
              </Link>

              <span
                className={
                  styles.eyebrow
                }
              >
                Quote workspace
              </span>

              <h2>
                {quote.quote_number ||
                  "Quote"}
              </h2>

              <p>
                Review the full
                quotation, submit it
                for internal approval
                and continue the
                customer workflow.
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
                onClick={
                  copyQuote
                }
              >
                Copy quote
              </button>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  downloadPDF
                }
              >
                Download PDF
              </button>

              {canSubmitForApproval && (
                <button
                  type="button"
                  className={
                    styles.primaryButton
                  }
                  disabled={
                    submittingApproval
                  }
                  onClick={
                    submitForApproval
                  }
                >
                  {submittingApproval
                    ? "Submitting..."
                    : isRejected
                      ? "Resubmit for approval"
                      : "Submit for approval"}
                </button>
              )}

              {isPendingApproval && (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  disabled
                >
                  Pending approval
                </button>
              )}

              {isApproved && (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  disabled
                >
                  Approved
                </button>
              )}

              <button
                type="button"
                className={
                  styles.primaryButton
                }
                disabled={
                  converting ||
                  !canConvertToCustomer
                }
                onClick={
                  convertToCustomer
                }
                title={
                  canConvertToCustomer
                    ? undefined
                    : "The quote must be approved before it can be converted to a customer."
                }
              >
                {converting
                  ? "Converting..."
                  : quote.customer_id
                    ? "View customer"
                    : "Convert to customer"}
              </button>
            </div>
          </section>

          {/* SUCCESS */}

          {approvalMessage && (
            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <h3>
                    Workflow started
                  </h3>

                  <p>
                    {
                      approvalMessage
                    }
                  </p>
                </div>

                <StatusBadge
                  status={
                    quote.status ||
                    "Draft"
                  }
                />
              </div>
            </section>
          )}

          {/* ERROR */}

          {errorMessage &&
            quote && (
              <section
                className={
                  styles.errorPanel
                }
              >
                <div>
                  <strong>
                    Quote action failed
                  </strong>

                  <p>
                    {errorMessage}
                  </p>
                </div>

                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={() =>
                    setErrorMessage(
                      ""
                    )
                  }
                >
                  Dismiss
                </button>
              </section>
            )}

          {/* HERO */}

          <section
            className={
              styles.heroCard
            }
          >
            <div
              className={
                styles.quoteIdentity
              }
            >
              <span
                className={
                  styles.quoteIcon
                }
              >
                ◇
              </span>

              <div
                className={
                  styles.quoteIdentityCopy
                }
              >
                <span
                  className={
                    styles.heroLabel
                  }
                >
                  Commercial quotation
                </span>

                <h3>
                  {quote.client ||
                    "Unnamed client"}
                </h3>

                <p>
                  {quote.service ||
                    "Professional services"}
                </p>

                <div
                  className={
                    styles.identityMeta
                  }
                >
                  <StatusBadge
                    status={
                      quote.status ||
                      "Draft"
                    }
                  />

                  <span
                    className={
                      styles.metaBadge
                    }
                  >
                    Created{" "}
                    {formatDate(
                      quote.created_at
                    )}
                  </span>

                  {quote.customer_id && (
                    <span
                      className={
                        styles.linkedBadge
                      }
                    >
                      Linked customer
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div
              className={
                styles.amountCard
              }
            >
              <span>
                Quote value
              </span>

              <strong>
                {amount}
              </strong>

              <small>
                {quote.status ||
                  "Draft"}
              </small>
            </div>
          </section>

          {/* APPROVAL */}

          <section
            className={
              styles.panel
            }
          >
            <div
              className={
                styles.panelHeader
              }
            >
              <div>
                <h3>
                  Approval workflow
                </h3>

                <p>
                  Internal quote
                  approval and business
                  process status.
                </p>
              </div>

              <StatusBadge
                status={
                  quote.status ||
                  "Draft"
                }
              />
            </div>

            <div
              className={
                styles.detailList
              }
            >
              <DetailRow
                label="Current status"
                customValue={
                  <StatusBadge
                    status={
                      quote.status ||
                      "Draft"
                    }
                  />
                }
              />

              <DetailRow
                label="Approval state"
                value={
                  getApprovalState(
                    quote.status
                  )
                }
              />

              {workflowResult && (
                <>
                  <DetailRow
                    label="Triggered workflows"
                    value={String(
                      workflowResult.workflow_count ??
                        0
                    )}
                  />

                  <DetailRow
                    label="Workflow event"
                    value={
                      workflowResult
                        .event
                        ?.event_name ||
                      "Quote Submitted"
                    }
                  />

                  <DetailRow
                    label="Event status"
                    value={
                      workflowResult
                        .event
                        ?.status ||
                      "Processed"
                    }
                  />
                </>
              )}

              {isPendingApproval && (
                <DetailRow
                  label="Next action"
                  customValue={
                    <Link
                      href="/approvals"
                      className={
                        styles.customerLink
                      }
                    >
                      Open My Approvals →
                    </Link>
                  }
                />
              )}
            </div>
          </section>

          {/* WORKFLOW HISTORY */}

          <section
            className={`${styles.workflowHistoryPanel} ${styles.noPrint}`}
          >
            <div
              className={
                styles.workflowHistoryHeader
              }
            >
              <div>
                <span
                  className={
                    styles.eyebrow
                  }
                >
                  Automation audit
                </span>

                <h3>
                  Workflow history
                </h3>

                <p>
                  Review every
                  automation run and
                  action executed for
                  this quotation.
                </p>
              </div>

              <div
                className={
                  styles.workflowHistoryHeaderActions
                }
              >
                {!workflowHistoryLoading &&
                  workflowHistory.length >
                    0 && (
                    <span
                      className={
                        styles.workflowRunCount
                      }
                    >
                      {
                        workflowHistory.length
                      }{" "}
                      run
                      {workflowHistory.length ===
                      1
                        ? ""
                        : "s"}
                    </span>
                  )}

                <button
                  type="button"
                  className={
                    styles.workflowRefreshButton
                  }
                  onClick={
                    fetchWorkflowHistory
                  }
                  disabled={
                    workflowHistoryLoading
                  }
                >
                  ↻
                </button>
              </div>
            </div>

            {workflowHistoryLoading ? (
              <WorkflowHistoryLoading />
            ) : workflowHistoryError ? (
              <div
                className={
                  styles.workflowHistoryError
                }
              >
                <span>
                  !
                </span>

                <div>
                  <strong>
                    Unable to load
                    workflow history
                  </strong>

                  <p>
                    {
                      workflowHistoryError
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={
                    fetchWorkflowHistory
                  }
                >
                  Retry
                </button>
              </div>
            ) : workflowHistory.length ===
              0 ? (
              <div
                className={
                  styles.workflowEmpty
                }
              >
                <span>
                  ◌
                </span>

                <h4>
                  No workflow runs yet
                </h4>

                <p>
                  When this quote
                  enters an automation,
                  its execution history
                  will appear here.
                </p>
              </div>
            ) : (
              <div
                className={
                  styles.workflowRuns
                }
              >
                {workflowHistory.map(
                  (
                    run,
                    runIndex
                  ) => (
                    <WorkflowRunCard
                      key={
                        run.id
                      }
                      run={
                        run
                      }
                      runNumber={
                        workflowHistory.length -
                        runIndex
                      }
                      expanded={
                        Boolean(
                          expandedRuns[
                            run.id
                          ]
                        )
                      }
                      onToggle={() =>
                        toggleRun(
                          run.id
                        )
                      }
                    />
                  )
                )}
              </div>
            )}
          </section>

          {/* RELATED WORK */}

          <section
            className={`${styles.relatedWorkPanel} ${styles.noPrint}`}
          >
            <div
              className={
                styles.relatedWorkHeader
              }
            >
              <div>
                <span
                  className={
                    styles.eyebrow
                  }
                >
                  Execution follow-through
                </span>

                <h3>
                  Related work
                </h3>

                <p>
                  Tasks created manually
                  or by workflows for
                  this quotation.
                </p>
              </div>

              <div
                className={
                  styles.relatedWorkActions
                }
              >
                {!relatedTasksLoading &&
                  relatedTasks.length >
                    0 && (
                    <>
                      <span
                        className={
                          styles.relatedWorkMetric
                        }
                      >
                        {
                          openTaskCount
                        }{" "}
                        open
                      </span>

                      <span
                        className={
                          styles.relatedWorkMetricSuccess
                        }
                      >
                        {
                          completedTaskCount
                        }{" "}
                        completed
                      </span>
                    </>
                  )}

                <button
                  type="button"
                  className={
                    styles.workflowRefreshButton
                  }
                  disabled={
                    relatedTasksLoading
                  }
                  onClick={
                    fetchRelatedTasks
                  }
                  title="Refresh related work"
                >
                  ↻
                </button>
              </div>
            </div>

            {relatedTasksLoading ? (
              <div
                className={
                  styles.relatedWorkLoading
                }
              >
                <div />
                <div />
              </div>
            ) : relatedTasksError ? (
              <div
                className={
                  styles.relatedWorkError
                }
              >
                <div>
                  <strong>
                    Unable to load related work
                  </strong>

                  <p>
                    {
                      relatedTasksError
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={
                    fetchRelatedTasks
                  }
                >
                  Retry
                </button>
              </div>
            ) : relatedTasks.length ===
              0 ? (
              <div
                className={
                  styles.relatedWorkEmpty
                }
              >
                <span>
                  ☑
                </span>

                <h4>
                  No related tasks
                </h4>

                <p>
                  When a workflow or
                  employee creates a
                  task for this quote,
                  it will appear here.
                </p>
              </div>
            ) : (
              <div
                className={
                  styles.relatedWorkList
                }
              >
                {relatedTasks.map(
                  (task) => (
                    <RelatedTaskCard
                      key={
                        task.id
                      }
                      task={
                        task
                      }
                    />
                  )
                )}
              </div>
            )}
          </section>

          {/* DETAILS */}

          <section
            className={
              styles.detailsGrid
            }
          >
            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <h3>
                    Client information
                  </h3>

                  <p>
                    Sensitive contact
                    information
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.detailList
                }
              >
                <DetailRow
                  label="Client"
                  value={
                    quote.client
                  }
                />

                <DetailRow
                  label="Primary contact"
                  value={
                    quote.contact
                  }
                />

                <DetailRow
                  label="Email"
                  value={
                    quote.email
                  }
                  href={
                    quote.email
                      ? `mailto:${quote.email}`
                      : null
                  }
                />

                <DetailRow
                  label="Phone"
                  value={
                    quote.phone
                  }
                  href={
                    quote.phone
                      ? `tel:${quote.phone}`
                      : null
                  }
                />
              </div>
            </section>

            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.panelHeader
                }
              >
                <div>
                  <h3>
                    Quote information
                  </h3>

                  <p>
                    Commercial and
                    workflow details
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.detailList
                }
              >
                <DetailRow
                  label="Quote number"
                  value={
                    quote.quote_number
                  }
                />

                <DetailRow
                  label="Service"
                  value={
                    quote.service
                  }
                />

                <DetailRow
                  label="Amount"
                  value={
                    amount
                  }
                />

                <DetailRow
                  label="Status"
                  customValue={
                    <StatusBadge
                      status={
                        quote.status ||
                        "Draft"
                      }
                    />
                  }
                />

                <DetailRow
                  label="Created"
                  value={formatDate(
                    quote.created_at
                  )}
                />

                <DetailRow
                  label="Customer link"
                  customValue={
                    quote.customer_id ? (
                      <Link
                        href={`/customers/${quote.customer_id}`}
                        className={
                          styles.customerLink
                        }
                      >
                        Open linked
                        customer →
                      </Link>
                    ) : (
                      <strong
                        className={
                          styles.emptyValue
                        }
                      >
                        Not converted
                      </strong>
                    )
                  }
                />
              </div>
            </section>
          </section>

          {/* DOCUMENT */}

          <section
            className={
              styles.documentPanel
            }
          >
            <div
              className={`${styles.documentToolbar} ${styles.noPrint}`}
            >
              <div>
                <span
                  className={
                    styles.eyebrow
                  }
                >
                  Customer document
                </span>

                <h3>
                  Full quotation
                </h3>
              </div>

              <div>
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={
                    copyQuote
                  }
                >
                  Copy
                </button>

                <button
                  type="button"
                  className={
                    styles.primaryButton
                  }
                  onClick={
                    downloadPDF
                  }
                >
                  Export PDF
                </button>
              </div>
            </div>

            <article
              className={
                styles.quoteDocument
              }
            >
              <header
                className={
                  styles.documentHeader
                }
              >
                <div>
                  <span
                    className={
                      styles.documentBrandMark
                    }
                  >
                    SN
                  </span>

                  <div>
                    <strong>
                      SaiNal
                      Technologies Ltd
                    </strong>

                    <p>
                      Business technology
                      solutions
                    </p>
                  </div>
                </div>

                <div
                  className={
                    styles.documentTitle
                  }
                >
                  <span>
                    QUOTE
                  </span>

                  <strong>
                    {quote.quote_number ||
                      "Quote"}
                  </strong>
                </div>
              </header>

              <section
                className={
                  styles.documentMeta
                }
              >
                <div>
                  <span>
                    Prepared for
                  </span>

                  <strong>
                    {quote.client ||
                      "Client"}
                  </strong>

                  <p>
                    {quote.contact ||
                      ""}
                  </p>

                  <p>
                    {quote.email ||
                      ""}
                  </p>

                  <p>
                    {quote.phone ||
                      ""}
                  </p>
                </div>

                <div>
                  <span>
                    Quote date
                  </span>

                  <strong>
                    {formatDate(
                      quote.created_at
                    )}
                  </strong>

                  <span>
                    Status
                  </span>

                  <strong>
                    {quote.status ||
                      "Draft"}
                  </strong>
                </div>
              </section>

              <section
                className={
                  styles.documentSummary
                }
              >
                <div>
                  <span>
                    Service
                  </span>

                  <strong>
                    {quote.service ||
                      "Professional Services"}
                  </strong>
                </div>

                <div>
                  <span>
                    Total
                  </span>

                  <strong>
                    {amount}
                  </strong>
                </div>
              </section>

              <pre
                className={
                  styles.quotePreview
                }
              >
                {quote.quote_text ||
                  "No full quote content is available."}
              </pre>

              <footer
                className={
                  styles.documentFooter
                }
              >
                <p>
                  SaiNal Technologies
                  Ltd
                </p>

                <p>
                  www.sainaltechnologies.com
                </p>
              </footer>
            </article>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// RELATED TASK
// =========================================================

function RelatedTaskCard({
  task,
}) {
  const completed =
    isTaskCompleted(
      task.status
    );

  const overdue =
    isTaskOverdue(
      task
    );

  const assignee =
    task.assigned_employee
      ?.full_name ||
    task.assigned_employee
      ?.email ||
    "Unassigned";

  return (
    <article
      className={
        styles.relatedTaskCard
      }
    >
      <div
        className={
          styles.relatedTaskMain
        }
      >
        <span
          className={`${styles.relatedTaskIcon} ${
            completed
              ? styles.relatedTaskIconCompleted
              : ""
          }`}
        >
          {completed
            ? "✓"
            : "☑"}
        </span>

        <div
          className={
            styles.relatedTaskCopy
          }
        >
          <div
            className={
              styles.relatedTaskTitleRow
            }
          >
            <Link
              href={`/tasks/${task.id}`}
            >
              {task.task_name ||
                "Untitled task"}
            </Link>

            <StatusBadge
              status={
                task.status ||
                "Open"
              }
            />
          </div>

          <p>
            {task.description ||
              "No task description."}
          </p>

          <div
            className={
              styles.relatedTaskMeta
            }
          >
            <span>
              {task.workflow_run_id
                ? "Workflow generated"
                : "Manual task"}
            </span>

            <span>
              {task.priority ||
                "Medium"}{" "}
              priority
            </span>

            <span>
              Assigned to{" "}
              {assignee}
            </span>

            <span
              className={
                overdue
                  ? styles.relatedTaskOverdue
                  : ""
              }
            >
              Due{" "}
              {formatDate(
                task.due_date
              )}
            </span>
          </div>
        </div>
      </div>

      <Link
        href={`/tasks/${task.id}`}
        className={
          styles.relatedTaskOpen
        }
      >
        Open task →
      </Link>
    </article>
  );
}

// =========================================================
// WORKFLOW RUN
// =========================================================

function WorkflowRunCard({
  run,
  runNumber,
  expanded,
  onToggle,
}) {
  const steps =
    Array.isArray(
      run.steps
    )
      ? run.steps
      : [];

  const completedSteps =
    steps.filter(
      (step) =>
        isSuccessfulStatus(
          step.status
        )
    ).length;

  const failedSteps =
    steps.filter(
      (step) =>
        isFailedStatus(
          step.status
        )
    ).length;

  const duration =
    calculateDuration(
      run.started_at,
      run.completed_at
    );

  return (
    <article
      className={
        styles.workflowRunCard
      }
    >
      <button
        type="button"
        className={
          styles.workflowRunSummary
        }
        onClick={
          onToggle
        }
        aria-expanded={
          expanded
        }
      >
        <div
          className={
            styles.workflowRunIdentity
          }
        >
          <span
            className={`${styles.workflowRunIcon} ${getRunStatusClass(
              run.status
            )}`}
          >
            {getStepSymbol(
              run.status
            )}
          </span>

          <div>
            <span
              className={
                styles.workflowRunEyebrow
              }
            >
              Run {runNumber}
            </span>

            <h4>
              {run.workflow_name ||
                "Workflow"}
            </h4>

            <p>
              Started{" "}
              {formatDateTime(
                run.started_at
              )}
            </p>
          </div>
        </div>

        <div
          className={
            styles.workflowRunSummaryRight
          }
        >
          <span
            className={`${styles.workflowRunStatus} ${getRunStatusClass(
              run.status
            )}`}
          >
            {run.status ||
              "Unknown"}
          </span>

          <span
            className={
              styles.workflowChevron
            }
          >
            {expanded
              ? "⌃"
              : "⌄"}
          </span>
        </div>
      </button>

      {expanded && (
        <div
          className={
            styles.workflowRunBody
          }
        >
          <div
            className={
              styles.workflowRunMetrics
            }
          >
            <WorkflowMetric
              label="Steps"
              value={
                String(
                  steps.length
                )
              }
            />

            <WorkflowMetric
              label="Completed"
              value={
                String(
                  completedSteps
                )
              }
            />

            <WorkflowMetric
              label="Failed"
              value={
                String(
                  failedSteps
                )
              }
            />

            <WorkflowMetric
              label="Duration"
              value={
                duration
              }
            />
          </div>

          {steps.length ===
          0 ? (
            <div
              className={
                styles.workflowEmptySteps
              }
            >
              No step execution
              records were found.
            </div>
          ) : (
            <div
              className={
                styles.workflowTimeline
              }
            >
              {steps.map(
                (
                  step,
                  index
                ) => (
                  <WorkflowTimelineStep
                    key={
                      step.id ||
                      `${run.id}-${index}`
                    }
                    step={
                      step
                    }
                    index={
                      index
                    }
                    last={
                      index ===
                      steps.length -
                        1
                    }
                  />
                )
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// =========================================================
// WORKFLOW TIMELINE STEP
// =========================================================

function WorkflowTimelineStep({
  step,
  index,
  last,
}) {
  const failed =
    isFailedStatus(
      step.status
    );

  const waiting =
    isWaitingStatus(
      step.status
    );

  const successful =
    isSuccessfulStatus(
      step.status
    );

  return (
    <div
      className={`${styles.timelineStep} ${
        failed
          ? styles.timelineStepFailed
          : waiting
            ? styles.timelineStepWaiting
            : successful
              ? styles.timelineStepCompleted
              : ""
      }`}
    >
      <div
        className={
          styles.timelineRail
        }
      >
        <span
          className={
            styles.timelineNode
          }
        >
          {getStepSymbol(
            step.status
          )}
        </span>

        {!last && (
          <span
            className={
              styles.timelineConnector
            }
          />
        )}
      </div>

      <div
        className={
          styles.timelineContent
        }
      >
        <div
          className={
            styles.timelineContentHeader
          }
        >
          <div>
            <span
              className={
                styles.timelineStepNumber
              }
            >
              Step{" "}
              {step.step_order ??
                index + 1}
            </span>

            <h5>
              {step.name ||
                "Workflow step"}
            </h5>

            <p>
              {formatStepType(
                step.step_type
              )}
            </p>
          </div>

          <span
            className={`${styles.timelineStatus} ${getRunStatusClass(
              step.status
            )}`}
          >
            {step.status ||
              "Unknown"}
          </span>
        </div>

        <div
          className={
            styles.timelineMeta
          }
        >
          <span>
            <strong>
              Started
            </strong>

            {formatDateTime(
              step.started_at
            )}
          </span>

          <span>
            <strong>
              Completed
            </strong>

            {step.completed_at
              ? formatDateTime(
                  step.completed_at
                )
              : "Not completed"}
          </span>

          <span>
            <strong>
              Duration
            </strong>

            {calculateDuration(
              step.started_at,
              step.completed_at
            )}
          </span>
        </div>

        {step.error_message && (
          <div
            className={
              styles.timelineError
            }
          >
            <span>
              !
            </span>

            <div>
              <strong>
                Execution error
              </strong>

              <p>
                {
                  step.error_message
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================
// WORKFLOW METRIC
// =========================================================

function WorkflowMetric({
  label,
  value,
}) {
  return (
    <div
      className={
        styles.workflowMetric
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

function WorkflowHistoryLoading() {
  return (
    <div
      className={
        styles.workflowHistoryLoading
      }
    >
      <div />
      <div />
      <div />
    </div>
  );
}

function DetailRow({
  label,
  value,
  href,
  customValue,
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

      {customValue ? (
        customValue
      ) : href && value ? (
        <a href={href}>
          {value}
        </a>
      ) : (
        <strong
          className={
            value
              ? ""
              : styles.emptyValue
          }
        >
          {value ||
            "Not available"}
        </strong>
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
        length: 6,
      }).map(
        (_, index) => (
          <div
            key={index}
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

function normaliseStatus(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function isTaskCompleted(
  status
) {
  return [
    "completed",
    "complete",
    "done",
  ].includes(
    normaliseStatus(
      status
    )
  );
}

function isTaskOverdue(
  task
) {
  if (
    !task?.due_date ||
    isTaskCompleted(
      task.status
    )
  ) {
    return false;
  }

  const dueDate =
    new Date(
      `${String(
        task.due_date
      ).split("T")[0]}T23:59:59`
    );

  return (
    !Number.isNaN(
      dueDate.getTime()
    ) &&
    dueDate <
      new Date()
  );
}

function isSuccessfulStatus(
  status
) {
  const normalized =
    normaliseStatus(
      status
    );

  return [
    "completed",
    "approved",
    "processed",
    "success",
  ].includes(
    normalized
  );
}

function isFailedStatus(
  status
) {
  const normalized =
    normaliseStatus(
      status
    );

  return [
    "failed",
    "rejected",
    "error",
  ].includes(
    normalized
  );
}

function isWaitingStatus(
  status
) {
  const normalized =
    normaliseStatus(
      status
    );

  return [
    "waiting",
    "pending",
    "pending approval",
    "running",
    "in progress",
  ].includes(
    normalized
  );
}

function getRunStatusClass(
  status
) {
  if (
    isSuccessfulStatus(
      status
    )
  ) {
    return styles.workflowStatusCompleted;
  }

  if (
    isFailedStatus(
      status
    )
  ) {
    return styles.workflowStatusFailed;
  }

  if (
    isWaitingStatus(
      status
    )
  ) {
    return styles.workflowStatusWaiting;
  }

  return styles.workflowStatusNeutral;
}

function getApprovalState(
  status
) {
  const normalized =
    normaliseStatus(
      status
    );

  switch (normalized) {
    case "pending approval":
      return "Waiting for internal approval";

    case "approved":
      return "Internal approval completed";

    case "rejected":
      return "Approval rejected";

    case "accepted":
      return "Accepted by customer";

    case "expired":
      return "Quote expired";

    case "sent":
      return "Sent to customer";

    default:
      return "Not submitted";
  }
}

function getMoneyValue(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  return (
    Number(
      String(value).replace(
        /[^0-9.-]/g,
        ""
      )
    ) || 0
  );
}

function formatQuoteAmount(
  value
) {
  if (!value) {
    return "Not set";
  }

  return getMoneyValue(
    value
  ).toLocaleString(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",

      minimumFractionDigits:
        0,

      maximumFractionDigits:
        0,
    }
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "Not scheduled";
  }

  const date =
    String(
      value
    ).includes("T")
      ? new Date(
          value
        )
      : new Date(
          `${value}T12:00:00`
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  );
}

function formatDateTime(
  value
) {
  if (!value) {
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

function calculateDuration(
  startedAt,
  completedAt
) {
  if (
    !startedAt ||
    !completedAt
  ) {
    return "—";
  }

  const start =
    new Date(
      startedAt
    );

  const end =
    new Date(
      completedAt
    );

  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return "—";
  }

  const difference =
    Math.max(
      0,
      end.getTime() -
        start.getTime()
    );

  if (
    difference <
    1000
  ) {
    return "< 1 sec";
  }

  const seconds =
    Math.floor(
      difference / 1000
    );

  if (
    seconds <
    60
  ) {
    return `${seconds} sec`;
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  if (
    minutes <
    60
  ) {
    return `${minutes} min`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  const remainingMinutes =
    minutes % 60;

  return remainingMinutes
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

function formatStepType(
  value
) {
  return String(
    value || "Action"
  )
    .replace(
      /_/g,
      " "
    )
    .trim();
}

function getStepSymbol(
  status
) {
  if (
    isSuccessfulStatus(
      status
    )
  ) {
    return "✓";
  }

  if (
    isFailedStatus(
      status
    )
  ) {
    return "×";
  }

  if (
    isWaitingStatus(
      status
    )
  ) {
    return "◷";
  }

  return "○";
}

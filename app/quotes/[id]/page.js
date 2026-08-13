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

  // =======================================================
  // WORKFLOW HISTORY STATE
  // =======================================================

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

  // =======================================================
  // INITIAL LOAD
  // =======================================================

  useEffect(() => {
    if (!quoteId) {
      return;
    }

    fetchQuote();

    fetchWorkflowHistory();
  }, [quoteId]);

  // =======================================================
  // FETCH QUOTE
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

      /*
       * Temporary compatibility
       * fallback for older deployments.
       */

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
  // FETCH WORKFLOW HISTORY
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

      setWorkflowHistory(
        Array.isArray(
          data.runs
        )
          ? data.runs
          : []
      );
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

  // =======================================================
  // PDF
  // =======================================================

  function downloadPDF() {
    window.print();
  }

  // =======================================================
  // COPY QUOTE
  // =======================================================

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
  // SUBMIT FOR APPROVAL
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

      /*
       * Reload permanent history.
       */

      await fetchWorkflowHistory();
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
  // CONVERT TO CUSTOMER
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
  // LOADING
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

  // =======================================================
  // ERROR
  // =======================================================

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

  // =======================================================
  // NOT FOUND
  // =======================================================

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

          {/* SUCCESS MESSAGE */}

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

          {/* APPROVAL WORKFLOW */}

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

          {/* =================================================
              WORKFLOW EXECUTION HISTORY
             ================================================= */}

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
                  Workflow history
                </h3>

                <p>
                  Automation runs and
                  actions executed for
                  this quotation.
                </p>
              </div>

              {!workflowHistoryLoading &&
                workflowHistory.length >
                  0 && (
                  <span
                    className={
                      styles.metaBadge
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
            </div>

            {workflowHistoryLoading ? (
              <div
                className={
                  styles.detailList
                }
              >
                <DetailRow
                  label="History"
                  value="Loading workflow history..."
                />
              </div>
            ) : workflowHistoryError ? (
              <div
                className={
                  styles.detailList
                }
              >
                <DetailRow
                  label="History"
                  customValue={
                    <div>
                      <strong>
                        {
                          workflowHistoryError
                        }
                      </strong>

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
                  }
                />
              </div>
            ) : workflowHistory.length ===
              0 ? (
              <div
                className={
                  styles.detailList
                }
              >
                <DetailRow
                  label="Workflow"
                  value="No workflow has run for this quote yet."
                />
              </div>
            ) : (
              workflowHistory.map(
                (
                  run,
                  runIndex
                ) => (
                  <div
                    key={
                      run.id
                    }
                  >
                    <div
                      className={
                        styles.detailList
                      }
                    >
                      <DetailRow
                        label={`Run ${
                          workflowHistory.length -
                          runIndex
                        }`}
                        customValue={
                          <strong>
                            {run.workflow_name ||
                              "Workflow"}
                          </strong>
                        }
                      />

                      <DetailRow
                        label="Run status"
                        customValue={
                          <StatusBadge
                            status={
                              run.status ||
                              "Unknown"
                            }
                          />
                        }
                      />

                      <DetailRow
                        label="Started"
                        value={formatDateTime(
                          run.started_at
                        )}
                      />

                      <DetailRow
                        label="Completed"
                        value={
                          run.completed_at
                            ? formatDateTime(
                                run.completed_at
                              )
                            : "Not completed"
                        }
                      />

                      <DetailRow
                        label="Steps executed"
                        value={String(
                          run.step_count ??
                            run.steps
                              ?.length ??
                            0
                        )}
                      />
                    </div>

                    {Array.isArray(
                      run.steps
                    ) &&
                      run.steps.map(
                        (
                          step,
                          index
                        ) => (
                          <div
                            key={
                              step.id ||
                              `${run.id}-${index}`
                            }
                            className={
                              styles.detailList
                            }
                          >
                            <DetailRow
                              label={`Step ${
                                step.step_order ??
                                index +
                                  1
                              }`}
                              customValue={
                                <div>
                                  <strong>
                                    {getStepSymbol(
                                      step.status
                                    )}{" "}
                                    {step.name ||
                                      "Workflow step"}
                                  </strong>

                                  <div>
                                    <small>
                                      {formatStepType(
                                        step.step_type
                                      )}
                                    </small>
                                  </div>
                                </div>
                              }
                            />

                            <DetailRow
                              label="Status"
                              customValue={
                                <StatusBadge
                                  status={
                                    step.status ||
                                    "Unknown"
                                  }
                                />
                              }
                            />

                            <DetailRow
                              label="Completed"
                              value={
                                step.completed_at
                                  ? formatDateTime(
                                      step.completed_at
                                    )
                                  : "Not completed"
                              }
                            />

                            {step.error_message && (
                              <DetailRow
                                label="Error"
                                value={
                                  step.error_message
                                }
                              />
                            )}
                          </div>
                        )
                      )}

                    {runIndex <
                      workflowHistory.length -
                        1 && (
                      <hr />
                    )}
                  </div>
                )
              )
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
// DETAIL ROW
// =========================================================

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

// =========================================================
// LOADING
// =========================================================

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

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

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
    new Date(value);

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

function formatStepType(
  value
) {
  const cleanValue =
    String(
      value || "Action"
    )
      .replace(
        /_/g,
        " "
      )
      .trim();

  return cleanValue;
}

function getStepSymbol(
  status
) {
  const normalized =
    normaliseStatus(
      status
    );

  if (
    normalized ===
      "completed" ||
    normalized ===
      "approved"
  ) {
    return "✓";
  }

  if (
    normalized ===
      "failed" ||
    normalized ===
      "rejected"
  ) {
    return "✕";
  }

  if (
    normalized ===
      "waiting" ||
    normalized ===
      "pending"
  ) {
    return "◷";
  }

  return "○";
}

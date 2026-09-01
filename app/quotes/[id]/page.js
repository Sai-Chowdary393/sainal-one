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

const STATUS_OPTIONS = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Rejected",
  "Accepted",
  "Expired",
];

// =========================================================
// PAGE
// =========================================================

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
    employees,
    setEmployees,
  ] = useState([]);

  const [
    access,
    setAccess,
  ] = useState({
    isOwner: false,
    permissions: [],
    canEdit: false,
    canDelete: false,
    canAssign: false,
    canSend: false,
    canApprove: false,
    canConvert: false,
  });

  const [
    draftQuote,
    setDraftQuote,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

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
    workflowHistory,
    setWorkflowHistory,
  ] = useState([]);

  const [
    workflowHistoryLoading,
    setWorkflowHistoryLoading,
  ] = useState(false);

  const [
    relatedTasks,
    setRelatedTasks,
  ] = useState([]);

  const [
    relatedTasksLoading,
    setRelatedTasksLoading,
  ] = useState(false);

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    if (!quoteId) {
      return;
    }

    fetchQuote();
    fetchWorkflowHistory();
    fetchRelatedTasks();
  }, [quoteId]);

  async function fetchQuote() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response =
        await fetch(
          `/api/quotes/${quoteId}`,
          {
            cache: "no-store",
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

      setQuote(
        data.quote ||
          null
      );

      setDraftQuote(
        data.quote ||
          null
      );

      setEmployees(
        Array.isArray(
          data.employees
        )
          ? data.employees
          : []
      );

      setAccess({
        isOwner:
          Boolean(
            data.access
              ?.isOwner
          ),

        permissions:
          Array.isArray(
            data.access
              ?.permissions
          )
            ? data.access
                .permissions
            : [],

        canEdit:
          Boolean(
            data.access
              ?.canEdit
          ),

        canDelete:
          Boolean(
            data.access
              ?.canDelete
          ),

        canAssign:
          Boolean(
            data.access
              ?.canAssign
          ),

        canSend:
          Boolean(
            data.access
              ?.canSend
          ),

        canApprove:
          Boolean(
            data.access
              ?.canApprove
          ),

        canConvert:
          Boolean(
            data.access
              ?.canConvert
          ),
      });
    } catch (error) {
      console.error(
        "Quote loading error:",
        error
      );

      setQuote(null);

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
    try {
      setRelatedTasksLoading(
        true
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

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      setRelatedTasks(
        Array.isArray(
          data.tasks
        )
          ? data.tasks
          : []
      );
    } catch (error) {
      console.error(
        "Quote related work error:",
        error
      );
    } finally {
      setRelatedTasksLoading(
        false
      );
    }
  }

  // =======================================================
  // WORKFLOW
  // =======================================================

  async function fetchWorkflowHistory() {
    try {
      setWorkflowHistoryLoading(
        true
      );

      const response =
        await fetch(
          `/api/quotes/${quoteId}/workflow-history`,
          {
            cache:
              "no-store",
          }
        );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      setWorkflowHistory(
        Array.isArray(
          data.runs
        )
          ? data.runs
          : []
      );
    } catch (error) {
      console.error(
        "Quote workflow history error:",
        error
      );
    } finally {
      setWorkflowHistoryLoading(
        false
      );
    }
  }

  // =======================================================
  // EDIT
  // =======================================================

  function startEditing() {
    if (
      !access.canEdit &&
      !access.canAssign
    ) {
      return;
    }

    setDraftQuote({
      ...quote,
    });

    setEditing(true);
  }

  function cancelEditing() {
    setDraftQuote({
      ...quote,
    });

    setEditing(false);
  }

  function handleChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setDraftQuote(
      (
        current
      ) => ({
        ...current,

        [name]:
          value,
      })
    );
  }

  async function saveQuote() {
    if (!draftQuote) {
      return;
    }

    try {
      setSaving(true);

      const payload = {};

      if (access.canEdit) {
        payload.client =
          String(
            draftQuote.client ||
              ""
          ).trim();

        payload.contact =
          String(
            draftQuote.contact ||
              ""
          ).trim();

        payload.email =
          String(
            draftQuote.email ||
              ""
          ).trim();

        payload.phone =
          String(
            draftQuote.phone ||
              ""
          ).trim();

        payload.service =
          String(
            draftQuote.service ||
              ""
          ).trim();

        payload.amount =
          String(
            draftQuote.amount ||
              ""
          ).trim();

        payload.quote_text =
          String(
            draftQuote.quote_text ||
              ""
          );

        payload.status =
          draftQuote.status ||
          "Draft";
      }

      if (access.canAssign) {
        payload.owner_employee_id =
          draftQuote.owner_employee_id ||
          "";
      }

      const response =
        await fetch(
          `/api/quotes/${quote.id}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update quote."
        );
      }

      if (data.quote) {
        setQuote(
          data.quote
        );

        setDraftQuote(
          data.quote
        );
      } else {
        await fetchQuote();
      }

      setEditing(false);

      alert(
        data.message ||
          "Quote updated successfully."
      );
    } catch (error) {
      console.error(
        "Quote update error:",
        error
      );

      alert(
        error.message ||
          "Unable to update quote."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // DELETE
  // =======================================================

  async function deleteQuoteRecord() {
    if (
      !quote ||
      !access.canDelete
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${
          quote.quote_number ||
          "this quote"
        }? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);

      const response =
        await fetch(
          `/api/quotes/${quote.id}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete quote."
        );
      }

      router.push(
        "/quotes"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Quote deletion error:",
        error
      );

      alert(
        error.message ||
          "Unable to delete quote."
      );
    } finally {
      setDeleting(false);
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

    if (
      !access.canEdit &&
      !access.canApprove
    ) {
      return;
    }

    const status =
      normaliseStatus(
        quote.status
      );

    if (
      [
        "pending approval",
        "approved",
        "accepted",
      ].includes(status)
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
        } for approval?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSubmittingApproval(
        true
      );

      setApprovalMessage(
        ""
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

        setDraftQuote(
          data.quote
        );
      } else {
        await fetchQuote();
      }

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
        "Quote approval error:",
        error
      );

      setApprovalMessage(
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

  const canCreateCustomer =
    Boolean(
      access.isOwner ||
      access.permissions.includes(
        "customers.create"
      )
    );

  const canConvert =
    Boolean(
      access.isOwner ||
      access.canConvert ||
      access.canEdit
    ) &&
    canCreateCustomer;

  async function convertToCustomer() {
    if (
      !quote ||
      !canConvert ||
      converting
    ) {
      return;
    }

    if (quote.customer_id) {
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
        !data.customer
          ?.id
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
  // DOCUMENT
  // =======================================================

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
    } catch {
      alert(
        "Unable to copy the quote."
      );
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

  if (errorMessage) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Quote Workspace"
          description="Review quotation details."
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
          description="Review quotation details."
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
              The quote may have been
              deleted or you may not have
              permission to open it.
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

  const visibleQuote =
    editing
      ? draftQuote ||
        quote
      : quote;

  const status =
    normaliseStatus(
      quote.status
    );

  const canSubmitApproval =
    (
      access.canEdit ||
      access.canApprove
    ) &&
    ![
      "pending approval",
      "approved",
      "accepted",
    ].includes(status);

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          quote.quote_number ||
          "Quote Workspace"
        }
        description="Quotation, approval workflow and customer conversion."
      >
        <div
          className={
            styles.page
          }
        >
          {/* HEADER */}

          <section
            className={
              styles.pageHeader
            }
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
                  "Quotation"}
              </h2>

              <p>
                {quote.client ||
                  "No client specified"}
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              {!editing &&
                (
                  access.canEdit ||
                  access.canAssign
                ) && (
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={
                      startEditing
                    }
                  >
                    Edit quote
                  </button>
                )}

              {editing && (
                <>
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={
                      cancelEditing
                    }
                    disabled={
                      saving
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    onClick={
                      saveQuote
                    }
                    disabled={
                      saving
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </>
              )}

              {!editing &&
                canSubmitApproval && (
                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    onClick={
                      submitForApproval
                    }
                    disabled={
                      submittingApproval
                    }
                  >
                    {submittingApproval
                      ? "Submitting..."
                      : "Submit for approval"}
                  </button>
                )}

              {!editing &&
                canConvert && (
                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    onClick={
                      convertToCustomer
                    }
                    disabled={
                      converting
                    }
                  >
                    {quote.customer_id
                      ? "Open customer"
                      : converting
                        ? "Converting..."
                        : "Convert to customer"}
                  </button>
                )}

              {!editing &&
                access.canDelete && (
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={
                      deleteQuoteRecord
                    }
                    disabled={
                      deleting
                    }
                  >
                    {deleting
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                )}
            </div>
          </section>

          {/* MESSAGE */}

          {approvalMessage && (
            <section
              className={
                styles.messagePanel
              }
            >
              {approvalMessage}
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
                  Quotation
                </span>

                <h3>
                  {quote.quote_number ||
                    "Quote"}
                </h3>

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
                    Owner:{" "}
                    {quote.owner
                      ?.full_name ||
                      "Unassigned"}
                  </span>

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
                {formatQuoteAmount(
                  quote.amount
                )}
              </strong>
            </div>
          </section>

          {/* EDIT */}

          {editing && (
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
                    Edit quotation
                  </h3>

                  <p>
                    Update commercial details
                    and ownership.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.editGrid
                }
              >
                {access.canEdit && (
                  <>
                    <EditField
                      label="Client"
                      name="client"
                      value={
                        visibleQuote.client
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <EditField
                      label="Contact"
                      name="contact"
                      value={
                        visibleQuote.contact
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <EditField
                      label="Email"
                      name="email"
                      type="email"
                      value={
                        visibleQuote.email
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <EditField
                      label="Phone"
                      name="phone"
                      value={
                        visibleQuote.phone
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <EditField
                      label="Service"
                      name="service"
                      value={
                        visibleQuote.service
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <EditField
                      label="Amount"
                      name="amount"
                      value={
                        visibleQuote.amount
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <div
                      className={
                        styles.editField
                      }
                    >
                      <label>
                        Status
                      </label>

                      <select
                        name="status"
                        value={
                          visibleQuote.status ||
                          "Draft"
                        }
                        onChange={
                          handleChange
                        }
                      >
                        {STATUS_OPTIONS.map(
                          (
                            option
                          ) => (
                            <option
                              key={
                                option
                              }
                              value={
                                option
                              }
                            >
                              {option}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </>
                )}

                {access.canAssign && (
                  <div
                    className={
                      styles.editField
                    }
                  >
                    <label>
                      Quote owner
                    </label>

                    <select
                      name="owner_employee_id"
                      value={
                        visibleQuote.owner_employee_id ||
                        ""
                      }
                      onChange={
                        handleChange
                      }
                    >
                      <option value="">
                        Unassigned
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
                          </option>
                        )
                      )}
                    </select>
                  </div>
                )}
              </div>

              {access.canEdit && (
                <div
                  className={
                    styles.editDocument
                  }
                >
                  <label>
                    Quote document
                  </label>

                  <textarea
                    name="quote_text"
                    value={
                      visibleQuote.quote_text ||
                      ""
                    }
                    onChange={
                      handleChange
                    }
                    rows={16}
                  />
                </div>
              )}
            </section>
          )}

          {/* DETAILS */}

          {!editing && (
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
                      Quote information
                    </h3>

                    <p>
                      Customer and commercial
                      details.
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
                    label="Contact"
                    value={
                      quote.contact
                    }
                  />

                  <DetailRow
                    label="Email"
                    value={
                      quote.email
                    }
                  />

                  <DetailRow
                    label="Phone"
                    value={
                      quote.phone
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
                      formatQuoteAmount(
                        quote.amount
                      )
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
                    label="Owner"
                    value={
                      quote.owner
                        ?.full_name ||
                      "Unassigned"
                    }
                  />
                </div>
              </section>

              <section
                className={
                  styles.documentPanel
                }
              >
                <div
                  className={
                    styles.documentToolbar
                  }
                >
                  <div>
                    <h3>
                      Quote document
                    </h3>

                    <p>
                      Customer-facing quotation
                      preview.
                    </p>
                  </div>

                  <div
                    className={
                      styles.documentActions
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
                      Print / PDF
                    </button>
                  </div>
                </div>

                <div
                  className={
                    styles.documentViewport
                  }
                >
                  <article
                    className={
                      styles.quoteDocument
                    }
                  >
                    <div
                      className={
                        styles.documentBrand
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
                            SaiNal Technologies Ltd
                          </strong>

                          <p>
                            Business solutions
                            and technology services
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
                          {quote.quote_number}
                        </strong>
                      </div>
                    </div>

                    <div
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
                    </div>

                    <div
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
                            "Service"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Total
                        </span>

                        <strong>
                          {formatQuoteAmount(
                            quote.amount
                          )}
                        </strong>
                      </div>
                    </div>

                    <pre
                      className={
                        styles.quotePreview
                      }
                    >
                      {quote.quote_text ||
                        "No quote document content is available."}
                    </pre>

                    <footer
                      className={
                        styles.documentFooter
                      }
                    >
                      <p>
                        SaiNal Technologies Ltd
                      </p>

                      <p>
                        www.sainaltechnologies.com
                      </p>
                    </footer>
                  </article>
                </div>
              </section>
            </section>
          )}

          {/* LOWER WORKSPACE */}

          <section
            className={
              styles.lowerGrid
            }
          >
            {/* RELATED WORK */}

            <section
              className={
                styles.relatedWorkPanel
              }
            >
              <div
                className={
                  styles.compactPanelHeader
                }
              >
                <div>
                  <h3>
                    Related work
                  </h3>

                  <p>
                    Tasks created for this
                    quotation.
                  </p>
                </div>

                <span
                  className={
                    styles.relatedWorkMetric
                  }
                >
                  {relatedTasks.length}
                </span>
              </div>

              {relatedTasksLoading ? (
                <div
                  className={
                    styles.compactLoading
                  }
                >
                  Loading related work...
                </div>
              ) : relatedTasks.length ===
                0 ? (
                <div
                  className={
                    styles.compactEmpty
                  }
                >
                  <span>
                    ✓
                  </span>

                  <div>
                    <strong>
                      No related tasks
                    </strong>

                    <p>
                      Tasks connected to this
                      quote will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className={
                    styles.relatedWorkList
                  }
                >
                  {relatedTasks.map(
                    (
                      task
                    ) => (
                      <article
                        key={
                          task.id
                        }
                        className={
                          styles.relatedTaskCard
                        }
                      >
                        <span
                          className={
                            styles.relatedTaskIcon
                          }
                        >
                          ✓
                        </span>

                        <div
                          className={
                            styles.relatedTaskCopy
                          }
                        >
                          <strong>
                            {task.task_name ||
                              task.title ||
                              "Task"}
                          </strong>

                          <p>
                            {task.status ||
                              "Pending"}
                          </p>
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}
            </section>

            {/* APPROVAL WORKFLOW */}

            <section
              className={
                styles.workflowHistoryPanel
              }
            >
              <div
                className={
                  styles.compactPanelHeader
                }
              >
                <div>
                  <h3>
                    Approval workflow
                  </h3>

                  <p>
                    Workflow execution history
                    for this quote.
                  </p>
                </div>

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
                  title="Refresh workflow history"
                >
                  ↻
                </button>
              </div>

              {workflowHistoryLoading ? (
                <div
                  className={
                    styles.compactLoading
                  }
                >
                  Loading workflow history...
                </div>
              ) : workflowHistory.length ===
                0 ? (
                <div
                  className={
                    styles.compactEmpty
                  }
                >
                  <span>
                    ◇
                  </span>

                  <div>
                    <strong>
                      No workflow runs yet
                    </strong>

                    <p>
                      Submit this quotation
                      for approval to start
                      the configured workflow.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className={
                    styles.workflowRuns
                  }
                >
                  {workflowHistory.map(
                    (
                      run
                    ) => (
                      <article
                        key={
                          run.id
                        }
                        className={
                          styles.workflowRunCard
                        }
                      >
                        <span
                          className={
                            styles.workflowRunIcon
                          }
                        >
                          ◇
                        </span>

                        <div
                          className={
                            styles.workflowRunIdentity
                          }
                        >
                          <strong>
                            {run.workflow_name ||
                              run.workflow
                                ?.name ||
                              "Approval workflow"}
                          </strong>

                          <p>
                            {run.status ||
                              "Unknown"}{" "}
                            ·{" "}
                            {formatDateTime(
                              run.created_at
                            )}
                          </p>
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}
            </section>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// EDIT FIELD
// =========================================================

function EditField({
  label,
  name,
  value,
  onChange,
  type = "text",
}) {
  return (
    <div
      className={
        styles.editField
      }
    >
      <label>
        {label}
      </label>

      <input
        name={name}
        type={type}
        value={
          value ||
          ""
        }
        onChange={
          onChange
        }
      />
    </div>
  );
}

// =========================================================
// DETAIL ROW
// =========================================================

function DetailRow({
  label,
  value,
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

      {customValue || (
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
        (
          _,
          index
        ) => (
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
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getMoneyValue(
  value
) {
  const number =
    Number(
      String(
        value ||
          ""
      ).replace(
        /[^0-9.-]/g,
        ""
      )
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function formatQuoteAmount(
  value
) {
  if (!value) {
    return "Not set";
  }

  if (
    String(
      value
    ).includes("£")
  ) {
    return value;
  }

  const number =
    getMoneyValue(
      value
    );

  if (!number) {
    return value;
  }

  return number.toLocaleString(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",

      maximumFractionDigits:
        2,
    }
  );
}

function formatDate(
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
    return "Date unavailable";
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
    return "Date unavailable";
  }

  return date.toLocaleString(
    "en-GB",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    }
  );
}

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
import ProtectedRoute from "../../../components/ProtectedRoute";
import SendRecordEmail from "../../../components/SendRecordEmail";
import StatusBadge from "../../../components/StatusBadge";

// =========================================================
// CONSTANTS
// =========================================================

const STATUS_OPTIONS = [
  "Draft Invoice",
  "Draft",
  "Sent",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
];

// =========================================================
// PAGE
// =========================================================

export default function InvoiceDetailsPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const invoiceId =
    params?.id;

  const [
    invoice,
    setInvoice,
  ] =
    useState(null);

  const [
    draftInvoice,
    setDraftInvoice,
  ] =
    useState(null);

  const [
    settings,
    setSettings,
  ] =
    useState(null);

  const [
    employees,
    setEmployees,
  ] =
    useState([]);

  const [
    recipientEmail,
    setRecipientEmail,
  ] =
    useState("");

  const [
    access,
    setAccess,
  ] =
    useState({
      isOwner:
        false,

      canEdit:
        false,

      canDelete:
        false,

      canAssign:
        false,

      canSend:
        false,

      canApprove:
        false,

      permissions:
        [],
    });

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    editing,
    setEditing,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    deleting,
    setDeleting,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    if (
      invoiceId
    ) {
      loadInvoice();
    }
  }, [
    invoiceId,
  ]);

  async function loadInvoice() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        invoiceResponse,
        settingsResponse,
      ] =
        await Promise.all([
          fetch(
            `/api/invoices/${invoiceId}`,
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            "/api/company-settings",
            {
              cache:
                "no-store",
            }
          ),
        ]);

      const invoiceData =
        await invoiceResponse.json();

      let settingsData =
        null;

      if (
        settingsResponse.ok
      ) {
        settingsData =
          await settingsResponse.json();
      }

      if (
        !invoiceResponse.ok
      ) {
        throw new Error(
          invoiceData.error ||
            "Failed to load invoice."
        );
      }

      setInvoice(
        invoiceData.invoice ||
          null
      );

      setDraftInvoice(
        invoiceData.invoice ||
          null
      );

      setEmployees(
        Array.isArray(
          invoiceData.employees
        )
          ? invoiceData.employees
          : []
      );

      setRecipientEmail(
        invoiceData.recipientEmail ||
          invoiceData.customer
            ?.email ||
          invoiceData.quote
            ?.email ||
          ""
      );

      setAccess({
        isOwner:
          Boolean(
            invoiceData
              .access
              ?.isOwner
          ),

        canEdit:
          Boolean(
            invoiceData
              .access
              ?.canEdit
          ),

        canDelete:
          Boolean(
            invoiceData
              .access
              ?.canDelete
          ),

        canAssign:
          Boolean(
            invoiceData
              .access
              ?.canAssign
          ),

        canSend:
          Boolean(
            invoiceData
              .access
              ?.canSend
          ),

        canApprove:
          Boolean(
            invoiceData
              .access
              ?.canApprove
          ),

        permissions:
          Array.isArray(
            invoiceData
              .access
              ?.permissions
          )
            ? invoiceData
                .access
                .permissions
            : [],
      });

      setSettings(
        settingsData ||
          null
      );
    } catch (error) {
      console.error(
        "Invoice loading error:",
        error
      );

      setInvoice(null);

      setDraftInvoice(null);

      setRecipientEmail("");

      setErrorMessage(
        error.message ||
          "Unable to load invoice."
      );
    } finally {
      setLoading(false);
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

    setDraftInvoice({
      ...invoice,
    });

    setEditing(true);
  }

  function cancelEditing() {
    setDraftInvoice({
      ...invoice,
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

    setDraftInvoice(
      (
        current
      ) => ({
        ...current,

        [name]:
          value,
      })
    );
  }

  // =======================================================
  // PATCH
  // =======================================================

  async function patchInvoice(
    payload
  ) {
    const response =
      await fetch(
        `/api/invoices/${invoiceId}`,
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

    if (
      !response.ok
    ) {
      throw new Error(
        data.error ||
          "Failed to update invoice."
      );
    }

    return data;
  }

  // =======================================================
  // SAVE
  // =======================================================

  async function saveInvoice() {
    if (
      !draftInvoice
    ) {
      return;
    }

    if (
      access.canEdit &&
      (
        !String(
          draftInvoice.client ||
            ""
        ).trim() ||
        !String(
          draftInvoice.service ||
            ""
        ).trim()
      )
    ) {
      alert(
        "Client and service are required."
      );

      return;
    }

    try {
      setSaving(true);

      const payload = {};

      if (
        access.canEdit
      ) {
        payload.client =
          String(
            draftInvoice.client ||
              ""
          ).trim();

        payload.service =
          String(
            draftInvoice.service ||
              ""
          ).trim();

        payload.status =
          draftInvoice.status ||
          "Draft Invoice";

        payload.due_date =
          draftInvoice.due_date ||
          null;

        payload.payment_terms =
          String(
            draftInvoice.payment_terms ||
              ""
          ).trim();

        payload.subtotal =
          draftInvoice.subtotal ||
          draftInvoice.amount ||
          "0";

        payload.vat_rate =
          draftInvoice.vat_rate ||
          "0";
      }

      if (
        access.canAssign
      ) {
        payload.owner_employee_id =
          draftInvoice.owner_employee_id ||
          "";
      }

      const data =
        await patchInvoice(
          payload
        );

      const updatedInvoice =
        data.invoice ||
        draftInvoice;

      setInvoice(
        updatedInvoice
      );

      setDraftInvoice(
        updatedInvoice
      );

      setEditing(false);

      alert(
        data.message ||
          "Invoice updated successfully."
      );
    } catch (error) {
      console.error(
        "Invoice save error:",
        error
      );

      alert(
        error.message ||
          "Unable to save invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // STATUS
  // =======================================================

  async function updateStatus(
    status
  ) {
    if (
      !access.canEdit
    ) {
      return;
    }

    try {
      setSaving(true);

      const data =
        await patchInvoice({
          status,
        });

      if (
        data.invoice
      ) {
        setInvoice(
          data.invoice
        );

        setDraftInvoice(
          data.invoice
        );
      } else {
        await loadInvoice();
      }
    } catch (error) {
      console.error(
        "Invoice status error:",
        error
      );

      alert(
        error.message ||
          "Unable to update invoice status."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // DELETE
  // =======================================================

  async function deleteInvoice() {
    if (
      !access.canDelete ||
      !invoice
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${
          invoice.invoice_number ||
          "this invoice"
        }?\n\nSent or paid invoices cannot be deleted.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setDeleting(true);

      const response =
        await fetch(
          `/api/invoices/${invoiceId}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to delete invoice."
        );
      }

      alert(
        data.message ||
          "Invoice deleted successfully."
      );

      router.push(
        "/invoices"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Invoice deletion error:",
        error
      );

      alert(
        error.message ||
          "Unable to delete invoice."
      );
    } finally {
      setDeleting(false);
    }
  }

  // =======================================================
  // PRINT
  // =======================================================

  function downloadPDF() {
    window.print();
  }

  // =======================================================
  // STATES
  // =======================================================

  if (
    loading
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Invoice Workspace"
          description="Loading invoice information."
        >
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (
    errorMessage
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Invoice Workspace"
          description="Review and manage customer billing."
        >
          <section
            style={
              detailStyles.error
            }
          >
            <div>
              <strong>
                Unable to load invoice
              </strong>

              <p>
                {
                  errorMessage
                }
              </p>
            </div>

            <button
              type="button"
              style={
                detailStyles.secondaryButton
              }
              onClick={
                loadInvoice
              }
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (
    !invoice ||
    !draftInvoice
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Invoice Workspace"
          description="Review and manage customer billing."
        >
          <section
            style={
              detailStyles.notFound
            }
          >
            <span
              style={
                detailStyles.bigIcon
              }
            >
              £
            </span>

            <h2>
              Invoice not found
            </h2>

            <p>
              This invoice may have
              been deleted or you may
              not have permission to
              view it.
            </p>

            <Link
              href="/invoices"
              style={
                detailStyles.primaryLink
              }
            >
              Return to invoices
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // DATA
  // =======================================================

  const visibleInvoice =
    editing
      ? draftInvoice
      : invoice;

  const companyName =
    settings?.company_name ||
    "SaiNal Technologies Ltd";

  const companyWebsite =
    settings?.website ||
    "www.sainaltechnologies.com";

  const companyAddress =
    settings?.address ||
    "United Kingdom";

  const companyEmail =
    settings?.company_email ||
    "";

  const companyPhone =
    settings?.company_phone ||
    "";

  const vatNumber =
    settings?.vat_number ||
    "";

  const registrationNumber =
    settings
      ?.company_registration_number ||
    "";

  const bankName =
    settings?.bank_name ||
    "";

  const bankAccountName =
    settings?.bank_account_name ||
    "";

  const bankSortCode =
    settings?.bank_sort_code ||
    "";

  const bankAccountNumber =
    settings?.bank_account_number ||
    "";

  const paymentTerms =
    visibleInvoice.payment_terms ||
    settings?.payment_terms ||
    "Payment due within 14 days of invoice date.";

  const subtotal =
    visibleInvoice.subtotal ||
    visibleInvoice.amount ||
    "£0.00";

  const vatRate =
    visibleInvoice.vat_rate ||
    "0%";

  const vatAmount =
    visibleInvoice.vat_amount ||
    "£0.00";

  const totalAmount =
    visibleInvoice.total_amount ||
    visibleInvoice.amount ||
    "£0.00";

  const displayStatus =
    getDisplayStatus(
      visibleInvoice
    );

  const canSend =
    Boolean(
      (
        access.isOwner ||
        access.canSend
      ) &&
      normaliseStatus(
        invoice.status
      ) !==
        "cancelled"
    );

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          invoice.invoice_number ||
          "Invoice Workspace"
        }
        description="Invoice details, customer billing, payment status and document delivery."
      >
        <div
          style={
            detailStyles.page
          }
        >
          {/* HEADER */}

          <section
            style={
              detailStyles.header
            }
          >
            <div>
              <Link
                href="/invoices"
                style={
                  detailStyles.backLink
                }
              >
                ← Back to invoices
              </Link>

              <span
                style={
                  detailStyles.eyebrow
                }
              >
                Finance workspace
              </span>

              <h2
                style={
                  detailStyles.heading
                }
              >
                {invoice.invoice_number ||
                  "Invoice"}
              </h2>

              <p
                style={
                  detailStyles.description
                }
              >
                {invoice.client ||
                  "No client specified"}
              </p>
            </div>

            <div
              style={
                detailStyles.actions
              }
            >
              {!editing &&
                canSend && (
                  <SendRecordEmail
                    endpoint={`/api/invoices/${invoice.id}/send`}
                    defaultEmail={
                      recipientEmail
                    }
                    defaultSubject={`Invoice ${
                      invoice.invoice_number ||
                      ""
                    } from ${companyName}`}
                    recordLabel="invoice"
                    onSent={(
                      data
                    ) => {
                      if (
                        data.invoice
                      ) {
                        setInvoice(
                          data.invoice
                        );

                        setDraftInvoice(
                          data.invoice
                        );
                      } else {
                        loadInvoice();
                      }
                    }}
                  />
                )}

              {!editing &&
                (
                  access.canEdit ||
                  access.canAssign
                ) && (
                  <button
                    type="button"
                    style={
                      detailStyles.secondaryButton
                    }
                    onClick={
                      startEditing
                    }
                  >
                    Edit invoice
                  </button>
                )}

              {editing && (
                <>
                  <button
                    type="button"
                    style={
                      detailStyles.primaryButton
                    }
                    onClick={
                      saveInvoice
                    }
                    disabled={
                      saving
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>

                  <button
                    type="button"
                    style={
                      detailStyles.secondaryButton
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
                </>
              )}

              {!editing &&
                access.canDelete && (
                  <button
                    type="button"
                    style={
                      detailStyles.dangerButton
                    }
                    disabled={
                      deleting
                    }
                    onClick={
                      deleteInvoice
                    }
                  >
                    {deleting
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                )}
            </div>
          </section>

          {/* HERO */}

          <section
            style={
              detailStyles.hero
            }
          >
            <div
              style={
                detailStyles.identity
              }
            >
              <span
                style={
                  detailStyles.invoiceIcon
                }
              >
                £
              </span>

              <div>
                <span
                  style={
                    detailStyles.smallLabel
                  }
                >
                  Invoice
                </span>

                <h3
                  style={
                    detailStyles.heroTitle
                  }
                >
                  {invoice.invoice_number ||
                    "Invoice"}
                </h3>

                <div
                  style={
                    detailStyles.meta
                  }
                >
                  <StatusBadge
                    status={
                      displayStatus
                    }
                  />

                  <span
                    style={
                      detailStyles.metaBadge
                    }
                  >
                    Owner:{" "}
                    {invoice.owner
                      ?.full_name ||
                      "Unassigned"}
                  </span>

                  <span
                    style={
                      detailStyles.metaBadge
                    }
                  >
                    Due{" "}
                    {formatDate(
                      invoice.due_date
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div
              style={
                detailStyles.totalBox
              }
            >
              <span>
                Total due
              </span>

              <strong>
                {
                  totalAmount
                }
              </strong>
            </div>
          </section>

          {/* EDIT */}

          {editing && (
            <section
              style={
                detailStyles.panel
              }
            >
              <div
                style={
                  detailStyles.panelHeader
                }
              >
                <h3>
                  Edit invoice
                </h3>

                <p>
                  Update billing
                  details, financial
                  values and ownership.
                </p>
              </div>

              <div
                style={
                  detailStyles.formGrid
                }
              >
                {access.canEdit && (
                  <>
                    <EditField
                      label="Client"
                      name="client"
                      value={
                        visibleInvoice.client
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <EditField
                      label="Service"
                      name="service"
                      value={
                        visibleInvoice.service
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <EditField
                      label="Subtotal"
                      name="subtotal"
                      value={
                        visibleInvoice.subtotal ||
                        visibleInvoice.amount
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <EditField
                      label="VAT rate"
                      name="vat_rate"
                      value={
                        visibleInvoice.vat_rate
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <EditField
                      label="Due date"
                      name="due_date"
                      type="date"
                      value={
                        toDateInput(
                          visibleInvoice.due_date
                        )
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <label
                      style={
                        detailStyles.field
                      }
                    >
                      <span>
                        Status
                      </span>

                      <select
                        name="status"
                        value={
                          visibleInvoice.status ||
                          "Draft Invoice"
                        }
                        onChange={
                          handleChange
                        }
                        style={
                          detailStyles.input
                        }
                      >
                        {STATUS_OPTIONS.map(
                          (
                            item
                          ) => (
                            <option
                              key={
                                item
                              }
                              value={
                                item
                              }
                            >
                              {
                                item
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  </>
                )}

                {access.canAssign && (
                  <label
                    style={
                      detailStyles.field
                    }
                  >
                    <span>
                      Invoice owner
                    </span>

                    <select
                      name="owner_employee_id"
                      value={
                        visibleInvoice.owner_employee_id ||
                        ""
                      }
                      onChange={
                        handleChange
                      }
                      style={
                        detailStyles.input
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

                            {employee.job_title
                              ? ` — ${employee.job_title}`
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                )}

                {access.canEdit && (
                  <label
                    style={{
                      ...detailStyles.field,

                      gridColumn:
                        "1 / -1",
                    }}
                  >
                    <span>
                      Payment terms
                    </span>

                    <textarea
                      name="payment_terms"
                      rows={4}
                      value={
                        visibleInvoice.payment_terms ||
                        ""
                      }
                      onChange={
                        handleChange
                      }
                      style={
                        detailStyles.textarea
                      }
                    />
                  </label>
                )}
              </div>
            </section>
          )}

          {/* INFO + PAYMENT STATUS */}

          {!editing && (
            <section
              style={
                detailStyles.twoColumn
              }
            >
              <section
                style={
                  detailStyles.panel
                }
              >
                <div
                  style={
                    detailStyles.panelHeader
                  }
                >
                  <h3>
                    Invoice information
                  </h3>

                  <p>
                    Billing and
                    commercial details.
                  </p>
                </div>

                <div
                  style={
                    detailStyles.detailList
                  }
                >
                  <DetailRow
                    label="Client"
                    value={
                      invoice.client
                    }
                  />

                  <DetailRow
                    label="Service"
                    value={
                      invoice.service
                    }
                  />

                  <DetailRow
                    label="Subtotal"
                    value={
                      subtotal
                    }
                  />

                  <DetailRow
                    label="VAT rate"
                    value={
                      vatRate
                    }
                  />

                  <DetailRow
                    label="VAT"
                    value={
                      vatAmount
                    }
                  />

                  <DetailRow
                    label="Total"
                    value={
                      totalAmount
                    }
                  />

                  <DetailRow
                    label="Due date"
                    value={
                      formatDate(
                        invoice.due_date
                      )
                    }
                  />

                  <DetailRow
                    label="Owner"
                    value={
                      invoice.owner
                        ?.full_name ||
                      "Unassigned"
                    }
                  />
                </div>
              </section>

              <section
                style={
                  detailStyles.panel
                }
              >
                <div
                  style={
                    detailStyles.panelHeader
                  }
                >
                  <h3>
                    Payment status
                  </h3>

                  <p>
                    Update invoice
                    lifecycle status.
                  </p>
                </div>

                <div
                  style={
                    detailStyles.statusPanel
                  }
                >
                  <StatusBadge
                    status={
                      displayStatus
                    }
                  />

                  <strong
                    style={
                      detailStyles.statusAmount
                    }
                  >
                    {
                      totalAmount
                    }
                  </strong>

                  <p>
                    Due{" "}
                    {formatDate(
                      invoice.due_date
                    )}
                  </p>

                  {access.canEdit && (
                    <div
                      style={
                        detailStyles.statusActions
                      }
                    >
                      {normaliseStatus(
                        invoice.status
                      ) !==
                        "paid" && (
                        <button
                          type="button"
                          style={
                            detailStyles.primaryButton
                          }
                          disabled={
                            saving
                          }
                          onClick={() =>
                            updateStatus(
                              "Paid"
                            )
                          }
                        >
                          Mark paid
                        </button>
                      )}

                      {normaliseStatus(
                        invoice.status
                      ) !==
                        "partially paid" &&
                        normaliseStatus(
                          invoice.status
                        ) !==
                          "paid" && (
                          <button
                            type="button"
                            style={
                              detailStyles.secondaryButton
                            }
                            disabled={
                              saving
                            }
                            onClick={() =>
                              updateStatus(
                                "Partially Paid"
                              )
                            }
                          >
                            Mark partially
                            paid
                          </button>
                        )}

                      {normaliseStatus(
                        invoice.status
                      ) !==
                        "cancelled" &&
                        normaliseStatus(
                          invoice.status
                        ) !==
                          "paid" && (
                          <button
                            type="button"
                            style={
                              detailStyles.secondaryButton
                            }
                            disabled={
                              saving
                            }
                            onClick={() =>
                              updateStatus(
                                "Cancelled"
                              )
                            }
                          >
                            Cancel invoice
                          </button>
                        )}
                    </div>
                  )}
                </div>
              </section>
            </section>
          )}

          {/* DOCUMENT */}

          {!editing && (
            <section
              style={
                detailStyles.documentCard
              }
            >
              <div
                style={
                  detailStyles.documentToolbar
                }
              >
                <div>
                  <span
                    style={
                      detailStyles.eyebrow
                    }
                  >
                    Customer document
                  </span>

                  <h3>
                    Invoice preview
                  </h3>
                </div>

                <button
                  type="button"
                  style={
                    detailStyles.primaryButton
                  }
                  onClick={
                    downloadPDF
                  }
                >
                  Print / PDF
                </button>
              </div>

              <article
                style={
                  detailStyles.document
                }
              >
                <header
                  style={
                    detailStyles.documentHeader
                  }
                >
                  <div>
                    <strong
                      style={
                        detailStyles.companyName
                      }
                    >
                      {
                        companyName
                      }
                    </strong>

                    <p>
                      {
                        companyAddress
                      }
                    </p>

                    {companyWebsite && (
                      <p>
                        {
                          companyWebsite
                        }
                      </p>
                    )}

                    {companyEmail && (
                      <p>
                        {
                          companyEmail
                        }
                      </p>
                    )}

                    {companyPhone && (
                      <p>
                        {
                          companyPhone
                        }
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      textAlign:
                        "right",
                    }}
                  >
                    <h2
                      style={
                        detailStyles.invoiceTitle
                      }
                    >
                      INVOICE
                    </h2>

                    <strong>
                      {invoice.invoice_number ||
                        ""}
                    </strong>

                    <p>
                      Issued{" "}
                      {formatDate(
                        invoice.created_at
                      )}
                    </p>
                  </div>
                </header>

                <section
                  style={
                    detailStyles.documentMeta
                  }
                >
                  <div>
                    <span
                      style={
                        detailStyles.docLabel
                      }
                    >
                      Bill to
                    </span>

                    <strong>
                      {invoice.client ||
                        "Customer"}
                    </strong>
                  </div>

                  <div>
                    <span
                      style={
                        detailStyles.docLabel
                      }
                    >
                      Due date
                    </span>

                    <strong>
                      {formatDate(
                        invoice.due_date
                      )}
                    </strong>
                  </div>
                </section>

                <section
                  style={
                    detailStyles.invoiceTable
                  }
                >
                  <div
                    style={
                      detailStyles.invoiceTableHeader
                    }
                  >
                    <strong>
                      Service
                    </strong>

                    <strong>
                      Amount
                    </strong>
                  </div>

                  <div
                    style={
                      detailStyles.invoiceTableRow
                    }
                  >
                    <span>
                      {invoice.service ||
                        "Service"}
                    </span>

                    <span>
                      {
                        subtotal
                      }
                    </span>
                  </div>
                </section>

                <section
                  style={
                    detailStyles.totals
                  }
                >
                  <TotalRow
                    label="Subtotal"
                    value={
                      subtotal
                    }
                  />

                  <TotalRow
                    label={`VAT ${
                      vatRate ||
                      ""
                    }`}
                    value={
                      vatAmount
                    }
                  />

                  <TotalRow
                    label="Total"
                    value={
                      totalAmount
                    }
                    strong
                  />
                </section>

                <section
                  style={
                    detailStyles.documentSection
                  }
                >
                  <h3>
                    Payment terms
                  </h3>

                  <p>
                    {
                      paymentTerms
                    }
                  </p>
                </section>

                {(bankName ||
                  bankAccountName ||
                  bankSortCode ||
                  bankAccountNumber) && (
                  <section
                    style={
                      detailStyles.documentSection
                    }
                  >
                    <h3>
                      Bank details
                    </h3>

                    {bankName && (
                      <p>
                        Bank:{" "}
                        {
                          bankName
                        }
                      </p>
                    )}

                    {bankAccountName && (
                      <p>
                        Account name:{" "}
                        {
                          bankAccountName
                        }
                      </p>
                    )}

                    {bankSortCode && (
                      <p>
                        Sort code:{" "}
                        {
                          bankSortCode
                        }
                      </p>
                    )}

                    {bankAccountNumber && (
                      <p>
                        Account number:{" "}
                        {
                          bankAccountNumber
                        }
                      </p>
                    )}
                  </section>
                )}

                {(vatNumber ||
                  registrationNumber) && (
                  <footer
                    style={
                      detailStyles.documentFooter
                    }
                  >
                    {registrationNumber && (
                      <span>
                        Company No:{" "}
                        {
                          registrationNumber
                        }
                      </span>
                    )}

                    {vatNumber && (
                      <span>
                        VAT No:{" "}
                        {
                          vatNumber
                        }
                      </span>
                    )}
                  </footer>
                )}
              </article>
            </section>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// COMPONENTS
// =========================================================

function EditField({
  label,
  name,
  value,
  onChange,
  type = "text",
}) {
  return (
    <label
      style={
        detailStyles.field
      }
    >
      <span>
        {label}
      </span>

      <input
        name={
          name
        }
        type={
          type
        }
        value={
          value ||
          ""
        }
        onChange={
          onChange
        }
        style={
          detailStyles.input
        }
      />
    </label>
  );
}

function DetailRow({
  label,
  value,
}) {
  return (
    <div
      style={
        detailStyles.detailRow
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value ||
          "Not available"}
      </strong>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
}) {
  return (
    <div
      style={{
        ...detailStyles.totalRow,

        ...(strong
          ? detailStyles.grandTotal
          : {}),
      }}
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
    <section
      style={
        detailStyles.loading
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
            key={
              index
            }
            style={
              detailStyles.loadingRow
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

function formatDate(
  value
) {
  if (
    !value
  ) {
    return "Not set";
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
    return "Not set";
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

function toDateInput(
  value
) {
  if (
    !value
  ) {
    return "";
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
    return String(
      value
    ).slice(
      0,
      10
    );
  }

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}

function isOverdue(
  dueDate
) {
  if (
    !dueDate
  ) {
    return false;
  }

  const date =
    new Date(
      dueDate
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  return (
    date.getTime() <
    Date.now()
  );
}

function getDisplayStatus(
  invoice
) {
  const status =
    normaliseStatus(
      invoice.status
    );

  if (
    ![
      "paid",
      "cancelled",
      "overdue",
    ].includes(
      status
    ) &&
    isOverdue(
      invoice.due_date
    )
  ) {
    return "Overdue";
  }

  return (
    invoice.status ||
    "Draft Invoice"
  );
}

// =========================================================
// STYLES
// =========================================================

const detailStyles = {
  page: {
    display:
      "grid",

    gap:
      "20px",

    color:
      "#28251f",

    fontSize:
      "13px",
  },

  header: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "flex-start",

    gap:
      "24px",
  },

  backLink: {
    display:
      "inline-block",

    marginBottom:
      "12px",

    color:
      "#8d6b05",

    fontSize:
      "11px",

    fontWeight:
      750,

    textDecoration:
      "none",
  },

  eyebrow: {
    display:
      "block",

    marginBottom:
      "6px",

    color:
      "#9b7507",

    fontSize:
      "10px",

    fontWeight:
      800,

    letterSpacing:
      "1px",

    textTransform:
      "uppercase",
  },

  heading: {
    margin:
      0,

    fontSize:
      "27px",
  },

  description: {
    margin:
      "6px 0 0",

    color:
      "#7c786e",

    fontSize:
      "13px",
  },

  actions: {
    display:
      "flex",

    flexWrap:
      "wrap",

    justifyContent:
      "flex-end",

    gap:
      "9px",
  },

  primaryButton: {
    minHeight:
      "39px",

    padding:
      "0 15px",

    border:
      "1px solid #b78800",

    borderRadius:
      "10px",

    background:
      "#dca900",

    color:
      "#17130a",

    fontSize:
      "12px",

    fontWeight:
      750,

    cursor:
      "pointer",
  },

  secondaryButton: {
    minHeight:
      "39px",

    padding:
      "0 15px",

    border:
      "1px solid #ddd9cf",

    borderRadius:
      "10px",

    background:
      "#ffffff",

    color:
      "#413d36",

    fontSize:
      "12px",

    fontWeight:
      700,

    cursor:
      "pointer",
  },

  dangerButton: {
    minHeight:
      "39px",

    padding:
      "0 15px",

    border:
      "1px solid #e1b9b9",

    borderRadius:
      "10px",

    background:
      "#fff7f7",

    color:
      "#a13e3e",

    fontSize:
      "12px",

    fontWeight:
      700,

    cursor:
      "pointer",
  },

  hero: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "25px",

    padding:
      "22px",

    border:
      "1px solid #dedbd2",

    borderRadius:
      "16px",

    background:
      "#ffffff",
  },

  identity: {
    display:
      "flex",

    alignItems:
      "center",

    gap:
      "14px",
  },

  invoiceIcon: {
    display:
      "grid",

    width:
      "48px",

    height:
      "48px",

    placeItems:
      "center",

    borderRadius:
      "12px",

    background:
      "#29271f",

    color:
      "#e2b83a",

    fontSize:
      "20px",

    fontWeight:
      800,
  },

  smallLabel: {
    color:
      "#9b7507",

    fontSize:
      "10px",

    fontWeight:
      800,

    textTransform:
      "uppercase",
  },

  heroTitle: {
    margin:
      "4px 0 8px",

    fontSize:
      "20px",
  },

  meta: {
    display:
      "flex",

    flexWrap:
      "wrap",

    gap:
      "8px",

    alignItems:
      "center",
  },

  metaBadge: {
    padding:
      "5px 8px",

    borderRadius:
      "999px",

    background:
      "#f4f1ea",

    color:
      "#686359",

    fontSize:
      "10px",

    fontWeight:
      650,
  },

  totalBox: {
    display:
      "grid",

    minWidth:
      "190px",

    gap:
      "5px",

    padding:
      "15px 18px",

    borderRadius:
      "12px",

    background:
      "#f8efd4",

    textAlign:
      "right",
  },

  panel: {
    overflow:
      "hidden",

    border:
      "1px solid #dedbd2",

    borderRadius:
      "15px",

    background:
      "#ffffff",
  },

  panelHeader: {
    padding:
      "18px 20px",

    borderBottom:
      "1px solid #ece9e2",
  },

  formGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",

    gap:
      "15px",

    padding:
      "20px",
  },

  field: {
    display:
      "grid",

    gap:
      "7px",

    color:
      "#3e3a33",

    fontSize:
      "12px",

    fontWeight:
      700,
  },

  input: {
    minHeight:
      "42px",

    padding:
      "0 11px",

    border:
      "1px solid #dcd8ce",

    borderRadius:
      "9px",

    background:
      "#ffffff",

    fontSize:
      "13px",
  },

  textarea: {
    padding:
      "11px",

    border:
      "1px solid #dcd8ce",

    borderRadius:
      "9px",

    resize:
      "vertical",

    fontFamily:
      "inherit",

    fontSize:
      "13px",
  },

  twoColumn: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",

    gap:
      "16px",
  },

  detailList: {
    display:
      "grid",

    padding:
      "5px 20px 15px",
  },

  detailRow: {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "20px",

    padding:
      "13px 0",

    borderBottom:
      "1px solid #efede7",

    fontSize:
      "12px",
  },

  statusPanel: {
    display:
      "grid",

    justifyItems:
      "start",

    gap:
      "15px",

    padding:
      "20px",
  },

  statusAmount: {
    fontSize:
      "25px",
  },

  statusActions: {
    display:
      "flex",

    flexWrap:
      "wrap",

    gap:
      "8px",
  },

  documentCard: {
    overflow:
      "hidden",

    border:
      "1px solid #dedbd2",

    borderRadius:
      "16px",

    background:
      "#f4f2ed",
  },

  documentToolbar: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    padding:
      "17px 20px",

    borderBottom:
      "1px solid #dedbd2",

    background:
      "#ffffff",
  },

  document: {
    width:
      "min(900px, calc(100% - 50px))",

    minHeight:
      "950px",

    margin:
      "28px auto",

    padding:
      "45px",

    border:
      "1px solid #dedbd2",

    background:
      "#ffffff",

    boxShadow:
      "0 16px 40px rgba(38,31,13,.08)",
  },

  documentHeader: {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "30px",

    paddingBottom:
      "24px",

    borderBottom:
      "3px solid #c99b17",
  },

  companyName: {
    fontSize:
      "18px",
  },

  invoiceTitle: {
    margin:
      0,

    color:
      "#936c00",

    letterSpacing:
      "2px",
  },

  documentMeta: {
    display:
      "grid",

    gridTemplateColumns:
      "1fr auto",

    gap:
      "40px",

    padding:
      "28px 0",
  },

  docLabel: {
    display:
      "block",

    marginBottom:
      "6px",

    color:
      "#987100",

    fontSize:
      "10px",

    fontWeight:
      800,

    letterSpacing:
      ".6px",

    textTransform:
      "uppercase",
  },

  invoiceTable: {
    border:
      "1px solid #dfdcd3",

    borderRadius:
      "10px",

    overflow:
      "hidden",
  },

  invoiceTableHeader: {
    display:
      "grid",

    gridTemplateColumns:
      "1fr auto",

    gap:
      "20px",

    padding:
      "12px 15px",

    background:
      "#f5f2eb",
  },

  invoiceTableRow: {
    display:
      "grid",

    gridTemplateColumns:
      "1fr auto",

    gap:
      "20px",

    padding:
      "15px",
  },

  totals: {
    display:
      "grid",

    width:
      "360px",

    maxWidth:
      "100%",

    margin:
      "25px 0 25px auto",
  },

  totalRow: {
    display:
      "flex",

    justifyContent:
      "space-between",

    padding:
      "9px 0",

    borderBottom:
      "1px solid #ece9e1",
  },

  grandTotal: {
    marginTop:
      "4px",

    padding:
      "13px",

    borderBottom:
      0,

    borderRadius:
      "9px",

    background:
      "#f7efd5",

    color:
      "#805f00",

    fontSize:
      "16px",
  },

  documentSection: {
    marginTop:
      "28px",

    paddingTop:
      "18px",

    borderTop:
      "1px solid #ece9e1",

    lineHeight:
      1.7,
  },

  documentFooter: {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "20px",

    marginTop:
      "40px",

    paddingTop:
      "16px",

    borderTop:
      "1px solid #dedbd2",

    color:
      "#8f8a80",

    fontSize:
      "10px",
  },

  error: {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "20px",

    padding:
      "20px",

    border:
      "1px solid #efcaca",

    borderRadius:
      "14px",

    background:
      "#fff7f7",

    color:
      "#a13e3e",
  },

  notFound: {
    display:
      "grid",

    minHeight:
      "360px",

    placeItems:
      "center",

    alignContent:
      "center",

    gap:
      "10px",

    textAlign:
      "center",
  },

  bigIcon: {
    display:
      "grid",

    width:
      "55px",

    height:
      "55px",

    placeItems:
      "center",

    borderRadius:
      "14px",

    background:
      "#f5edcf",

    color:
      "#987000",

    fontSize:
      "22px",
  },

  primaryLink: {
    padding:
      "11px 15px",

    borderRadius:
      "9px",

    background:
      "#dca900",

    color:
      "#17130a",

    fontSize:
      "12px",

    fontWeight:
      750,

    textDecoration:
      "none",
  },

  loading: {
    display:
      "grid",

    gap:
      "11px",
  },

  loadingRow: {
    height:
      "72px",

    borderRadius:
      "12px",

    background:
      "#eeece6",
  },
};

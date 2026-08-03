"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import SendRecordEmail from "../../../components/SendRecordEmail";
import StatusBadge from "../../../components/StatusBadge";
import styles from "./invoice-details.module.css";

const INVOICE_STATUS_OPTIONS = [
  "Draft Invoice",
  "Draft",
  "Sent",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
];

export default function InvoiceDetailsPage() {
  const params = useParams();
  const invoiceId = params?.id;

  const [invoice, setInvoice] = useState(null);
  const [draftInvoice, setDraftInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId]);

  async function fetchInvoice() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        invoiceResponse,
        settingsResponse,
        quotesResponse,
      ] = await Promise.all([
        fetch(`/api/invoices/${invoiceId}`, {
          cache: "no-store",
        }),

        fetch("/api/company-settings", {
          cache: "no-store",
        }),

        fetch("/api/quotes", {
          cache: "no-store",
        }),
      ]);

      const invoiceData =
        await invoiceResponse.json();

      const settingsData =
        await settingsResponse.json();

      const quotesData =
        quotesResponse.ok
          ? await quotesResponse.json()
          : [];

      if (!invoiceResponse.ok) {
        throw new Error(
          invoiceData.error ||
            "Failed to load invoice."
        );
      }

      if (!settingsResponse.ok) {
        throw new Error(
          settingsData.error ||
            "Failed to load company settings."
        );
      }

      const selectedInvoice = Array.isArray(
        invoiceData
      )
        ? invoiceData[0]
        : invoiceData;

      const relatedQuote = (
        Array.isArray(quotesData)
          ? quotesData
          : []
      ).find(
        (quote) =>
          String(quote.id) ===
          String(selectedInvoice?.quote_id)
      );

      setInvoice(selectedInvoice || null);
      setDraftInvoice(selectedInvoice || null);
      setSettings(settingsData || null);

      setRecipientEmail(
        relatedQuote?.email ||
          selectedInvoice?.email ||
          ""
      );
    } catch (error) {
      console.error(
        "Invoice loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load this invoice."
      );
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    setDraftInvoice({
      ...invoice,

      subtotal:
        invoice.subtotal ||
        invoice.amount ||
        "",

      vat_rate:
        invoice.vat_rate || "0%",

      payment_terms:
        invoice.payment_terms ||
        settings?.payment_terms ||
        "Payment due within 14 days of invoice date.",
    });

    setEditing(true);
  }

  function cancelEditing() {
    setDraftInvoice({
      ...invoice,
    });

    setEditing(false);
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;

    setDraftInvoice((currentInvoice) => ({
      ...currentInvoice,
      [name]: value,
    }));
  }

  async function saveInvoice() {
    if (!draftInvoice) {
      return;
    }

    if (!draftInvoice.client?.trim()) {
      alert("Client name is required.");
      return;
    }

    if (!draftInvoice.service?.trim()) {
      alert("Service is required.");
      return;
    }

    const subtotalValue = parseMoney(
      draftInvoice.subtotal
    );

    const vatRateValue = parseVatRate(
      draftInvoice.vat_rate
    );

    if (subtotalValue < 0) {
      alert("Subtotal cannot be negative.");
      return;
    }

    if (
      vatRateValue < 0 ||
      vatRateValue > 100
    ) {
      alert(
        "VAT rate must be between 0 and 100."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/invoices/${invoiceId}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            client:
              draftInvoice.client.trim(),

            service:
              draftInvoice.service.trim(),

            subtotal:
              subtotalValue,

            vat_rate:
              vatRateValue,

            due_date:
              draftInvoice.due_date || null,

            payment_terms:
              String(
                draftInvoice.payment_terms ||
                  ""
              ).trim(),

            status:
              draftInvoice.status ||
              "Draft Invoice",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save invoice."
        );
      }

      const updatedInvoice = Array.isArray(
        data
      )
        ? data[0]
        : data;

      setInvoice(
        updatedInvoice || draftInvoice
      );

      setDraftInvoice(
        updatedInvoice || draftInvoice
      );

      setEditing(false);

      alert(
        "Invoice updated successfully."
      );
    } catch (error) {
      console.error(
        "Invoice save error:",
        error
      );

      alert(
        error.message ||
          "Error saving invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateInvoiceStatus(status) {
    try {
      setUpdatingStatus(true);

      const response = await fetch(
        `/api/invoices/${invoiceId}`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update invoice."
        );
      }

      const updatedInvoice = Array.isArray(
        data
      )
        ? data[0]
        : data;

      const fallbackInvoice = {
        ...invoice,
        status,
      };

      setInvoice(
        updatedInvoice || fallbackInvoice
      );

      setDraftInvoice(
        updatedInvoice || fallbackInvoice
      );

      alert(`Invoice marked as ${status}.`);
    } catch (error) {
      console.error(
        "Invoice status update error:",
        error
      );

      alert(
        error.message ||
          "Error updating invoice."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  function downloadPDF() {
    window.print();
  }

  async function copyInvoiceSummary() {
    try {
      if (!invoice) {
        return;
      }

      const summary = [
        `Invoice: ${
          invoice.invoice_number ||
          "Invoice"
        }`,

        `Client: ${
          invoice.client ||
          "Not available"
        }`,

        `Service: ${
          invoice.service ||
          "Not available"
        }`,

        `Total: ${getStoredTotal(invoice)}`,

        `Status: ${
          invoice.status ||
          "Draft Invoice"
        }`,

        `Due date: ${formatDate(
          invoice.due_date
        )}`,
      ].join("\n");

      await navigator.clipboard.writeText(
        summary
      );

      alert(
        "Invoice summary copied successfully."
      );
    } catch (error) {
      console.error(
        "Invoice copy error:",
        error
      );

      alert(
        "Unable to copy the invoice summary."
      );
    }
  }

  const visibleInvoice = editing
    ? draftInvoice
    : invoice;

  const calculations = useMemo(() => {
    if (!visibleInvoice) {
      return {
        subtotalValue: 0,
        vatRateValue: 0,
        vatAmountValue: 0,
        totalValue: 0,
      };
    }

    const subtotalValue = parseMoney(
      visibleInvoice.subtotal ||
        visibleInvoice.amount
    );

    const vatRateValue = parseVatRate(
      visibleInvoice.vat_rate
    );

    const vatAmountValue =
      subtotalValue *
      (vatRateValue / 100);

    const totalValue =
      subtotalValue +
      vatAmountValue;

    return {
      subtotalValue,
      vatRateValue,
      vatAmountValue,
      totalValue,
    };
  }, [visibleInvoice]);

  if (loading) {
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

  if (errorMessage) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Invoice Workspace"
          description="Manage billing and payment activity."
        >
          <section
            className={
              styles.errorPanel
            }
          >
            <div>
              <strong>
                Unable to load invoice
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
              onClick={fetchInvoice}
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
    !draftInvoice ||
    !visibleInvoice
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Invoice Workspace"
          description="Manage billing and payment activity."
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
              £
            </span>

            <h2>
              Invoice not found
            </h2>

            <p>
              This invoice may have been
              deleted or you may not have
              permission to open it.
            </p>

            <Link
              href="/invoices"
              className={
                styles.primaryButton
              }
            >
              Return to invoices
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

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
    settings?.company_email || "";

  const companyPhone =
    settings?.company_phone || "";

  const vatNumber =
    settings?.vat_number || "";

  const companyRegistrationNumber =
    settings?.company_registration_number ||
    "";

  const bankName =
    settings?.bank_name || "";

  const bankAccountName =
    settings?.bank_account_name || "";

  const bankSortCode =
    settings?.bank_sort_code || "";

  const bankAccountNumber =
    settings?.bank_account_number || "";

  const storedSubtotal =
    editing
      ? formatCurrency(
          calculations.subtotalValue
        )
      : visibleInvoice.subtotal ||
        visibleInvoice.amount ||
        "£0.00";

  const storedVatRate =
    editing
      ? `${calculations.vatRateValue}%`
      : visibleInvoice.vat_rate ||
        "0%";

  const storedVatAmount =
    editing
      ? formatCurrency(
          calculations.vatAmountValue
        )
      : visibleInvoice.vat_amount ||
        "£0.00";

  const storedTotal =
    editing
      ? formatCurrency(
          calculations.totalValue
        )
      : visibleInvoice.total_amount ||
        visibleInvoice.amount ||
        "£0.00";

  const paymentTerms =
    visibleInvoice.payment_terms ||
    settings?.payment_terms ||
    "Payment due within 14 days of invoice date.";

  const overdue = isInvoiceOverdue(
    visibleInvoice
  );

  const paid =
    normaliseStatus(
      visibleInvoice.status
    ) === "paid";

  const paymentRisk =
    getPaymentRisk({
      invoice: visibleInvoice,
      overdue,
      paid,
    });

  const recommendations =
    getInvoiceRecommendations({
      invoice: visibleInvoice,
      overdue,
      paid,
      recipientEmail,
      bankDetailsAvailable: Boolean(
        bankName ||
          bankAccountName ||
          bankSortCode ||
          bankAccountNumber
      ),
    });

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          invoice.invoice_number ||
          "Invoice Workspace"
        }
        description="Billing, payment status and customer invoice document."
      >
        <div
          className={
            styles.page
          }
        >
          <section
            className={`${styles.pageHeader} ${styles.noPrint}`}
          >
            <div
              className={
                styles.headerCopy
              }
            >
              <Link
                href="/invoices"
                className={
                  styles.backLink
                }
              >
                ← Back to invoices
              </Link>

              <span
                className={
                  styles.eyebrow
                }
              >
                Finance workspace
              </span>

              <h2>
                {invoice.invoice_number ||
                  "Invoice"}
              </h2>

              <p>
                Manage billing, payment
                status and customer delivery.
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              {!editing && (
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
                  onSent={(data) => {
                    if (data.invoice) {
                      setInvoice(
                        data.invoice
                      );

                      setDraftInvoice(
                        data.invoice
                      );
                    } else {
                      setInvoice(
                        (
                          currentInvoice
                        ) => ({
                          ...currentInvoice,

                          status:
                            normaliseStatus(
                              currentInvoice.status
                            ) === "paid"
                              ? "Paid"
                              : "Sent",
                        })
                      );
                    }
                  }}
                />
              )}

              {!editing ? (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={
                    startEditing
                  }
                >
                  Edit invoice
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    disabled={saving}
                    onClick={
                      cancelEditing
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    disabled={saving}
                    onClick={
                      saveInvoice
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </>
              )}

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  copyInvoiceSummary
                }
              >
                Copy summary
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
                Print / Save PDF
              </button>

              {!editing && !paid && (
                <>
                  <button
                    type="button"
                    className={
                      styles.warningButton
                    }
                    disabled={
                      updatingStatus
                    }
                    onClick={() =>
                      updateInvoiceStatus(
                        "Sent"
                      )
                    }
                  >
                    {updatingStatus
                      ? "Updating..."
                      : "Mark sent"}
                  </button>

                  <button
                    type="button"
                    className={
                      styles.successButton
                    }
                    disabled={
                      updatingStatus
                    }
                    onClick={() =>
                      updateInvoiceStatus(
                        "Paid"
                      )
                    }
                  >
                    {updatingStatus
                      ? "Updating..."
                      : "Mark paid"}
                  </button>
                </>
              )}
            </div>
          </section>

          <section
            className={
              styles.heroCard
            }
          >
            <div
              className={
                styles.invoiceIdentity
              }
            >
              <span
                className={
                  styles.invoiceIcon
                }
              >
                £
              </span>

              <div
                className={
                  styles.identityCopy
                }
              >
                <span
                  className={
                    styles.heroLabel
                  }
                >
                  Customer invoice
                </span>

                <h3>
                  {visibleInvoice.client ||
                    "Unnamed client"}
                </h3>

                <p>
                  {visibleInvoice.service ||
                    "Professional services"}
                </p>

                <div
                  className={
                    styles.identityMeta
                  }
                >
                  <StatusBadge
                    status={
                      visibleInvoice.status ||
                      "Draft Invoice"
                    }
                  />

                  <span
                    className={
                      styles.metaBadge
                    }
                  >
                    Created{" "}
                    {formatDate(
                      invoice.created_at
                    )}
                  </span>

                  <span
                    className={
                      overdue
                        ? styles.overdueBadge
                        : styles.metaBadge
                    }
                  >
                    {overdue
                      ? "Payment overdue"
                      : `Due ${formatDate(
                          visibleInvoice.due_date
                        )}`}
                  </span>

                  {invoice.customer_id && (
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
                styles.heroMetrics
              }
            >
              <HeroMetric
                label="Subtotal"
                value={
                  storedSubtotal
                }
              />

              <HeroMetric
                label="VAT"
                value={
                  storedVatAmount
                }
              />

              <HeroMetric
                label="Total"
                value={
                  storedTotal
                }
                paid={paid}
                warning={overdue}
              />
            </div>
          </section>

          <section
            className={
              styles.workspaceGrid
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
                    Invoice information
                  </h3>

                  <p>
                    Client, service, VAT and
                    payment details
                  </p>
                </div>
              </div>

              {editing ? (
                <>
                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <Field
                      label="Client"
                      name="client"
                      value={
                        draftInvoice.client
                      }
                      onChange={
                        handleFieldChange
                      }
                      disabled={saving}
                    />

                    <Field
                      label="Service"
                      name="service"
                      value={
                        draftInvoice.service
                      }
                      onChange={
                        handleFieldChange
                      }
                      disabled={saving}
                    />

                    <Field
                      label="Subtotal"
                      name="subtotal"
                      value={
                        draftInvoice.subtotal
                      }
                      onChange={
                        handleFieldChange
                      }
                      disabled={saving}
                    />

                    <Field
                      label="VAT rate"
                      name="vat_rate"
                      value={
                        draftInvoice.vat_rate
                      }
                      onChange={
                        handleFieldChange
                      }
                      disabled={saving}
                    />

                    <Field
                      label="VAT amount"
                      value={
                        storedVatAmount
                      }
                      disabled
                    />

                    <Field
                      label="Total amount"
                      value={
                        storedTotal
                      }
                      disabled
                    />

                    <Field
                      label="Due date"
                      name="due_date"
                      type="date"
                      value={
                        draftInvoice.due_date
                      }
                      onChange={
                        handleFieldChange
                      }
                      disabled={saving}
                    />

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="invoice-status"
                      >
                        Status
                      </label>

                      <select
                        id="invoice-status"
                        name="status"
                        value={
                          draftInvoice.status ||
                          "Draft Invoice"
                        }
                        disabled={saving}
                        onChange={
                          handleFieldChange
                        }
                      >
                        {INVOICE_STATUS_OPTIONS.map(
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
                    </div>

                    <div
                      className={`${styles.field} ${styles.fieldFull}`}
                    >
                      <label
                        htmlFor="invoice-payment-terms"
                      >
                        Payment terms
                      </label>

                      <textarea
                        id="invoice-payment-terms"
                        name="payment_terms"
                        rows={4}
                        value={
                          draftInvoice.payment_terms ||
                          ""
                        }
                        disabled={saving}
                        onChange={
                          handleFieldChange
                        }
                      />
                    </div>
                  </div>

                  <div
                    className={
                      styles.calculationPanel
                    }
                  >
                    <CalculationItem
                      label="Subtotal"
                      value={
                        storedSubtotal
                      }
                    />

                    <CalculationItem
                      label={`VAT (${storedVatRate})`}
                      value={
                        storedVatAmount
                      }
                    />

                    <CalculationItem
                      label="Invoice total"
                      value={
                        storedTotal
                      }
                      total
                    />
                  </div>
                </>
              ) : (
                <div
                  className={
                    styles.detailList
                  }
                >
                  <DetailRow
                    label="Invoice number"
                    value={
                      invoice.invoice_number
                    }
                  />

                  <DetailRow
                    label="Client"
                    value={
                      invoice.client
                    }
                  />

                  <DetailRow
                    label="Recipient email"
                    value={
                      recipientEmail
                    }
                    href={
                      recipientEmail
                        ? `mailto:${recipientEmail}`
                        : null
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
                      storedSubtotal
                    }
                  />

                  <DetailRow
                    label="VAT rate"
                    value={
                      storedVatRate
                    }
                  />

                  <DetailRow
                    label="VAT amount"
                    value={
                      storedVatAmount
                    }
                  />

                  <DetailRow
                    label="Total"
                    value={
                      storedTotal
                    }
                  />

                  <DetailRow
                    label="Status"
                    customValue={
                      <StatusBadge
                        status={
                          invoice.status ||
                          "Draft Invoice"
                        }
                      />
                    }
                  />

                  <DetailRow
                    label="Due date"
                    value={formatDate(
                      invoice.due_date
                    )}
                  />

                  <DetailRow
                    label="Customer"
                    customValue={
                      invoice.customer_id ? (
                        <Link
                          href={`/customers/${invoice.customer_id}`}
                          className={
                            styles.customerLink
                          }
                        >
                          Open linked customer
                          <span>→</span>
                        </Link>
                      ) : (
                        <strong
                          className={
                            styles.emptyValue
                          }
                        >
                          Not linked
                        </strong>
                      )
                    }
                  />

                  <DetailRow
                    label="Project"
                    customValue={
                      invoice.project_id ? (
                        <Link
                          href={`/projects/${invoice.project_id}`}
                          className={
                            styles.projectLink
                          }
                        >
                          Open linked project
                          <span>→</span>
                        </Link>
                      ) : (
                        <strong
                          className={
                            styles.emptyValue
                          }
                        >
                          Not linked
                        </strong>
                      )
                    }
                  />
                </div>
              )}
            </section>

            <section
              className={
                styles.aiPanel
              }
            >
              <div
                className={
                  styles.aiHeader
                }
              >
                <span
                  className={
                    styles.aiIcon
                  }
                >
                  ✦
                </span>

                <div>
                  <span>
                    Payment intelligence
                  </span>

                  <h3>
                    Invoice risk overview
                  </h3>
                </div>
              </div>

              <div
                className={
                  styles.riskGrid
                }
              >
                <RiskMetric
                  label="Payment risk"
                  value={
                    paymentRisk
                  }
                />

                <RiskMetric
                  label="Current status"
                  value={
                    visibleInvoice.status ||
                    "Draft Invoice"
                  }
                />

                <RiskMetric
                  label="Due position"
                  value={
                    overdue
                      ? "Overdue"
                      : paid
                        ? "Settled"
                        : "Within terms"
                  }
                />

                <RiskMetric
                  label="Recipient"
                  value={
                    recipientEmail
                      ? "Available"
                      : "Missing"
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
                      <span>
                        →
                      </span>

                      <p>
                        {
                          recommendation
                        }
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>
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
                  Payment history
                </h3>

                <p>
                  Invoice workflow and payment
                  activity
                </p>
              </div>
            </div>

            <div
              className={
                styles.paymentHistory
              }
            >
              <PaymentItem
                title="Invoice created"
                description={`Invoice ${
                  invoice.invoice_number ||
                  ""
                } was created.`}
                date={
                  invoice.created_at
                }
              />

              {normaliseStatus(
                invoice.status
              ) !== "draft" &&
                normaliseStatus(
                  invoice.status
                ) !==
                  "draft invoice" && (
                  <PaymentItem
                    title={`Invoice ${invoice.status}`}
                    description={`The current invoice status is ${
                      invoice.status
                    }.`}
                    date={
                      invoice.updated_at ||
                      invoice.created_at
                    }
                  />
                )}

              {paid && (
                <PaymentItem
                  title="Payment completed"
                  description={`The invoice total of ${storedTotal} has been marked as paid.`}
                  date={
                    invoice.updated_at ||
                    invoice.created_at
                  }
                />
              )}

              {overdue && !paid && (
                <PaymentItem
                  title="Payment overdue"
                  description={`Payment was due on ${formatDate(
                    invoice.due_date
                  )}.`}
                  date={
                    invoice.due_date
                  }
                />
              )}
            </div>
          </section>

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
                  Invoice preview
                </h3>
              </div>

              <div>
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={
                    copyInvoiceSummary
                  }
                >
                  Copy summary
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
                styles.invoiceDocument
              }
            >
              <header
                className={
                  styles.invoiceHeader
                }
              >
                <div
                  className={
                    styles.companyIdentity
                  }
                >
                  <span
                    className={
                      styles.companyMark
                    }
                  >
                    SN
                  </span>

                  <div>
                    <h2>
                      {companyName}
                    </h2>

                    <p>
                      Digital Solutions &
                      Automation
                    </p>

                    <p>
                      {companyAddress}
                    </p>

                    <p>
                      {companyWebsite}
                    </p>

                    {companyEmail && (
                      <p>
                        Email:{" "}
                        {companyEmail}
                      </p>
                    )}

                    {companyPhone && (
                      <p>
                        Phone:{" "}
                        {companyPhone}
                      </p>
                    )}

                    {companyRegistrationNumber && (
                      <p>
                        Company No:{" "}
                        {
                          companyRegistrationNumber
                        }
                      </p>
                    )}

                    {vatNumber && (
                      <p>
                        VAT No:{" "}
                        {vatNumber}
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className={
                    styles.invoiceMeta
                  }
                >
                  <h1>
                    INVOICE
                  </h1>

                  <p>
                    <strong>
                      Invoice No:
                    </strong>{" "}
                    {invoice.invoice_number ||
                      "Invoice"}
                  </p>

                  <p>
                    <strong>
                      Date:
                    </strong>{" "}
                    {formatDate(
                      invoice.created_at
                    )}
                  </p>

                  <p>
                    <strong>
                      Due Date:
                    </strong>{" "}
                    {formatDate(
                      visibleInvoice.due_date
                    )}
                  </p>

                  <p>
                    <strong>
                      Status:
                    </strong>{" "}
                    {visibleInvoice.status ||
                      "Draft Invoice"}
                  </p>
                </div>
              </header>

              <section
                className={
                  styles.billGrid
                }
              >
                <div
                  className={
                    styles.billPanel
                  }
                >
                  <span>
                    Bill to
                  </span>

                  <strong>
                    {visibleInvoice.client ||
                      "Client"}
                  </strong>

                  {recipientEmail && (
                    <p>
                      {recipientEmail}
                    </p>
                  )}
                </div>

                <div
                  className={
                    styles.billPanel
                  }
                >
                  <span>
                    Project / Service
                  </span>

                  <strong>
                    {visibleInvoice.service ||
                      "Professional services"}
                  </strong>

                  {invoice.project_id && (
                    <p>
                      Linked project
                    </p>
                  )}
                </div>
              </section>

              <div
                className={
                  styles.invoiceItemsWrapper
                }
              >
                <table
                  className={
                    styles.invoiceItemsTable
                  }
                >
                  <thead>
                    <tr>
                      <th>
                        Description
                      </th>

                      <th>
                        Qty
                      </th>

                      <th>
                        Subtotal
                      </th>

                      <th>
                        VAT
                      </th>

                      <th>
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>
                        {visibleInvoice.service ||
                          "Professional services"}
                      </td>

                      <td>
                        1
                      </td>

                      <td>
                        {
                          storedSubtotal
                        }
                      </td>

                      <td>
                        {storedVatAmount}{" "}
                        ({storedVatRate})
                      </td>

                      <td>
                        {
                          storedTotal
                        }
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <section
                className={
                  styles.invoiceBottomGrid
                }
              >
                <div
                  className={
                    styles.paymentTerms
                  }
                >
                  <div>
                    <h3>
                      Payment terms
                    </h3>

                    <p>
                      {paymentTerms}
                    </p>
                  </div>

                  {(bankName ||
                    bankAccountName ||
                    bankSortCode ||
                    bankAccountNumber) && (
                    <div
                      className={
                        styles.bankDetails
                      }
                    >
                      <span>
                        Bank details
                      </span>

                      {bankName && (
                        <p>
                          Bank:{" "}
                          {bankName}
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
                          {bankSortCode}
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

                      <p>
                        Payment reference:{" "}
                        {invoice.invoice_number ||
                          "Invoice"}
                      </p>
                    </div>
                  )}

                  <p>
                    Thank you for your
                    business.
                  </p>
                </div>

                <div
                  className={
                    styles.totalsCard
                  }
                >
                  <TotalRow
                    label="Subtotal"
                    value={
                      storedSubtotal
                    }
                  />

                  <TotalRow
                    label={`VAT (${storedVatRate})`}
                    value={
                      storedVatAmount
                    }
                  />

                  <TotalRow
                    label="Total amount"
                    value={
                      storedTotal
                    }
                    grand
                  />
                </div>
              </section>

              <footer
                className={
                  styles.invoiceFooter
                }
              >
                <p>
                  Generated by SaiNal One
                </p>

                <p>
                  AI-powered Business
                  Operating System
                </p>
              </footer>
            </article>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  disabled = false,
}) {
  return (
    <div
      className={
        styles.field
      }
    >
      <label
        htmlFor={
          name
            ? `invoice-${name}`
            : undefined
        }
      >
        {label}
      </label>

      <input
        id={
          name
            ? `invoice-${name}`
            : undefined
        }
        name={name}
        type={type}
        value={value || ""}
        disabled={disabled}
        onChange={onChange}
      />
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

function HeroMetric({
  label,
  value,
  paid = false,
  warning = false,
}) {
  return (
    <div
      className={`${styles.heroMetric} ${
        paid
          ? styles.heroMetricPaid
          : ""
      } ${
        warning
          ? styles.heroMetricWarning
          : ""
      }`}
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

function CalculationItem({
  label,
  value,
  total = false,
}) {
  return (
    <div
      className={`${styles.calculationItem} ${
        total
          ? styles.calculationTotal
          : ""
      }`}
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

function RiskMetric({
  label,
  value,
}) {
  return (
    <div
      className={
        styles.riskMetric
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

function PaymentItem({
  title,
  description,
  date,
}) {
  return (
    <div
      className={
        styles.paymentItem
      }
    >
      <span
        className={
          styles.paymentDot
        }
      />

      <div>
        <strong>
          {title}
        </strong>

        <p>
          {description}
        </p>
      </div>

      <time>
        {formatDate(date)}
      </time>
    </div>
  );
}

function TotalRow({
  label,
  value,
  grand = false,
}) {
  return (
    <div
      className={`${styles.totalRow} ${
        grand
          ? styles.grandTotal
          : ""
      }`}
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
      className={
        styles.loadingPanel
      }
    >
      {Array.from({
        length: 6,
      }).map((_, index) => (
        <div
          key={index}
          className={
            styles.loadingRow
          }
        />
      ))}
    </section>
  );
}

function parseMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const cleanedValue = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsedValue =
    Number.parseFloat(cleanedValue);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}

function parseVatRate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const cleanedValue = String(value)
    .replace("%", "")
    .trim();

  const parsedValue =
    Number.parseFloat(cleanedValue);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(value || 0);
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
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function normaliseStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isInvoiceOverdue(invoice) {
  const status = normaliseStatus(
    invoice.status
  );

  if (status === "overdue") {
    return true;
  }

  if (
    ["paid", "cancelled"].includes(
      status
    )
  ) {
    return false;
  }

  if (!invoice.due_date) {
    return false;
  }

  const dueDate =
    new Date(invoice.due_date);

  if (
    Number.isNaN(
      dueDate.getTime()
    )
  ) {
    return false;
  }

  dueDate.setHours(
    23,
    59,
    59,
    999
  );

  return dueDate < new Date();
}

function getStoredTotal(invoice) {
  return (
    invoice.total_amount ||
    invoice.amount ||
    "£0.00"
  );
}

function getPaymentRisk({
  invoice,
  overdue,
  paid,
}) {
  if (paid) {
    return "No risk";
  }

  if (overdue) {
    return "High";
  }

  const status = normaliseStatus(
    invoice.status
  );

  if (
    status === "partially paid"
  ) {
    return "Medium";
  }

  if (
    status === "sent"
  ) {
    return "Low";
  }

  return "Not assessed";
}

function getInvoiceRecommendations({
  invoice,
  overdue,
  paid,
  recipientEmail,
  bankDetailsAvailable,
}) {
  const recommendations = [];

  if (paid) {
    recommendations.push(
      "No payment action is required. Keep the invoice for financial reporting and audit history."
    );
  } else if (overdue) {
    recommendations.push(
      "Send a payment reminder and confirm the expected payment date."
    );
  } else {
    recommendations.push(
      "Monitor the due date and follow up before the invoice becomes overdue."
    );
  }

  if (!recipientEmail) {
    recommendations.push(
      "Add a recipient email before sending the invoice."
    );
  }

  if (!invoice.due_date) {
    recommendations.push(
      "Add a due date so payment risk and overdue status can be tracked."
    );
  }

  if (!bankDetailsAvailable) {
    recommendations.push(
      "Add bank details in Company Settings before sending the invoice."
    );
  }

  if (
    normaliseStatus(
      invoice.status
    ) === "draft" ||
    normaliseStatus(
      invoice.status
    ) === "draft invoice"
  ) {
    recommendations.push(
      "Review the invoice and mark it as Sent after delivery to the customer."
    );
  }

  return recommendations.slice(
    0,
    5
  );
}

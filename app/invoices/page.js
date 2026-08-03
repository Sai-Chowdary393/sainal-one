"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatusBadge from "../../components/StatusBadge";
import styles from "./invoices.module.css";

const INITIAL_FORM_DATA = {
  client: "",
  service: "",
  subtotal: "",
  vat_rate: "0",
  due_date: "",
  payment_terms:
    "Payment due within 14 days of invoice date.",
};

const STATUS_OPTIONS = [
  "Draft Invoice",
  "Draft",
  "Sent",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [formData, setFormData] = useState(
    INITIAL_FORM_DATA
  );

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(
        window.location.search
      );

      if (searchParams.get("create") === "true") {
        setShowForm(true);

        window.history.replaceState(
          {},
          "",
          window.location.pathname
        );
      }
    } catch (error) {
      console.error(
        "Unable to read invoice page parameters:",
        error
      );
    }
  }, []);

  async function fetchInvoices() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/invoices", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load invoices."
        );
      }

      setInvoices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(
        "Invoice loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load the invoices."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  function openCreateForm() {
    setFormData(INITIAL_FORM_DATA);
    setShowForm(true);
  }

  function closeCreateForm() {
    setFormData(INITIAL_FORM_DATA);
    setShowForm(false);
  }

  const subtotalNumber = getMoneyValue(
    formData.subtotal
  );

  const vatRateNumber = getVatRate(
    formData.vat_rate
  );

  const vatAmountNumber =
    subtotalNumber * (vatRateNumber / 100);

  const totalAmountNumber =
    subtotalNumber + vatAmountNumber;

  async function createInvoice(event) {
    event.preventDefault();

    const cleanClient = formData.client.trim();
    const cleanService = formData.service.trim();

    if (
      !cleanClient ||
      !cleanService ||
      !formData.subtotal
    ) {
      alert(
        "Please enter client, service and subtotal."
      );

      return;
    }

    if (subtotalNumber < 0) {
      alert("Subtotal cannot be negative.");
      return;
    }

    if (
      vatRateNumber < 0 ||
      vatRateNumber > 100
    ) {
      alert(
        "VAT rate must be between 0 and 100."
      );

      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        "/api/invoices",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            customer_id: null,
            project_id: null,

            client: cleanClient,

            service: cleanService,

            amount: formatCurrency(
              totalAmountNumber
            ),

            subtotal: formatCurrency(
              subtotalNumber
            ),

            vat_rate: `${vatRateNumber}%`,

            vat_amount: formatCurrency(
              vatAmountNumber
            ),

            total_amount: formatCurrency(
              totalAmountNumber
            ),

            due_date:
              formData.due_date || null,

            payment_terms:
              formData.payment_terms.trim(),

            status: "Draft Invoice",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create invoice."
        );
      }

      const createdInvoice =
        Array.isArray(data)
          ? data[0]
          : data;

      if (createdInvoice) {
        setInvoices(
          (currentInvoices) => [
            createdInvoice,
            ...currentInvoices,
          ]
        );
      } else {
        await fetchInvoices();
      }

      closeCreateForm();

      alert(
        "Invoice created successfully."
      );
    } catch (error) {
      console.error(
        "Invoice creation error:",
        error
      );

      alert(
        error.message ||
          "Error creating invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredInvoices = useMemo(() => {
    const search = searchValue
      .trim()
      .toLowerCase();

    return invoices.filter((invoice) => {
      const matchesSearch =
        !search ||
        [
          invoice.invoice_number,
          invoice.client,
          invoice.service,
          invoice.status,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(search)
        );

      const matchesStatus =
        statusFilter === "All" ||
        normaliseStatus(invoice.status) ===
          normaliseStatus(statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [
    invoices,
    searchValue,
    statusFilter,
  ]);

  const totalInvoiced = invoices.reduce(
    (total, invoice) =>
      total +
      getMoneyValue(
        invoice.total_amount ||
          invoice.amount
      ),
    0
  );

  const totalPaid = invoices
    .filter(
      (invoice) =>
        normaliseStatus(
          invoice.status
        ) === "paid"
    )
    .reduce(
      (total, invoice) =>
        total +
        getMoneyValue(
          invoice.total_amount ||
            invoice.amount
        ),
      0
    );

  const totalOutstanding = invoices
    .filter((invoice) => {
      const status = normaliseStatus(
        invoice.status
      );

      return ![
        "paid",
        "cancelled",
      ].includes(status);
    })
    .reduce(
      (total, invoice) =>
        total +
        getMoneyValue(
          invoice.total_amount ||
            invoice.amount
        ),
      0
    );

  const overdueInvoices = invoices.filter(
    (invoice) => isInvoiceOverdue(invoice)
  );

  const overdueValue = overdueInvoices.reduce(
    (total, invoice) =>
      total +
      getMoneyValue(
        invoice.total_amount ||
          invoice.amount
      ),
    0
  );

  const filtersActive =
    Boolean(searchValue) ||
    statusFilter !== "All";

  function clearFilters() {
    setSearchValue("");
    setStatusFilter("All");
  }

  return (
    <ProtectedRoute>
      <AppLayout
        title="Invoices"
        description="Manage billing, payments and outstanding revenue."
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
                className={
                  styles.eyebrow
                }
              >
                Finance workspace
              </span>

              <h2>
                Invoice management
              </h2>

              <p>
                Create invoices, monitor
                payment status and identify
                overdue revenue. Full customer,
                payment and bank details remain
                inside each invoice workspace.
              </p>
            </div>

            <button
              type="button"
              className={
                styles.primaryButton
              }
              onClick={
                showForm
                  ? closeCreateForm
                  : openCreateForm
              }
            >
              <span>
                {showForm ? "×" : "+"}
              </span>

              {showForm
                ? "Close form"
                : "Create invoice"}
            </button>
          </section>

          {showForm && (
            <section
              className={
                styles.formPanel
              }
            >
              <div
                className={
                  styles.formHeading
                }
              >
                <div>
                  <h3>
                    Create a new invoice
                  </h3>

                  <p>
                    Enter billing information,
                    VAT and payment terms.
                  </p>
                </div>
              </div>

              <form
                className={
                  styles.invoiceForm
                }
                onSubmit={
                  createInvoice
                }
              >
                <div
                  className={
                    styles.formGrid
                  }
                >
                  <FormField
                    label="Client or company"
                    name="client"
                    value={
                      formData.client
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Example: Delta Services"
                    required
                  />

                  <FormField
                    label="Service"
                    name="service"
                    value={
                      formData.service
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Example: Business Automation"
                    required
                  />

                  <FormField
                    label="Subtotal"
                    name="subtotal"
                    value={
                      formData.subtotal
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Example: 3000"
                    required
                  />

                  <FormField
                    label="VAT rate"
                    name="vat_rate"
                    value={
                      formData.vat_rate
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Example: 20"
                  />

                  <FormField
                    label="Due date"
                    name="due_date"
                    type="date"
                    value={
                      formData.due_date
                    }
                    onChange={
                      handleChange
                    }
                  />

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
                      value={
                        formData.payment_terms
                      }
                      onChange={
                        handleChange
                      }
                      rows={4}
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
                    value={formatCurrency(
                      subtotalNumber
                    )}
                  />

                  <CalculationItem
                    label={`VAT (${vatRateNumber}%)`}
                    value={formatCurrency(
                      vatAmountNumber
                    )}
                  />

                  <CalculationItem
                    label="Invoice total"
                    value={formatCurrency(
                      totalAmountNumber
                    )}
                    total
                  />
                </div>

                <div
                  className={
                    styles.formActions
                  }
                >
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={
                      closeCreateForm
                    }
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={
                      styles.primaryButton
                    }
                    disabled={saving}
                  >
                    {saving
                      ? "Saving invoice..."
                      : "Save invoice"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              icon="£"
              label="Total invoiced"
              value={formatCurrency(
                totalInvoiced
              )}
              detail={`${invoices.length} invoice${
                invoices.length === 1
                  ? ""
                  : "s"
              }`}
              tone="gold"
            />

            <SummaryCard
              icon="✓"
              label="Paid"
              value={formatCurrency(
                totalPaid
              )}
              detail="Received revenue"
              tone="green"
            />

            <SummaryCard
              icon="◷"
              label="Outstanding"
              value={formatCurrency(
                totalOutstanding
              )}
              detail="Awaiting payment"
              tone="blue"
            />

            <SummaryCard
              icon="!"
              label="Overdue"
              value={formatCurrency(
                overdueValue
              )}
              detail={`${overdueInvoices.length} overdue invoice${
                overdueInvoices.length ===
                1
                  ? ""
                  : "s"
              }`}
              tone="red"
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
              <span aria-hidden="true">
                ⌕
              </span>

              <input
                type="search"
                placeholder="Search invoice number, client, service or status..."
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(
                    event.target.value
                  )
                }
                aria-label="Search invoices"
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
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                aria-label="Filter invoices by status"
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
              className={
                styles.errorPanel
              }
            >
              <div>
                <strong>
                  Unable to load invoices
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
                  fetchInvoices
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
                    Invoice records
                  </h3>

                  <p>
                    Bank details, recipient email
                    and the complete invoice
                    document are visible only
                    inside each invoice workspace.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {filteredInvoices.length}{" "}
                  result
                  {filteredInvoices.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredInvoices.length ===
              0 ? (
                <EmptyState
                  hasFilters={
                    filtersActive
                  }
                  onClearFilters={
                    clearFilters
                  }
                  onCreateInvoice={
                    openCreateForm
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
                      styles.invoiceTable
                    }
                  >
                    <thead>
                      <tr>
                        <th>
                          Invoice
                        </th>

                        <th>
                          Client
                        </th>

                        <th>
                          Service
                        </th>

                        <th>
                          Amount
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Due date
                        </th>

                        <th>
                          Created
                        </th>

                        <th
                          aria-label="Actions"
                        />
                      </tr>
                    </thead>

                    <tbody>
                      {filteredInvoices.map(
                        (invoice) => {
                          const overdue =
                            isInvoiceOverdue(
                              invoice
                            );

                          return (
                            <tr
                              key={
                                invoice.id
                              }
                            >
                              <td>
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
                                      styles.invoiceIdentityCopy
                                    }
                                  >
                                    <Link
                                      href={`/invoices/${invoice.id}`}
                                      className={
                                        styles.invoiceLink
                                      }
                                    >
                                      {invoice.invoice_number ||
                                        "Invoice"}
                                    </Link>

                                    <small>
                                      Open finance
                                      workspace
                                    </small>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <div
                                  className={
                                    styles.clientCell
                                  }
                                >
                                  <strong>
                                    {invoice.client ||
                                      "No client"}
                                  </strong>

                                  <small>
                                    {invoice.customer_id
                                      ? "Linked customer"
                                      : "Direct invoice"}
                                  </small>
                                </div>
                              </td>

                              <td>
                                <span
                                  className={
                                    styles.serviceText
                                  }
                                >
                                  {invoice.service ||
                                    "Not specified"}
                                </span>
                              </td>

                              <td>
                                <strong
                                  className={
                                    styles.amountText
                                  }
                                >
                                  {formatInvoiceAmount(
                                    invoice.total_amount ||
                                      invoice.amount
                                  )}
                                </strong>
                              </td>

                              <td>
                                <StatusBadge
                                  status={
                                    invoice.status ||
                                    "Draft Invoice"
                                  }
                                />
                              </td>

                              <td>
                                <span
                                  className={`${styles.dueDate} ${
                                    overdue
                                      ? styles.dueDateOverdue
                                      : ""
                                  }`}
                                >
                                  {formatDate(
                                    invoice.due_date
                                  )}
                                </span>

                                {overdue && (
                                  <span
                                    className={
                                      styles.overdueLabel
                                    }
                                  >
                                    Overdue
                                  </span>
                                )}
                              </td>

                              <td>
                                <span
                                  className={
                                    styles.createdDate
                                  }
                                >
                                  {formatDate(
                                    invoice.created_at
                                  )}
                                </span>
                              </td>

                              <td>
                                <Link
                                  href={`/invoices/${invoice.id}`}
                                  className={
                                    styles.openButton
                                  }
                                >
                                  Open
                                  <span>
                                    →
                                  </span>
                                </Link>
                              </td>
                            </tr>
                          );
                        }
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

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}) {
  return (
    <div className={styles.field}>
      <label
        htmlFor={`invoice-${name}`}
      >
        {label}
        {required ? " *" : ""}
      </label>

      <input
        id={`invoice-${name}`}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
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
          `summary${capitalise(tone)}`
        ] || ""
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
  hasFilters,
  onClearFilters,
  onCreateInvoice,
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
        £
      </span>

      <h3>
        {hasFilters
          ? "No matching invoices"
          : "No invoices yet"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current search and status filter."
          : "Create your first invoice to begin managing billing and payments."}
      </p>

      <button
        type="button"
        className={
          styles.primaryButton
        }
        onClick={
          hasFilters
            ? onClearFilters
            : onCreateInvoice
        }
      >
        {hasFilters
          ? "Clear filters"
          : "Create invoice"}
      </button>
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
        length: 5,
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

function normaliseStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getMoneyValue(value) {
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

function getVatRate(value) {
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

function formatInvoiceAmount(value) {
  if (!value) {
    return "£0.00";
  }

  return formatCurrency(
    getMoneyValue(value)
  );
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

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

  const dueDate = new Date(
    invoice.due_date
  );

  if (
    Number.isNaN(
      dueDate.getTime()
    )
  ) {
    return false;
  }

  dueDate.setHours(23, 59, 59, 999);

  return dueDate < new Date();
}

function capitalise(value) {
  const text = String(value || "");

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}

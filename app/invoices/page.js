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

const INITIAL_FORM_DATA = {
  client: "",
  service: "",
  subtotal: "",
  vat_rate: "20",
  due_date: "",
  payment_terms:
    "Payment due within 14 days of invoice date.",
  owner_employee_id: "",
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
  const [invoices, setInvoices] =
    useState([]);

  const [employees, setEmployees] =
    useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
  ] = useState(null);

  const [access, setAccess] =
    useState({
      isOwner: false,
      canViewAll: false,
      canViewTeam: false,
      canViewOwn: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canAssign: false,
      canSend: false,
      canApprove: false,
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [
    searchValue,
    setSearchValue,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("All");

  const [
    formData,
    setFormData,
  ] = useState(
    INITIAL_FORM_DATA
  );

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response =
        await fetch(
          "/api/invoices",
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
            "Failed to load invoices."
        );
      }

      const nextAccess = {
        isOwner:
          Boolean(
            data.access?.isOwner
          ),

        canViewAll:
          Boolean(
            data.access
              ?.canViewAll
          ),

        canViewTeam:
          Boolean(
            data.access
              ?.canViewTeam
          ),

        canViewOwn:
          Boolean(
            data.access
              ?.canViewOwn
          ),

        canCreate:
          Boolean(
            data.access
              ?.canCreate
          ),

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
      };

      setAccess(
        nextAccess
      );

      setInvoices(
        Array.isArray(
          data.invoices
        )
          ? data.invoices
          : []
      );

      setEmployees(
        Array.isArray(
          data.employees
        )
          ? data.employees
          : []
      );

      setCurrentEmployee(
        data.currentEmployee ||
          null
      );

      // Quick action
      try {
        const params =
          new URLSearchParams(
            window.location.search
          );

        if (
          params.get(
            "create"
          ) ===
            "true" &&
          nextAccess.canCreate
        ) {
          setFormData({
            ...INITIAL_FORM_DATA,

            owner_employee_id:
              nextAccess.canAssign
                ? data
                    .currentEmployee
                    ?.id ||
                  ""
                : "",
          });

          setShowForm(true);

          window.history.replaceState(
            {},
            "",
            window.location
              .pathname
          );
        }
      } catch {
        // Ignore URL helper errors.
      }
    } catch (error) {
      console.error(
        "Invoice loading error:",
        error
      );

      setInvoices([]);

      setErrorMessage(
        error.message ||
          "Unable to load invoices."
      );
    } finally {
      setLoading(false);
    }
  }

  // =======================================================
  // FORM
  // =======================================================

  function handleChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setFormData(
      (
        current
      ) => ({
        ...current,
        [name]: value,
      })
    );
  }

  function openForm() {
    if (
      !access.canCreate
    ) {
      return;
    }

    setFormData({
      ...INITIAL_FORM_DATA,

      owner_employee_id:
        access.canAssign
          ? currentEmployee?.id ||
            ""
          : "",
    });

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  function closeForm() {
    setFormData(
      INITIAL_FORM_DATA
    );

    setShowForm(false);
  }

  // =======================================================
  // CREATE
  // =======================================================

  async function createInvoice(
    event
  ) {
    event.preventDefault();

    if (
      !access.canCreate
    ) {
      alert(
        "You do not have permission to create invoices."
      );

      return;
    }

    const client =
      formData.client.trim();

    const service =
      formData.service.trim();

    if (
      !client ||
      !service
    ) {
      alert(
        "Client and service are required."
      );

      return;
    }

    const subtotal =
      getMoneyValue(
        formData.subtotal
      );

    if (
      subtotal <
      0
    ) {
      alert(
        "Subtotal cannot be negative."
      );

      return;
    }

    try {
      setSaving(true);

      const payload = {
        client,
        service,

        subtotal:
          formData.subtotal,

        vat_rate:
          formData.vat_rate,

        due_date:
          formData.due_date ||
          null,

        payment_terms:
          formData.payment_terms
            .trim(),

        status:
          "Draft Invoice",

        customer_id:
          null,

        project_id:
          null,

        quote_id:
          null,
      };

      if (
        access.canAssign &&
        formData
          .owner_employee_id
      ) {
        payload.owner_employee_id =
          formData.owner_employee_id;
      }

      const response =
        await fetch(
          "/api/invoices",
          {
            method:
              "POST",

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
            "Failed to create invoice."
        );
      }

      if (
        data.invoice
      ) {
        setInvoices(
          (
            current
          ) => [
            data.invoice,
            ...current,
          ]
        );
      } else {
        await loadInvoices();
      }

      closeForm();

      alert(
        data.message ||
          "Invoice created successfully."
      );
    } catch (error) {
      console.error(
        "Invoice creation error:",
        error
      );

      alert(
        error.message ||
          "Unable to create invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // FILTER
  // =======================================================

  const filteredInvoices =
    useMemo(
      () => {
        const search =
          searchValue
            .trim()
            .toLowerCase();

        return invoices.filter(
          (
            invoice
          ) => {
            const matchesSearch =
              !search ||
              [
                invoice.invoice_number,
                invoice.client,
                invoice.service,
                invoice.status,
                invoice.owner
                  ?.full_name,
              ].some(
                (
                  value
                ) =>
                  String(
                    value ||
                      ""
                  )
                    .toLowerCase()
                    .includes(
                      search
                    )
              );

            const matchesStatus =
              statusFilter ===
                "All" ||
              normaliseStatus(
                invoice.status
              ) ===
                normaliseStatus(
                  statusFilter
                );

            return (
              matchesSearch &&
              matchesStatus
            );
          }
        );
      },
      [
        invoices,
        searchValue,
        statusFilter,
      ]
    );

  // =======================================================
  // METRICS
  // =======================================================

  const totalValue =
    invoices.reduce(
      (
        total,
        invoice
      ) =>
        total +
        getInvoiceTotal(
          invoice
        ),
      0
    );

  const paidInvoices =
    invoices.filter(
      (
        invoice
      ) =>
        normaliseStatus(
          invoice.status
        ) === "paid"
    );

  const paidValue =
    paidInvoices.reduce(
      (
        total,
        invoice
      ) =>
        total +
        getInvoiceTotal(
          invoice
        ),
      0
    );

  const overdueInvoices =
    invoices.filter(
      (
        invoice
      ) =>
        normaliseStatus(
          invoice.status
        ) ===
        "overdue" ||
        (
          isOverdue(
            invoice.due_date
          ) &&
          ![
            "paid",
            "cancelled",
          ].includes(
            normaliseStatus(
              invoice.status
            )
          )
        )
    );

  const outstandingValue =
    invoices
      .filter(
        (
          invoice
        ) =>
          ![
            "paid",
            "cancelled",
          ].includes(
            normaliseStatus(
              invoice.status
            )
          )
      )
      .reduce(
        (
          total,
          invoice
        ) =>
          total +
          getInvoiceTotal(
            invoice
          ),
        0
      );

  const visibilityLabel =
    access.canViewAll
      ? "All organisation invoices"
      : access.canViewTeam
        ? "Team invoices"
        : access.canViewOwn
          ? "My invoices"
          : "Invoice access";

  const filtersActive =
    Boolean(
      searchValue
    ) ||
    statusFilter !==
      "All";

  function clearFilters() {
    setSearchValue("");
    setStatusFilter("All");
  }

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Invoices"
        description="Manage billing, payment status and customer invoices."
      >
        <div
          style={
            pageStyles.page
          }
        >
          {/* HEADER */}

          <section
            style={
              pageStyles.header
            }
          >
            <div>
              <span
                style={
                  pageStyles.eyebrow
                }
              >
                Finance workspace
              </span>

              <h2
                style={
                  pageStyles.heading
                }
              >
                Invoice management
              </h2>

              <p
                style={
                  pageStyles.description
                }
              >
                Create invoices,
                monitor payment
                status and maintain
                secure ownership of
                financial records.
              </p>
            </div>

            {access.canCreate && (
              <button
                type="button"
                style={
                  pageStyles.primaryButton
                }
                onClick={
                  showForm
                    ? closeForm
                    : openForm
                }
              >
                {showForm
                  ? "× Close form"
                  : "+ Create invoice"}
              </button>
            )}
          </section>

          {/* CREATE FORM */}

          {showForm &&
            access.canCreate && (
              <section
                style={
                  pageStyles.panel
                }
              >
                <div
                  style={
                    pageStyles.panelHeader
                  }
                >
                  <div>
                    <h3
                      style={
                        pageStyles.panelTitle
                      }
                    >
                      Create invoice
                    </h3>

                    <p
                      style={
                        pageStyles.panelDescription
                      }
                    >
                      Enter invoice
                      details and assign
                      an owner if
                      required.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={
                    createInvoice
                  }
                >
                  <div
                    style={
                      pageStyles.formGrid
                    }
                  >
                    <Field
                      label="Client"
                      name="client"
                      value={
                        formData.client
                      }
                      onChange={
                        handleChange
                      }
                      required
                    />

                    <Field
                      label="Service"
                      name="service"
                      value={
                        formData.service
                      }
                      onChange={
                        handleChange
                      }
                      required
                    />

                    <Field
                      label="Subtotal"
                      name="subtotal"
                      value={
                        formData.subtotal
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: 1000"
                    />

                    <Field
                      label="VAT rate (%)"
                      name="vat_rate"
                      type="number"
                      value={
                        formData.vat_rate
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <Field
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

                    {access.canAssign && (
                      <label
                        style={
                          pageStyles.field
                        }
                      >
                        <span
                          style={
                            pageStyles.label
                          }
                        >
                          Invoice owner
                        </span>

                        <select
                          name="owner_employee_id"
                          value={
                            formData.owner_employee_id
                          }
                          onChange={
                            handleChange
                          }
                          style={
                            pageStyles.input
                          }
                        >
                          <option value="">
                            Assign to me
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
                      style={{
                        ...pageStyles.field,
                        gridColumn:
                          "1 / -1",
                      }}
                    >
                      <span
                        style={
                          pageStyles.label
                        }
                      >
                        Payment terms
                      </span>

                      <textarea
                        name="payment_terms"
                        rows={4}
                        value={
                          formData.payment_terms
                        }
                        onChange={
                          handleChange
                        }
                        style={
                          pageStyles.textarea
                        }
                      />
                    </label>
                  </div>

                  <div
                    style={
                      pageStyles.actions
                    }
                  >
                    <button
                      type="button"
                      style={
                        pageStyles.secondaryButton
                      }
                      onClick={
                        closeForm
                      }
                      disabled={
                        saving
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      style={
                        pageStyles.primaryButton
                      }
                      disabled={
                        saving
                      }
                    >
                      {saving
                        ? "Creating..."
                        : "Create invoice"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          {/* SUMMARY */}

          <section
            style={
              pageStyles.summaryGrid
            }
          >
            <SummaryCard
              label="Invoices"
              value={
                invoices.length
              }
              description={
                visibilityLabel
              }
            />

            <SummaryCard
              label="Invoice value"
              value={
                formatCurrency(
                  totalValue
                )
              }
              description="Total invoice value"
            />

            <SummaryCard
              label="Paid"
              value={
                formatCurrency(
                  paidValue
                )
              }
              description={`${paidInvoices.length} paid invoice${
                paidInvoices.length ===
                1
                  ? ""
                  : "s"
              }`}
            />

            <SummaryCard
              label="Outstanding"
              value={
                formatCurrency(
                  outstandingValue
                )
              }
              description={`${overdueInvoices.length} overdue`}
            />
          </section>

          {/* TOOLBAR */}

          <section
            style={
              pageStyles.toolbar
            }
          >
            <div
              style={
                pageStyles.searchBox
              }
            >
              <span>
                ⌕
              </span>

              <input
                type="search"
                placeholder="Search invoice, client, owner or service..."
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
                style={
                  pageStyles.searchInput
                }
              />
            </div>

            <div
              style={
                pageStyles.toolbarActions
              }
            >
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
                style={
                  pageStyles.filter
                }
              >
                <option value="All">
                  All statuses
                </option>

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
                      {item}
                    </option>
                  )
                )}
              </select>

              {filtersActive && (
                <button
                  type="button"
                  style={
                    pageStyles.secondaryButton
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

          {/* CONTENT */}

          {loading ? (
            <LoadingState />
          ) : errorMessage ? (
            <section
              style={
                pageStyles.error
              }
            >
              <div>
                <strong>
                  Unable to load
                  invoices
                </strong>

                <p>
                  {errorMessage}
                </p>
              </div>

              <button
                type="button"
                style={
                  pageStyles.secondaryButton
                }
                onClick={
                  loadInvoices
                }
              >
                Try again
              </button>
            </section>
          ) : (
            <section
              style={
                pageStyles.panel
              }
            >
              <div
                style={
                  pageStyles.tableHeader
                }
              >
                <div>
                  <h3
                    style={
                      pageStyles.panelTitle
                    }
                  >
                    Invoice records
                  </h3>

                  <p
                    style={
                      pageStyles.panelDescription
                    }
                  >
                    Open an invoice to
                    review billing,
                    payment terms and
                    document details.
                  </p>
                </div>

                <span
                  style={
                    pageStyles.resultCount
                  }
                >
                  {
                    filteredInvoices.length
                  }{" "}
                  result
                  {filteredInvoices.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredInvoices.length ===
              0 ? (
                <div
                  style={
                    pageStyles.empty
                  }
                >
                  <span
                    style={
                      pageStyles.emptyIcon
                    }
                  >
                    £
                  </span>

                  <h3>
                    No invoices
                    found
                  </h3>

                  <p>
                    {filtersActive
                      ? "Try clearing the current filters."
                      : access.canCreate
                        ? "Create your first invoice to begin tracking customer billing."
                        : "There are no invoices available within your current access."}
                  </p>

                  {filtersActive ? (
                    <button
                      type="button"
                      style={
                        pageStyles.primaryButton
                      }
                      onClick={
                        clearFilters
                      }
                    >
                      Clear filters
                    </button>
                  ) : access.canCreate ? (
                    <button
                      type="button"
                      style={
                        pageStyles.primaryButton
                      }
                      onClick={
                        openForm
                      }
                    >
                      Create invoice
                    </button>
                  ) : null}
                </div>
              ) : (
                <div
                  style={
                    pageStyles.tableWrapper
                  }
                >
                  <table
                    style={
                      pageStyles.table
                    }
                  >
                    <thead>
                      <tr>
                        <TableHead>
                          Invoice
                        </TableHead>

                        <TableHead>
                          Client
                        </TableHead>

                        <TableHead>
                          Owner
                        </TableHead>

                        <TableHead>
                          Service
                        </TableHead>

                        <TableHead>
                          Total
                        </TableHead>

                        <TableHead>
                          Due
                        </TableHead>

                        <TableHead>
                          Status
                        </TableHead>

                        <TableHead>
                          Created
                        </TableHead>

                        <TableHead />
                      </tr>
                    </thead>

                    <tbody>
                      {filteredInvoices.map(
                        (
                          invoice
                        ) => (
                          <tr
                            key={
                              invoice.id
                            }
                          >
                            <TableCell>
                              <div
                                style={
                                  pageStyles.identity
                                }
                              >
                                <span
                                  style={
                                    pageStyles.invoiceIcon
                                  }
                                >
                                  £
                                </span>

                                <div>
                                  <Link
                                    href={`/invoices/${invoice.id}`}
                                    style={
                                      pageStyles.recordLink
                                    }
                                  >
                                    {invoice.invoice_number ||
                                      "Invoice"}
                                  </Link>

                                  <small
                                    style={
                                      pageStyles.smallText
                                    }
                                  >
                                    Billing record
                                  </small>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              {
                                invoice.client ||
                                "No client"
                              }
                            </TableCell>

                            <TableCell>
                              {invoice.owner
                                ?.full_name ||
                                "Unassigned"}
                            </TableCell>

                            <TableCell>
                              {invoice.service ||
                                "Not specified"}
                            </TableCell>

                            <TableCell>
                              <strong>
                                {formatInvoiceAmount(
                                  invoice
                                )}
                              </strong>
                            </TableCell>

                            <TableCell>
                              {formatDate(
                                invoice.due_date
                              )}
                            </TableCell>

                            <TableCell>
                              <StatusBadge
                                status={
                                  getDisplayStatus(
                                    invoice
                                  )
                                }
                              />
                            </TableCell>

                            <TableCell>
                              {formatDate(
                                invoice.created_at
                              )}
                            </TableCell>

                            <TableCell>
                              <Link
                                href={`/invoices/${invoice.id}`}
                                style={
                                  pageStyles.openButton
                                }
                              >
                                Open →
                              </Link>
                            </TableCell>
                          </tr>
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

// =========================================================
// COMPONENTS
// =========================================================

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
}) {
  return (
    <label
      style={
        pageStyles.field
      }
    >
      <span
        style={
          pageStyles.label
        }
      >
        {label}
        {required
          ? " *"
          : ""}
      </span>

      <input
        name={
          name
        }
        type={
          type
        }
        value={
          value
        }
        onChange={
          onChange
        }
        placeholder={
          placeholder
        }
        required={
          required
        }
        style={
          pageStyles.input
        }
      />
    </label>
  );
}

function SummaryCard({
  label,
  value,
  description,
}) {
  return (
    <article
      style={
        pageStyles.summaryCard
      }
    >
      <span
        style={
          pageStyles.summaryLabel
        }
      >
        {label}
      </span>

      <strong
        style={
          pageStyles.summaryValue
        }
      >
        {value}
      </strong>

      <small
        style={
          pageStyles.summaryDescription
        }
      >
        {description}
      </small>
    </article>
  );
}

function TableHead({
  children,
}) {
  return (
    <th
      style={
        pageStyles.th
      }
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
}) {
  return (
    <td
      style={
        pageStyles.td
      }
    >
      {children}
    </td>
  );
}

function LoadingState() {
  return (
    <section
      style={
        pageStyles.loading
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
              pageStyles.loadingRow
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
  const parsed =
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
    parsed
  )
    ? parsed
    : 0;
}

function getInvoiceTotal(
  invoice
) {
  return getMoneyValue(
    invoice.total_amount ||
      invoice.amount ||
      invoice.subtotal
  );
}

function formatCurrency(
  value
) {
  return Number(
    value ||
      0
  ).toLocaleString(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  );
}

function formatInvoiceAmount(
  invoice
) {
  const value =
    invoice.total_amount ||
    invoice.amount ||
    invoice.subtotal;

  if (!value) {
    return "£0.00";
  }

  if (
    String(
      value
    ).includes("£")
  ) {
    return value;
  }

  return formatCurrency(
    getMoneyValue(
      value
    )
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "Not set";
  }

  const date =
    new Date(value);

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

function isOverdue(
  value
) {
  if (!value) {
    return false;
  }

  const date =
    new Date(value);

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
    ].includes(status) &&
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

const pageStyles = {
  page: {
    display: "grid",
    gap: "20px",
    color: "#24221d",
    fontSize: "13px",
  },

  header: {
    display: "flex",
    alignItems:
      "flex-start",
    justifyContent:
      "space-between",
    gap: "24px",
  },

  eyebrow: {
    display: "block",
    marginBottom: "7px",
    color: "#a17800",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1px",
    textTransform:
      "uppercase",
  },

  heading: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.15,
  },

  description: {
    maxWidth: "720px",
    margin: "8px 0 0",
    color: "#7c786e",
    fontSize: "13px",
    lineHeight: 1.6,
  },

  panel: {
    overflow: "hidden",
    border:
      "1px solid #dedbd2",
    borderRadius: "16px",
    background: "#ffffff",
  },

  panelHeader: {
    padding: "20px 22px",
    borderBottom:
      "1px solid #ece9e2",
  },

  panelTitle: {
    margin: 0,
    fontSize: "17px",
  },

  panelDescription: {
    margin: "5px 0 0",
    color: "#89857b",
    fontSize: "12px",
  },

  primaryButton: {
    minHeight: "40px",
    padding: "0 16px",
    border:
      "1px solid #b98700",
    borderRadius: "10px",
    background: "#dda900",
    color: "#17130a",
    fontSize: "12px",
    fontWeight: 750,
    cursor: "pointer",
  },

  secondaryButton: {
    minHeight: "40px",
    padding: "0 15px",
    border:
      "1px solid #dedbd2",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#403d36",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "16px",
    padding: "22px",
  },

  field: {
    display: "grid",
    gap: "7px",
  },

  label: {
    color: "#39362f",
    fontSize: "12px",
    fontWeight: 750,
  },

  input: {
    width: "100%",
    minHeight: "42px",
    padding: "0 12px",
    border:
      "1px solid #dcd8ce",
    borderRadius: "9px",
    outline: 0,
    background: "#ffffff",
    color: "#292722",
    fontSize: "13px",
  },

  textarea: {
    width: "100%",
    padding: "11px 12px",
    border:
      "1px solid #dcd8ce",
    borderRadius: "9px",
    outline: 0,
    resize: "vertical",
    fontFamily: "inherit",
    fontSize: "13px",
  },

  actions: {
    display: "flex",
    justifyContent:
      "flex-end",
    gap: "10px",
    padding: "0 22px 22px",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "14px",
  },

  summaryCard: {
    display: "grid",
    gap: "8px",
    minHeight: "132px",
    padding: "18px",
    border:
      "1px solid #dedbd2",
    borderRadius: "15px",
    background: "#ffffff",
  },

  summaryLabel: {
    color: "#756f64",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing:
      ".7px",
    textTransform:
      "uppercase",
  },

  summaryValue: {
    fontSize: "25px",
  },

  summaryDescription: {
    marginTop: "auto",
    color: "#938e84",
    fontSize: "11px",
  },

  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: "16px",
    padding: "12px",
    border:
      "1px solid #dedbd2",
    borderRadius: "14px",
    background: "#ffffff",
  },

  searchBox: {
    display: "flex",
    width: "480px",
    maxWidth: "100%",
    minHeight: "42px",
    alignItems: "center",
    gap: "8px",
    padding: "0 12px",
    border:
      "1px solid #dedbd2",
    borderRadius: "10px",
  },

  searchInput: {
    width: "100%",
    border: 0,
    outline: 0,
    fontSize: "13px",
  },

  toolbarActions: {
    display: "flex",
    gap: "10px",
  },

  filter: {
    minHeight: "42px",
    padding: "0 12px",
    border:
      "1px solid #dedbd2",
    borderRadius: "10px",
    background: "#ffffff",
    fontSize: "12px",
  },

  tableHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: "20px",
    padding: "18px 20px",
    borderBottom:
      "1px solid #ece9e2",
  },

  resultCount: {
    padding: "5px 9px",
    borderRadius: "999px",
    background: "#f7efd2",
    color: "#8a6500",
    fontSize: "10px",
    fontWeight: 800,
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse:
      "collapse",
  },

  th: {
    padding: "12px 15px",
    borderBottom:
      "1px solid #ebe8e0",
    color: "#827d72",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing:
      ".6px",
    textAlign: "left",
    textTransform:
      "uppercase",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "14px 15px",
    borderBottom:
      "1px solid #efede7",
    color: "#444039",
    fontSize: "12px",
    verticalAlign:
      "middle",
    whiteSpace: "nowrap",
  },

  identity: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  invoiceIcon: {
    display: "grid",
    width: "34px",
    height: "34px",
    placeItems: "center",
    borderRadius: "9px",
    background: "#29271f",
    color: "#e2b83a",
    fontWeight: 800,
  },

  recordLink: {
    color: "#7f5e00",
    fontWeight: 800,
    textDecoration: "none",
  },

  smallText: {
    display: "block",
    marginTop: "3px",
    color: "#9a958b",
    fontSize: "10px",
  },

  openButton: {
    display:
      "inline-flex",
    minHeight: "34px",
    alignItems: "center",
    padding: "0 11px",
    border:
      "1px solid #ded8c6",
    borderRadius: "9px",
    background: "#fffdf6",
    color: "#8a6500",
    fontSize: "11px",
    fontWeight: 800,
    textDecoration: "none",
  },

  error: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: "20px",
    padding: "20px",
    border:
      "1px solid #efcaca",
    borderRadius: "14px",
    background: "#fff7f7",
    color: "#9d3939",
  },

  empty: {
    display: "grid",
    minHeight: "300px",
    placeItems: "center",
    alignContent: "center",
    gap: "10px",
    padding: "30px",
    textAlign: "center",
  },

  emptyIcon: {
    display: "grid",
    width: "52px",
    height: "52px",
    placeItems: "center",
    borderRadius: "14px",
    background: "#f4ebca",
    color: "#947000",
    fontSize: "20px",
    fontWeight: 800,
  },

  loading: {
    display: "grid",
    gap: "10px",
  },

  loadingRow: {
    height: "70px",
    borderRadius: "12px",
    background: "#eeece6",
  },
};

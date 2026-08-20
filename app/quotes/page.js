"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import AppLayout from "../../components/layout/AppLayout";
import StatusBadge from "../../components/StatusBadge";
import ProtectedRoute from "../../components/ProtectedRoute";

import styles from "./quotes.module.css";

// =========================================================
// FORM
// =========================================================

const INITIAL_FORM_DATA = {
  quote_number: "",
  client: "",
  contact: "",
  email: "",
  phone: "",
  service: "",
  amount: "",
  quote_text: "",
  owner_employee_id: "",
};

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

export default function QuotesPage() {
  const [
    quotes,
    setQuotes,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
  ] = useState(null);

  const [
    access,
    setAccess,
  ] = useState({
    isOwner: false,
    canViewAll: false,
    canViewTeam: false,
    canViewOwn: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canSend: false,
    canApprove: false,
    canAssign: false,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

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
    fetchQuotes();
  }, []);

  async function fetchQuotes() {
    try {
      setLoading(true);
      setErrorMessage("");

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

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to load quotes."
        );
      }

      setQuotes(
        Array.isArray(
          data.quotes
        )
          ? data.quotes
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

      const nextAccess = {
        isOwner:
          Boolean(
            data.access
              ?.isOwner
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

        canAssign:
          Boolean(
            data.access
              ?.canAssign
          ),
      };

      setAccess(
        nextAccess
      );

      // ===================================================
      // ?create=true
      // ===================================================

      const searchParams =
        new URLSearchParams(
          window.location.search
        );

      if (
        searchParams.get(
          "create"
        ) ===
          "true" &&
        nextAccess.canCreate
      ) {
        setFormData({
          ...INITIAL_FORM_DATA,

          owner_employee_id:
            nextAccess.canAssign
              ? data.currentEmployee
                  ?.id ||
                ""
              : "",
        });

        setShowForm(true);

        window.history.replaceState(
          {},
          "",
          window.location.pathname
        );
      }
    } catch (error) {
      console.error(
        "Quote loading error:",
        error
      );

      setQuotes([]);

      setErrorMessage(
        error.message ||
          "We could not load the quotes."
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
        currentData
      ) => ({
        ...currentData,

        [name]:
          value,
      })
    );
  }

  function openCreateForm() {
    if (
      !access.canCreate
    ) {
      return;
    }

    setFormData({
      ...INITIAL_FORM_DATA,

      owner_employee_id:
        access.canAssign
          ? currentEmployee
              ?.id ||
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

  function closeCreateForm() {
    setFormData(
      INITIAL_FORM_DATA
    );

    setShowForm(false);
  }

  // =======================================================
  // CREATE
  // =======================================================

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      !access.canCreate
    ) {
      alert(
        "You do not have permission to create quotes."
      );

      return;
    }

    const cleanClient =
      formData.client.trim();

    if (
      !cleanClient
    ) {
      alert(
        "Please enter the client or company name."
      );

      return;
    }

    try {
      setSaving(true);

      const quoteNumber =
        formData.quote_number.trim() ||
        generateQuoteNumber();

      const quoteText =
        formData.quote_text.trim() ||
        buildQuoteText({
          ...formData,

          quote_number:
            quoteNumber,
        });

      const payload = {
        quote_number:
          quoteNumber,

        client:
          cleanClient,

        contact:
          formData.contact.trim(),

        email:
          formData.email.trim(),

        phone:
          formData.phone.trim(),

        service:
          formData.service.trim(),

        amount:
          formData.amount.trim(),

        quote_text:
          quoteText,

        status:
          "Draft",

        customer_id:
          null,

        lead_id:
          null,
      };

      if (
        access.canAssign &&
        formData.owner_employee_id
      ) {
        payload.owner_employee_id =
          formData.owner_employee_id;
      }

      const response =
        await fetch(
          "/api/quotes",
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

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to create quote."
        );
      }

      if (
        data.quote
      ) {
        setQuotes(
          (
            currentQuotes
          ) => [
            data.quote,
            ...currentQuotes,
          ]
        );
      } else {
        await fetchQuotes();
      }

      closeCreateForm();

      alert(
        data.message ||
          "Quote created successfully."
      );
    } catch (error) {
      console.error(
        "Quote creation error:",
        error
      );

      alert(
        error.message ||
          "Error creating quote."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // FILTER
  // =======================================================

  const filteredQuotes =
    useMemo(
      () => {
        const search =
          searchValue
            .trim()
            .toLowerCase();

        return quotes.filter(
          (
            quote
          ) => {
            const matchesSearch =
              !search ||
              [
                quote.quote_number,
                quote.client,
                quote.contact,
                quote.service,
                quote.status,
                quote.owner
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
                quote.status
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
        quotes,
        searchValue,
        statusFilter,
      ]
    );

  // =======================================================
  // SUMMARY
  // =======================================================

  const draftQuotes =
    quotes.filter(
      (
        quote
      ) =>
        normaliseStatus(
          quote.status
        ) ===
        "draft"
    ).length;

  const pendingApprovalQuotes =
    quotes.filter(
      (
        quote
      ) =>
        normaliseStatus(
          quote.status
        ) ===
        "pending approval"
    ).length;

  const approvedQuotes =
    quotes.filter(
      (
        quote
      ) =>
        normaliseStatus(
          quote.status
        ) ===
        "approved"
    ).length;

  const acceptedQuotes =
    quotes.filter(
      (
        quote
      ) =>
        normaliseStatus(
          quote.status
        ) ===
        "accepted"
    ).length;

  const pipelineValue =
    quotes
      .filter(
        (
          quote
        ) =>
          ![
            "rejected",
            "expired",
          ].includes(
            normaliseStatus(
              quote.status
            )
          )
      )
      .reduce(
        (
          total,
          quote
        ) =>
          total +
          getMoneyValue(
            quote.amount
          ),
        0
      );

  function clearFilters() {
    setSearchValue("");
    setStatusFilter("All");
  }

  const visibilityLabel =
    access.canViewAll
      ? "All organisation quotes"
      : access.canViewTeam
        ? "Team quotes"
        : access.canViewOwn
          ? "My quotes"
          : "Quote access";

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Quotes"
        description="Manage quotations, pricing and customer approvals."
      >
        <div
          className={
            styles.page
          }
        >
          {/* =================================================
              HEADER
          ================================================= */}

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
                Sales workspace
              </span>

              <h2>
                Quote pipeline
              </h2>

              <p>
                Prepare and track
                commercial quotations
                through drafting,
                internal approval and
                customer acceptance.
              </p>
            </div>

            {access.canCreate && (
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
                  {showForm
                    ? "×"
                    : "+"}
                </span>

                {showForm
                  ? "Close form"
                  : "Create quote"}
              </button>
            )}
          </section>

          {/* =================================================
              CREATE
          ================================================= */}

          {showForm &&
            access.canCreate && (
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
                      Create quote
                    </h3>

                    <p>
                      Build a quotation and
                      optionally assign an
                      owner.
                    </p>
                  </div>
                </div>

                <form
                  className={
                    styles.quoteForm
                  }
                  onSubmit={
                    handleSubmit
                  }
                >
                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <FormField
                      label="Quote number"
                      name="quote_number"
                      value={
                        formData.quote_number
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Generated automatically if blank"
                    />

                    <FormField
                      label="Client / company"
                      name="client"
                      value={
                        formData.client
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: NorthStar Logistics"
                      required
                    />

                    <FormField
                      label="Contact"
                      name="contact"
                      value={
                        formData.contact
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Customer contact"
                    />

                    <FormField
                      label="Email"
                      name="email"
                      type="email"
                      value={
                        formData.email
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="name@company.com"
                    />

                    <FormField
                      label="Phone"
                      name="phone"
                      type="tel"
                      value={
                        formData.phone
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Telephone number"
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
                      placeholder="Service or solution"
                    />

                    <FormField
                      label="Amount"
                      name="amount"
                      value={
                        formData.amount
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: £5,000"
                    />

                    {access.canAssign && (
                      <div
                        className={
                          styles.field
                        }
                      >
                        <label
                          htmlFor="quote-owner"
                        >
                          Quote owner
                        </label>

                        <select
                          id="quote-owner"
                          name="owner_employee_id"
                          value={
                            formData.owner_employee_id
                          }
                          onChange={
                            handleChange
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
                      </div>
                    )}

                    <FormField
                      label="Quote text"
                      name="quote_text"
                      value={
                        formData.quote_text
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Optional custom quotation text"
                      textarea
                      rows={8}
                      fullWidth
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
                      disabled={
                        saving
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
                        saving
                      }
                    >
                      {saving
                        ? "Creating quote..."
                        : "Create quote"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          {/* =================================================
              SUMMARY
          ================================================= */}

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              icon="◇"
              label="Quotes"
              value={
                quotes.length
              }
              detail={
                visibilityLabel
              }
              tone="gold"
            />

            <SummaryCard
              icon="✎"
              label="Draft"
              value={
                draftQuotes
              }
              detail="Quotes being prepared"
              tone="blue"
            />

            <SummaryCard
              icon="◷"
              label="Pending approval"
              value={
                pendingApprovalQuotes
              }
              detail="Awaiting internal approval"
              tone="purple"
            />

            <SummaryCard
              icon="✓"
              label="Accepted"
              value={
                acceptedQuotes
              }
              detail={`${approvedQuotes} approved`}
              tone="green"
            />
          </section>

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              icon="£"
              label="Pipeline value"
              value={
                formatCurrency(
                  pipelineValue
                )
              }
              detail="Excludes rejected and expired quotes"
              tone="gold"
            />
          </section>

          {/* =================================================
              FILTERS
          ================================================= */}

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
              <span>
                ⌕
              </span>

              <input
                type="search"
                placeholder="Search quote, client, owner or service..."
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

              {(searchValue ||
                statusFilter !==
                  "All") && (
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

          {/* =================================================
              CONTENT
          ================================================= */}

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
                  Unable to load quotes
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
                  fetchQuotes
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
                    Quote records
                  </h3>

                  <p>
                    Review quotation status,
                    ownership and commercial
                    value.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {
                    filteredQuotes.length
                  }{" "}
                  result
                  {filteredQuotes.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredQuotes.length ===
              0 ? (
                <EmptyState
                  hasFilters={
                    Boolean(
                      searchValue
                    ) ||
                    statusFilter !==
                      "All"
                  }
                  canCreate={
                    access.canCreate
                  }
                  onClearFilters={
                    clearFilters
                  }
                  onCreate={
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
                      styles.quoteTable
                    }
                  >
                    <thead>
                      <tr>
                        <th>
                          Quote
                        </th>

                        <th>
                          Client
                        </th>

                        <th>
                          Owner
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
                          Created
                        </th>

                        <th
                          aria-label="Actions"
                        />
                      </tr>
                    </thead>

                    <tbody>
                      {filteredQuotes.map(
                        (
                          quote
                        ) => (
                          <tr
                            key={
                              quote.id
                            }
                          >
                            <td>
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
                                  <Link
                                    href={`/quotes/${quote.id}`}
                                    className={
                                      styles.quoteLink
                                    }
                                  >
                                    {quote.quote_number ||
                                      "Quote"}
                                  </Link>

                                  <small>
                                    {quote.contact ||
                                      "No contact"}
                                  </small>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span
                                className={
                                  styles.clientCell
                                }
                              >
                                {quote.client ||
                                  "No client"}
                              </span>
                            </td>

                            <td>
                              <span
                                className={
                                  styles.clientCell
                                }
                              >
                                {quote.owner
                                  ?.full_name ||
                                  "Unassigned"}
                              </span>
                            </td>

                            <td>
                              <span
                                className={
                                  styles.serviceText
                                }
                              >
                                {quote.service ||
                                  "Not specified"}
                              </span>
                            </td>

                            <td>
                              <strong
                                className={
                                  styles.amountText
                                }
                              >
                                {formatQuoteAmount(
                                  quote.amount
                                )}
                              </strong>
                            </td>

                            <td>
                              <StatusBadge
                                status={
                                  quote.status ||
                                  "Draft"
                                }
                              />
                            </td>

                            <td>
                              <span
                                className={
                                  styles.createdDate
                                }
                              >
                                {formatDate(
                                  quote.created_at
                                )}
                              </span>
                            </td>

                            <td>
                              <Link
                                href={`/quotes/${quote.id}`}
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
// FIELD
// =========================================================

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  textarea = false,
  rows = 4,
  required = false,
  fullWidth = false,
}) {
  return (
    <label
      className={`${styles.field} ${
        fullWidth
          ? styles.fieldFull
          : ""
      }`}
    >
      <span>
        {label}
        {required
          ? " *"
          : ""}
      </span>

      {textarea ? (
        <textarea
          name={
            name
          }
          rows={
            rows
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
        />
      ) : (
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
        />
      )}
    </label>
  );
}

// =========================================================
// SUMMARY
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
          `summary${capitalise(
            tone
          )}`
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

// =========================================================
// EMPTY
// =========================================================

function EmptyState({
  hasFilters,
  canCreate,
  onClearFilters,
  onCreate,
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
        ◇
      </span>

      <h3>
        {hasFilters
          ? "No matching quotes"
          : "No quotes found"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current filters."
          : canCreate
            ? "Create your first quotation to begin the sales process."
            : "There are no quote records available within your current access."}
      </p>

      {hasFilters ? (
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
      ) : canCreate ? (
        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={
            onCreate
          }
        >
          Create quote
        </button>
      ) : null}
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

function generateQuoteNumber() {
  return `SNQ-${Date.now()
    .toString()
    .slice(-6)}`;
}

function buildQuoteText(
  quote
) {
  return `SAINAL TECHNOLOGIES LTD

QUOTE

Quote Number: ${quote.quote_number || ""}
Date: ${new Date().toLocaleDateString("en-GB")}

Client:
${quote.client || ""}
${quote.contact || ""}
${quote.email || ""}
${quote.phone || ""}

Service:
${quote.service || "To be confirmed"}

Estimated Cost:
${quote.amount || "To be confirmed"}

Prepared By:
SaiNal Technologies Ltd`;
}

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

      maximumFractionDigits:
        0,
    }
  );
}

function formatQuoteAmount(
  value
) {
  if (
    !value
  ) {
    return "Not set";
  }

  if (
    String(
      value
    ).includes(
      "£"
    )
  ) {
    return value;
  }

  const amount =
    getMoneyValue(
      value
    );

  return amount
    ? formatCurrency(
        amount
      )
    : value;
}

function formatDate(
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

function capitalise(
  value
) {
  const text =
    String(
      value ||
        ""
    );

  return (
    text
      .charAt(0)
      .toUpperCase() +
    text.slice(1)
  );
}

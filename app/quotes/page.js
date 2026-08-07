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

const INITIAL_FORM_DATA = {
  quote_number: "",
  client: "",
  contact: "",
  email: "",
  phone: "",
  service: "",
  amount: "",
  status: "Draft",
  quote_text: "",
};

const STATUS_OPTIONS = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Rejected",
  "Accepted",
  "Sent",
  "Expired",
  "Draft Quote",
];

export default function QuotesPage() {
  const [quotes, setQuotes] =
    useState([]);

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
    createInitialFormData()
  );

  useEffect(() => {
    fetchQuotes();
  }, []);

  useEffect(() => {
    try {
      const searchParams =
        new URLSearchParams(
          window.location.search
        );

      if (
        searchParams.get(
          "create"
        ) === "true"
      ) {
        setShowForm(true);

        window.history.replaceState(
          {},
          "",
          window.location.pathname
        );
      }
    } catch (error) {
      console.error(
        "Unable to read quote page parameters:",
        error
      );
    }
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

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load quotes."
        );
      }

      setQuotes(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(
        "Quote loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load the quotes."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(
    event
  ) {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (currentData) => ({
        ...currentData,

        [name]:
          value,
      })
    );
  }

  function openCreateForm() {
    setFormData(
      createInitialFormData()
    );

    setShowForm(true);
  }

  function closeCreateForm() {
    setFormData(
      createInitialFormData()
    );

    setShowForm(false);
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    const cleanClient =
      formData.client.trim();

    const cleanContact =
      formData.contact.trim();

    if (!cleanClient) {
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
              JSON.stringify({
                quote_number:
                  quoteNumber,

                client:
                  cleanClient,

                contact:
                  cleanContact,

                email:
                  formData.email.trim(),

                phone:
                  formData.phone.trim(),

                service:
                  formData.service.trim(),

                amount:
                  formData.amount.trim(),

                /*
                 * Backend always creates
                 * new quotations as Draft.
                 */
                status:
                  "Draft",

                quote_text:
                  quoteText,

                customer_id:
                  null,

                lead_id:
                  null,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create quote."
        );
      }

      const createdQuote =
        Array.isArray(data)
          ? data[0]
          : data;

      if (createdQuote) {
        setQuotes(
          (
            currentQuotes
          ) => [
            createdQuote,
            ...currentQuotes,
          ]
        );
      } else {
        await fetchQuotes();
      }

      closeCreateForm();
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

  const filteredQuotes =
    useMemo(() => {
      const search =
        searchValue
          .trim()
          .toLowerCase();

      return quotes.filter(
        (quote) => {
          const matchesSearch =
            !search ||
            [
              quote.quote_number,
              quote.client,
              quote.contact,
              quote.service,
              quote.status,
            ].some(
              (value) =>
                String(
                  value || ""
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
    }, [
      quotes,
      searchValue,
      statusFilter,
    ]);

  const draftQuotes =
    quotes.filter(
      (quote) =>
        [
          "draft",
          "draft quote",
        ].includes(
          normaliseStatus(
            quote.status
          )
        )
    ).length;

  const pendingApprovalQuotes =
    quotes.filter(
      (quote) =>
        normaliseStatus(
          quote.status
        ) ===
        "pending approval"
    ).length;

  const approvedQuotes =
    quotes.filter(
      (quote) =>
        normaliseStatus(
          quote.status
        ) ===
        "approved"
    ).length;

  const acceptedQuotes =
    quotes.filter(
      (quote) =>
        normaliseStatus(
          quote.status
        ) ===
        "accepted"
    ).length;

  const pipelineValue =
    quotes
      .filter((quote) => {
        const status =
          normaliseStatus(
            quote.status
          );

        return (
          status !==
            "rejected" &&
          status !==
            "expired"
        );
      })
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

  const filtersActive =
    Boolean(
      searchValue
    ) ||
    statusFilter !==
      "All";

  function clearFilters() {
    setSearchValue("");

    setStatusFilter(
      "All"
    );
  }

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
          {/* HEADER */}

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
          </section>

          {/* CREATE FORM */}

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
                    Create a new quote
                  </h3>

                  <p>
                    New quotations
                    begin as Draft and
                    can then be submitted
                    through the configured
                    approval workflow.
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
                    placeholder="Automatically generated if empty"
                  />

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
                    label="Primary contact"
                    name="contact"
                    value={
                      formData.contact
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Example: Robert Smith"
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
                    placeholder="contact@company.com"
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
                    placeholder="Example: Business Automation"
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
                    placeholder="Example: £3,000"
                  />

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label
                      htmlFor="quote-status"
                    >
                      Status
                    </label>

                    <select
                      id="quote-status"
                      name="status"
                      value="Draft"
                      disabled
                    >
                      <option value="Draft">
                        Draft
                      </option>
                    </select>
                  </div>

                  <div
                    className={`${styles.field} ${styles.fieldFull}`}
                  >
                    <label
                      htmlFor="quote-text"
                    >
                      Quote text
                    </label>

                    <textarea
                      id="quote-text"
                      name="quote_text"
                      value={
                        formData.quote_text
                      }
                      onChange={
                        handleChange
                      }
                      rows={10}
                      placeholder="Leave empty to generate a standard quote document automatically."
                    />
                  </div>
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
                      ? "Saving quote..."
                      : "Save draft"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* SUMMARY */}

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              icon="◇"
              label="Total quotes"
              value={
                quotes.length
              }
              detail="All quotation records"
              tone="gold"
            />

            <SummaryCard
              icon="▤"
              label="Draft"
              value={
                draftQuotes
              }
              detail="Still being prepared"
              tone="blue"
            />

            <SummaryCard
              icon="◷"
              label="Pending approval"
              value={
                pendingApprovalQuotes
              }
              detail={`${approvedQuotes} internally approved`}
              tone="purple"
            />

            <SummaryCard
              icon="£"
              label="Active pipeline"
              value={formatCurrency(
                pipelineValue
              )}
              detail={`${acceptedQuotes} accepted quotes`}
              tone="green"
            />
          </section>

          {/* FILTERS */}

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
                placeholder="Search quote number, client, service or status..."
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
                aria-label="Search quotes"
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
                aria-label="Filter quotes by status"
              >
                <option value="All">
                  All statuses
                </option>

                {STATUS_OPTIONS.map(
                  (status) => (
                    <option
                      key={
                        status
                      }
                      value={
                        status
                      }
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
              className={
                styles.errorPanel
              }
            >
              <div>
                <strong>
                  Unable to load
                  quotes
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
                    Quotation records
                  </h3>

                  <p>
                    Review quotations
                    from draft through
                    internal approval
                    and customer
                    acceptance.
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
                    filtersActive
                  }
                  onClearFilters={
                    clearFilters
                  }
                  onCreateQuote={
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
                                    Open full
                                    quotation
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
                                  {quote.client ||
                                    "No client"}
                                </strong>

                                <small>
                                  {quote.contact ||
                                    "No contact"}
                                </small>
                              </div>
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
                                aria-label={`Open ${
                                  quote.quote_number ||
                                  "quote"
                                }`}
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
    <div
      className={
        styles.field
      }
    >
      <label
        htmlFor={`quote-${name}`}
      >
        {label}
        {required
          ? " *"
          : ""}
      </label>

      <input
        id={`quote-${name}`}
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
          `summary${capitalise(
            tone
          )}`
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
  onCreateQuote,
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
          : "No quotes yet"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current search and status filter."
          : "Create your first quotation to begin managing the sales approval process."}
      </p>

      <button
        type="button"
        className={
          styles.primaryButton
        }
        onClick={
          hasFilters
            ? onClearFilters
            : onCreateQuote
        }
      >
        {hasFilters
          ? "Clear filters"
          : "Create quote"}
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
      }).map(
        (_, index) => (
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

function createInitialFormData() {
  return {
    ...INITIAL_FORM_DATA,

    quote_number:
      generateQuoteNumber(),
  };
}

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

Quote Number: ${quote.quote_number}
Date: ${new Date().toLocaleDateString("en-GB")}

Client:
${quote.client || ""}
${quote.contact || ""}
${quote.email || ""}
${quote.phone || ""}

Service:
${quote.service || "Professional Services"}

Estimated Cost:
${quote.amount || "To be confirmed"}

Payment Terms:
25% deposit required before work begins.
75% balance payable before final delivery.

Prepared By:
SaiNal Technologies Ltd
www.sainaltechnologies.com`;
}

function normaliseStatus(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
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

function formatCurrency(
  value
) {
  return Number(
    value || 0
  ).toLocaleString(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  );
}

function formatQuoteAmount(
  value
) {
  const amount =
    getMoneyValue(
      value
    );

  if (
    !value &&
    amount === 0
  ) {
    return "Not set";
  }

  return formatCurrency(
    amount
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
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function capitalise(value) {
  const text =
    String(value || "");

  return (
    text
      .charAt(0)
      .toUpperCase() +
    text.slice(1)
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatusBadge from "../../components/StatusBadge";
import styles from "./proposals.module.css";

const INITIAL_FORM_DATA = {
  title: "",
  client: "",
  contact: "",
  email: "",
  service: "",
  amount: "",
  status: "Draft",
  proposal_text: "",
};

const STATUS_OPTIONS = [
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
];

export default function ProposalsPage() {
  const [proposals, setProposals] = useState([]);
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
    fetchProposals();
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
        "Unable to read proposal page parameters:",
        error
      );
    }
  }, []);

  async function fetchProposals() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/proposals", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load proposals."
        );
      }

      setProposals(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Proposal loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load the proposals."
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

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanTitle = formData.title.trim();
    const cleanClient = formData.client.trim();
    const cleanService = formData.service.trim();

    if (!cleanTitle || !cleanClient || !cleanService) {
      alert(
        "Please enter the proposal title, client and service."
      );
      return;
    }

    try {
      setSaving(true);

      const proposalNumber =
        generateProposalNumber();

      const proposalText =
        formData.proposal_text.trim() ||
        buildProposalText({
          ...formData,
          proposal_number: proposalNumber,
        });

      const response = await fetch(
        "/api/proposals",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            proposal_number:
              proposalNumber,

            title:
              cleanTitle,

            client:
              cleanClient,

            contact:
              formData.contact.trim(),

            email:
              formData.email.trim(),

            service:
              cleanService,

            amount:
              formData.amount.trim(),

            status:
              formData.status || "Draft",

            proposal_text:
              proposalText,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create proposal."
        );
      }

      const createdProposal =
        Array.isArray(data)
          ? data[0]
          : data;

      if (createdProposal) {
        setProposals(
          (currentProposals) => [
            createdProposal,
            ...currentProposals,
          ]
        );
      } else {
        await fetchProposals();
      }

      closeCreateForm();
    } catch (error) {
      console.error(
        "Proposal creation error:",
        error
      );

      alert(
        error.message ||
          "Error creating proposal."
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredProposals = useMemo(() => {
    const search = searchValue
      .trim()
      .toLowerCase();

    return proposals.filter((proposal) => {
      const matchesSearch =
        !search ||
        [
          proposal.proposal_number,
          proposal.title,
          proposal.client,
          proposal.contact,
          proposal.service,
          proposal.status,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(search)
        );

      const matchesStatus =
        statusFilter === "All" ||
        normaliseStatus(
          proposal.status
        ) === normaliseStatus(statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [
    proposals,
    searchValue,
    statusFilter,
  ]);

  const draftCount = proposals.filter(
    (proposal) =>
      normaliseStatus(
        proposal.status
      ) === "draft"
  ).length;

  const sentCount = proposals.filter(
    (proposal) =>
      normaliseStatus(
        proposal.status
      ) === "sent"
  ).length;

  const acceptedCount = proposals.filter(
    (proposal) =>
      normaliseStatus(
        proposal.status
      ) === "accepted"
  ).length;

  const acceptedValue = proposals
    .filter(
      (proposal) =>
        normaliseStatus(
          proposal.status
        ) === "accepted"
    )
    .reduce(
      (total, proposal) =>
        total +
        getMoneyValue(
          proposal.amount
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
        title="Proposal Studio"
        description="Create, refine and track customer proposals."
      >
        <div className={styles.page}>
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
                Proposal Studio
              </h2>

              <p>
                Build professional proposals,
                track approval and keep the
                complete customer document
                inside a secure workspace.
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
                : "Create proposal"}
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
                    Create a new proposal
                  </h3>

                  <p>
                    Add the client, service,
                    pricing and proposal
                    content.
                  </p>
                </div>
              </div>

              <form
                className={
                  styles.proposalForm
                }
                onSubmit={handleSubmit}
              >
                <div
                  className={
                    styles.formGrid
                  }
                >
                  <FormField
                    label="Proposal title"
                    name="title"
                    value={
                      formData.title
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Example: Business Automation Proposal"
                    required
                  />

                  <FormField
                    label="Client"
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
                    label="Service"
                    name="service"
                    value={
                      formData.service
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Example: Digital Transformation"
                    required
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
                    placeholder="Example: £12,000"
                  />

                  <div
                    className={
                      styles.field
                    }
                  >
                    <label
                      htmlFor="proposal-status"
                    >
                      Status
                    </label>

                    <select
                      id="proposal-status"
                      name="status"
                      value={
                        formData.status
                      }
                      onChange={
                        handleChange
                      }
                    >
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
                  </div>

                  <div
                    className={`${styles.field} ${styles.fieldFull}`}
                  >
                    <label
                      htmlFor="proposal-text"
                    >
                      Proposal content
                    </label>

                    <textarea
                      id="proposal-text"
                      name="proposal_text"
                      value={
                        formData.proposal_text
                      }
                      onChange={
                        handleChange
                      }
                      rows={18}
                      placeholder="Leave empty to generate a standard proposal structure automatically."
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
                      ? "Saving proposal..."
                      : "Save proposal"}
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
              icon="▤"
              label="Total proposals"
              value={
                proposals.length
              }
              detail="All proposal records"
              tone="gold"
            />

            <SummaryCard
              icon="◇"
              label="Draft"
              value={draftCount}
              detail="Still being prepared"
              tone="blue"
            />

            <SummaryCard
              icon="→"
              label="Sent"
              value={sentCount}
              detail="Awaiting client response"
              tone="purple"
            />

            <SummaryCard
              icon="£"
              label="Accepted value"
              value={formatCurrency(
                acceptedValue
              )}
              detail={`${acceptedCount} accepted proposal${
                acceptedCount === 1
                  ? ""
                  : "s"
              }`}
              tone="green"
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
                placeholder="Search proposal, client, service or status..."
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(
                    event.target.value
                  )
                }
                aria-label="Search proposals"
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
                aria-label="Filter proposals by status"
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
                  Unable to load proposals
                </strong>

                <p>{errorMessage}</p>
              </div>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  fetchProposals
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
                    Proposal records
                  </h3>

                  <p>
                    Sensitive contact details
                    and the full proposal
                    document are available only
                    inside each Proposal Studio
                    workspace.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {filteredProposals.length}{" "}
                  result
                  {filteredProposals.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredProposals.length ===
              0 ? (
                <EmptyState
                  hasFilters={
                    filtersActive
                  }
                  onClearFilters={
                    clearFilters
                  }
                  onCreateProposal={
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
                      styles.proposalTable
                    }
                  >
                    <thead>
                      <tr>
                        <th>
                          Proposal
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
                      {filteredProposals.map(
                        (proposal) => (
                          <tr
                            key={
                              proposal.id
                            }
                          >
                            <td>
                              <div
                                className={
                                  styles.proposalIdentity
                                }
                              >
                                <span
                                  className={
                                    styles.proposalIcon
                                  }
                                >
                                  ▤
                                </span>

                                <div
                                  className={
                                    styles.proposalIdentityCopy
                                  }
                                >
                                  <Link
                                    href={`/proposals/${proposal.id}`}
                                    className={
                                      styles.proposalLink
                                    }
                                  >
                                    {proposal.proposal_number ||
                                      "Proposal"}
                                  </Link>

                                  <small>
                                    {proposal.title ||
                                      "Open proposal workspace"}
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
                                  {proposal.client ||
                                    "No client"}
                                </strong>

                                <small>
                                  {proposal.contact ||
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
                                {proposal.service ||
                                  "Not specified"}
                              </span>
                            </td>

                            <td>
                              <strong
                                className={
                                  styles.amountText
                                }
                              >
                                {formatProposalAmount(
                                  proposal.amount
                                )}
                              </strong>
                            </td>

                            <td>
                              <StatusBadge
                                status={
                                  proposal.status ||
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
                                  proposal.created_at
                                )}
                              </span>
                            </td>

                            <td>
                              <Link
                                href={`/proposals/${proposal.id}`}
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
        htmlFor={`proposal-${name}`}
      >
        {label}
        {required ? " *" : ""}
      </label>

      <input
        id={`proposal-${name}`}
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

      <strong>{value}</strong>

      <small>{detail}</small>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
  onCreateProposal,
}) {
  return (
    <div className={styles.emptyState}>
      <span
        className={styles.emptyIcon}
      >
        ▤
      </span>

      <h3>
        {hasFilters
          ? "No matching proposals"
          : "No proposals yet"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current search and status filter."
          : "Create your first proposal to begin managing scope, pricing and customer approval."}
      </p>

      <button
        type="button"
        className={
          styles.primaryButton
        }
        onClick={
          hasFilters
            ? onClearFilters
            : onCreateProposal
        }
      >
        {hasFilters
          ? "Clear filters"
          : "Create proposal"}
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

function generateProposalNumber() {
  return `SNP-${Date.now()
    .toString()
    .slice(-6)}`;
}

function buildProposalText(
  proposal
) {
  return `SAINAL TECHNOLOGIES LTD

PROPOSAL

Proposal Number: ${
    proposal.proposal_number
  }

Date: ${new Date().toLocaleDateString(
    "en-GB"
  )}

Prepared For:
${proposal.client || ""}
${proposal.contact || ""}
${proposal.email || ""}

Proposal Title:
${proposal.title || ""}

EXECUTIVE SUMMARY

SaiNal Technologies Ltd proposes to deliver ${
    proposal.service ||
    "professional services"
  } for ${
    proposal.client ||
    "the client"
  }.

CLIENT OBJECTIVES

- Improve operational efficiency
- Reduce manual work
- Improve visibility and reporting
- Deliver a scalable solution

PROPOSED SOLUTION

We will provide a structured delivery approach covering discovery, design, implementation, testing and go-live support.

SCOPE OF WORK

- Discovery and requirements
- Solution design
- Implementation
- Testing and quality assurance
- User training
- Go-live support

DELIVERABLES

- Approved solution design
- Configured and tested solution
- Documentation
- Training
- Go-live handover

TIMELINE

The final project timeline will be confirmed after discovery.

COMMERCIAL VALUE

${
  proposal.amount ||
  "To be confirmed"
}

TERMS

Payment terms and final commercial conditions will be confirmed before project commencement.

Prepared By:
SaiNal Technologies Ltd
www.sainaltechnologies.com`;
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

  return (
    Number(
      String(value).replace(
        /[^0-9.-]/g,
        ""
      )
    ) || 0
  );
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  );
}

function formatProposalAmount(
  value
) {
  if (!value) {
    return "To be confirmed";
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

function capitalise(value) {
  const text = String(value || "");

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}

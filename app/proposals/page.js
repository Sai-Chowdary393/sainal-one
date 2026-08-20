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

import styles from "./proposals.module.css";

// =========================================================
// CONSTANTS
// =========================================================

const EMPTY_FORM = {
  title: "",
  client: "",
  contact: "",
  email: "",
  service: "",
  amount: "",
  status: "Draft",
  proposal_text: "",
  owner_employee_id: "",
};

const STATUSES = [
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
];

// =========================================================
// PAGE
// =========================================================

export default function ProposalsPage() {
  const [
    proposals,
    setProposals,
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
    canAssign: false,
    canSend: false,
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
    error,
    setError,
  ] = useState("");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("All");

  const [
    form,
    setForm,
  ] = useState(
    EMPTY_FORM
  );

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          "/api/proposals",
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
            "Failed to load proposals."
        );
      }

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
      };

      setAccess(
        nextAccess
      );

      setProposals(
        Array.isArray(
          data.proposals
        )
          ? data.proposals
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

      // ===================================================
      // QUICK ACTION ?create=true
      // ===================================================

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
          setForm({
            ...EMPTY_FORM,

            owner_employee_id:
              nextAccess.canAssign
                ? data.currentEmployee
                    ?.id ||
                  ""
                : "",
          });

          setShowForm(
            true
          );

          window.history.replaceState(
            {},
            "",
            window.location.pathname
          );
        }
      } catch {
        // Ignore URL helper errors.
      }
    } catch (error) {
      console.error(
        "Proposal loading error:",
        error
      );

      setProposals(
        []
      );

      setError(
        error.message ||
          "Unable to load proposals."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  // =======================================================
  // FORM
  // =======================================================

  function change(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setForm(
      (
        current
      ) => ({
        ...current,

        [name]:
          value,
      })
    );
  }

  function openForm() {
    if (
      !access.canCreate
    ) {
      return;
    }

    setForm({
      ...EMPTY_FORM,

      owner_employee_id:
        access.canAssign
          ? currentEmployee
              ?.id ||
            ""
          : "",
    });

    setShowForm(
      true
    );

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  function closeForm() {
    setShowForm(
      false
    );

    setForm(
      EMPTY_FORM
    );
  }

  // =======================================================
  // CREATE
  // =======================================================

  async function createProposal(
    event
  ) {
    event.preventDefault();

    if (
      !access.canCreate
    ) {
      alert(
        "You do not have permission to create proposals."
      );

      return;
    }

    if (
      !form.title.trim() ||
      !form.client.trim() ||
      !form.service.trim()
    ) {
      alert(
        "Please enter title, client and service."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      const proposalNumber =
        `SNP-${Date.now()
          .toString()
          .slice(-6)}`;

      const proposalText =
        form.proposal_text.trim() ||
        defaultText({
          ...form,

          proposal_number:
            proposalNumber,
        });

      const payload = {
        ...form,

        proposal_number:
          proposalNumber,

        title:
          form.title.trim(),

        client:
          form.client.trim(),

        contact:
          form.contact.trim(),

        email:
          form.email.trim(),

        service:
          form.service.trim(),

        amount:
          form.amount.trim(),

        proposal_text:
          proposalText,

        lead_id:
          null,

        customer_id:
          null,

        quote_id:
          null,
      };

      if (
        !access.canAssign
      ) {
        delete payload.owner_employee_id;
      }

      const response =
        await fetch(
          "/api/proposals",
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
            "Failed to create proposal."
        );
      }

      if (
        data.proposal
      ) {
        setProposals(
          (
            current
          ) => [
            data.proposal,
            ...current,
          ]
        );
      } else {
        await load();
      }

      closeForm();

      alert(
        data.message ||
          "Proposal created successfully."
      );
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
      setSaving(
        false
      );
    }
  }

  // =======================================================
  // FILTER
  // =======================================================

  const filtered =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return proposals.filter(
          (
            proposal
          ) => {
            const matchesSearch =
              !query ||
              [
                proposal.proposal_number,
                proposal.title,
                proposal.client,
                proposal.contact,
                proposal.service,
                proposal.status,
                proposal.owner
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
                      query
                    )
              );

            const matchesStatus =
              status ===
                "All" ||
              normalise(
                proposal.status
              ) ===
                normalise(
                  status
                );

            return (
              matchesSearch &&
              matchesStatus
            );
          }
        );
      },
      [
        proposals,
        search,
        status,
      ]
    );

  const filtersActive =
    Boolean(
      search
    ) ||
    status !==
      "All";

  function clearFilters() {
    setSearch("");
    setStatus("All");
  }

  // =======================================================
  // STATS
  // =======================================================

  function count(
    selectedStatus
  ) {
    return proposals.filter(
      (
        proposal
      ) =>
        normalise(
          proposal.status
        ) ===
        normalise(
          selectedStatus
        )
    ).length;
  }

  const acceptedValue =
    proposals
      .filter(
        (
          proposal
        ) =>
          normalise(
            proposal.status
          ) ===
          "accepted"
      )
      .reduce(
        (
          total,
          proposal
        ) =>
          total +
          money(
            proposal.amount
          ),
        0
      );

  const visibilityLabel =
    access.canViewAll
      ? "All organisation proposals"
      : access.canViewTeam
        ? "Team proposals"
        : access.canViewOwn
          ? "My proposals"
          : "Proposal access";

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Proposal Studio"
        description="Create, refine and track customer proposals."
      >
        <div
          className={
            styles.page
          }
        >
          {/* ===============================================
              HEADER
          =============================================== */}

          <section
            className={
              styles.header
            }
          >
            <div>
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
                Build professional
                proposals, track customer
                response and control access
                through organisation roles.
              </p>
            </div>

            {access.canCreate && (
              <button
                type="button"
                className={
                  styles.primary
                }
                onClick={
                  showForm
                    ? closeForm
                    : openForm
                }
              >
                {showForm
                  ? "× Close form"
                  : "+ Create proposal"}
              </button>
            )}
          </section>

          {/* ===============================================
              CREATE FORM
          =============================================== */}

          {showForm &&
            access.canCreate && (
              <section
                className={
                  styles.card
                }
              >
                <div
                  className={
                    styles.sectionTitle
                  }
                >
                  <h3>
                    Create a new proposal
                  </h3>

                  <p>
                    Add the client, service,
                    commercial value and
                    proposal document.
                  </p>
                </div>

                <form
                  onSubmit={
                    createProposal
                  }
                  className={
                    styles.form
                  }
                >
                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <Field
                      label="Proposal title"
                      name="title"
                      value={
                        form.title
                      }
                      onChange={
                        change
                      }
                      required
                    />

                    <Field
                      label="Client"
                      name="client"
                      value={
                        form.client
                      }
                      onChange={
                        change
                      }
                      required
                    />

                    <Field
                      label="Primary contact"
                      name="contact"
                      value={
                        form.contact
                      }
                      onChange={
                        change
                      }
                    />

                    <Field
                      label="Email"
                      name="email"
                      type="email"
                      value={
                        form.email
                      }
                      onChange={
                        change
                      }
                    />

                    <Field
                      label="Service"
                      name="service"
                      value={
                        form.service
                      }
                      onChange={
                        change
                      }
                      required
                    />

                    <Field
                      label="Amount"
                      name="amount"
                      value={
                        form.amount
                      }
                      onChange={
                        change
                      }
                      placeholder="Example: £12,000"
                    />

                    <label
                      className={
                        styles.field
                      }
                    >
                      Status

                      <select
                        name="status"
                        value={
                          form.status
                        }
                        onChange={
                          change
                        }
                      >
                        {STATUSES.map(
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

                    {access.canAssign && (
                      <label
                        className={
                          styles.field
                        }
                      >
                        Proposal owner

                        <select
                          name="owner_employee_id"
                          value={
                            form.owner_employee_id
                          }
                          onChange={
                            change
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
                      className={`${styles.field} ${styles.full}`}
                    >
                      Proposal content

                      <textarea
                        name="proposal_text"
                        rows={16}
                        value={
                          form.proposal_text
                        }
                        onChange={
                          change
                        }
                        placeholder="Leave empty to create a standard proposal structure."
                      />
                    </label>
                  </div>

                  <div
                    className={
                      styles.actions
                    }
                  >
                    <button
                      type="button"
                      className={
                        styles.secondary
                      }
                      onClick={
                        closeForm
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className={
                        styles.primary
                      }
                      disabled={
                        saving
                      }
                    >
                      {saving
                        ? "Saving..."
                        : "Save proposal"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          {/* ===============================================
              STATS
          =============================================== */}

          <section
            className={
              styles.stats
            }
          >
            <Stat
              icon="▤"
              label="Total proposals"
              value={
                proposals.length
              }
              note={
                visibilityLabel
              }
              tone="gold"
            />

            <Stat
              icon="◇"
              label="Draft"
              value={
                count(
                  "Draft"
                )
              }
              note="Still being prepared"
              tone="blue"
            />

            <Stat
              icon="→"
              label="Sent"
              value={
                count(
                  "Sent"
                )
              }
              note="Awaiting customer response"
              tone="purple"
            />

            <Stat
              icon="£"
              label="Accepted value"
              value={
                currency(
                  acceptedValue
                )
              }
              note={`${count(
                "Accepted"
              )} accepted proposals`}
              tone="green"
            />
          </section>

          {/* ===============================================
              FILTERS
          =============================================== */}

          <section
            className={
              styles.toolbar
            }
          >
            <label
              className={
                styles.search
              }
            >
              ⌕

              <input
                type="search"
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search proposal, client, owner, service or status..."
              />
            </label>

            <div
              className={
                styles.filters
              }
            >
              <select
                value={
                  status
                }
                onChange={(
                  event
                ) =>
                  setStatus(
                    event.target.value
                  )
                }
              >
                {[
                  "All",
                  ...STATUSES,
                ].map(
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
                      {item ===
                      "All"
                        ? "All statuses"
                        : item}
                    </option>
                  )
                )}
              </select>

              {filtersActive && (
                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          {/* ===============================================
              CONTENT
          =============================================== */}

          {loading ? (
            <Loading />
          ) : error ? (
            <section
              className={
                styles.error
              }
            >
              <div>
                <strong>
                  Unable to load proposals
                </strong>

                <p>
                  {error}
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.secondary
                }
                onClick={
                  load
                }
              >
                Try again
              </button>
            </section>
          ) : (
            <section
              className={
                styles.tableCard
              }
            >
              <div
                className={
                  styles.tableHead
                }
              >
                <div>
                  <h3>
                    Proposal records
                  </h3>

                  <p>
                    Full proposal content and
                    customer details remain
                    inside each secure
                    workspace.
                  </p>
                </div>

                <span>
                  {
                    filtered.length
                  }{" "}
                  result
                  {filtered.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filtered.length ===
              0 ? (
                <div
                  className={
                    styles.empty
                  }
                >
                  <b>
                    ▤
                  </b>

                  <h3>
                    No proposals found
                  </h3>

                  <p>
                    {filtersActive
                      ? "Try clearing the current filters."
                      : access.canCreate
                        ? "Create your first customer proposal."
                        : "There are no proposals available within your current access."}
                  </p>

                  {filtersActive ? (
                    <button
                      type="button"
                      className={
                        styles.primary
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
                      className={
                        styles.primary
                      }
                      onClick={
                        openForm
                      }
                    >
                      Create proposal
                    </button>
                  ) : null}
                </div>
              ) : (
                <div
                  className={
                    styles.tableWrap
                  }
                >
                  <table>
                    <thead>
                      <tr>
                        <th>
                          Proposal
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

                        <th />
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map(
                        (
                          proposal
                        ) => (
                          <tr
                            key={
                              proposal.id
                            }
                          >
                            <td>
                              <div
                                className={
                                  styles.identity
                                }
                              >
                                <span>
                                  ▤
                                </span>

                                <div>
                                  <Link
                                    href={`/proposals/${proposal.id}`}
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
                              <strong>
                                {proposal.client ||
                                  "No client"}
                              </strong>

                              <small
                                className={
                                  styles.block
                                }
                              >
                                {proposal.contact ||
                                  "No contact"}
                              </small>
                            </td>

                            <td>
                              {proposal.owner
                                ?.full_name ||
                                "Unassigned"}
                            </td>

                            <td>
                              {proposal.service ||
                                "Not specified"}
                            </td>

                            <td
                              className={
                                styles.amount
                              }
                            >
                              {formatAmount(
                                proposal.amount
                              )}
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
                              {date(
                                proposal.created_at
                              )}
                            </td>

                            <td>
                              <Link
                                className={
                                  styles.open
                                }
                                href={`/proposals/${proposal.id}`}
                              >
                                Open →
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
      className={
        styles.field
      }
    >
      {label}
      {required
        ? " *"
        : ""}

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
    </label>
  );
}

// =========================================================
// STAT
// =========================================================

function Stat({
  icon,
  label,
  value,
  note,
  tone,
}) {
  return (
    <div
      className={`${styles.stat} ${
        styles[
          tone
        ] ||
        ""
      }`}
    >
      <b>
        {icon}
      </b>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {note}
      </small>
    </div>
  );
}

// =========================================================
// LOADING
// =========================================================

function Loading() {
  return (
    <section
      className={
        styles.loading
      }
    >
      {Array.from({
        length: 5,
      }).map(
        (
          _,
          index
        ) => (
          <div
            key={
              index
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

function normalise(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

function money(
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

function currency(
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

function formatAmount(
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

  const parsed =
    money(
      value
    );

  return parsed
    ? currency(
        parsed
      )
    : value;
}

function date(
  value
) {
  if (
    !value
  ) {
    return "Not available";
  }

  const item =
    new Date(
      value
    );

  if (
    Number.isNaN(
      item.getTime()
    )
  ) {
    return "Not available";
  }

  return item.toLocaleDateString(
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

function defaultText(
  proposal
) {
  return `SAINAL TECHNOLOGIES LTD

PROPOSAL

Proposal Number: ${proposal.proposal_number || ""}
Date: ${new Date().toLocaleDateString("en-GB")}

PROPOSAL TITLE
${proposal.title || ""}

CLIENT
${proposal.client || ""}
${proposal.contact || ""}
${proposal.email || ""}

SERVICE
${proposal.service || ""}

PROPOSED VALUE
${proposal.amount || "To be confirmed"}

OVERVIEW
SaiNal Technologies Ltd is pleased to provide this proposal for the requested services.

SCOPE
The final scope, delivery plan and milestones will be agreed with the customer before commencement.

COMMERCIAL TERMS
Commercial terms are subject to confirmation and customer acceptance.

NEXT STEPS
Please review this proposal and contact SaiNal Technologies Ltd with any questions.

Prepared by:
SaiNal Technologies Ltd`;
}

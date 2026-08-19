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

import styles from "./leads.module.css";

// =========================================================
// INITIAL FORM
// =========================================================

const INITIAL_FORM_DATA = {
  name: "",
  company: "",
  email: "",
  phone: "",
  status: "New",
  value: "",
  owner_employee_id: "",
};

const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Proposal Sent",
  "Follow Up",
  "Won",
  "Lost",
];

// =========================================================
// PAGE
// =========================================================

export default function Leads() {
  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    leads,
    setLeads,
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
    permissions: [],
    roles: [],
    canViewAll: false,
    canViewTeam: false,
    canViewOwn: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
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
    fetchLeads();
  }, []);

  // =======================================================
  // CREATE PARAMETER
  // =======================================================

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
        /*
         * Do not open immediately.
         *
         * We first need to load permissions from
         * /api/leads.
         */
        window.history.replaceState(
          {},
          "",
          window.location.pathname
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Unable to read lead page parameters:",
        error
      );
    }
  }, []);

  async function fetchLeads() {
    try {
      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      const response =
        await fetch(
          "/api/leads",
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
            "Failed to load leads."
        );
      }

      setLeads(
        Array.isArray(
          data.leads
        )
          ? data.leads
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

        permissions:
          Array.isArray(
            data.access
              ?.permissions
          )
            ? data.access
                .permissions
            : [],

        roles:
          Array.isArray(
            data.access
              ?.roles
          )
            ? data.access
                .roles
            : [],

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
      };

      setAccess(
        nextAccess
      );

      // ===================================================
      // OPEN CREATE FORM FROM ?create=true
      // ===================================================

      try {
        const originalParams =
          new URLSearchParams(
            window.location.search
          );

        if (
          originalParams.get(
            "create"
          ) === "true" &&
          nextAccess.canCreate
        ) {
          setShowForm(
            true
          );
        }
      } catch (
        error
      ) {
        console.error(
          "Unable to process lead create parameter:",
          error
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Lead loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "We could not load the leads."
      );

      setLeads(
        []
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
      !canCreate
    ) {
      return;
    }

    setFormData({
      ...INITIAL_FORM_DATA,

      owner_employee_id:
        canAssign
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

  function closeCreateForm() {
    setFormData(
      INITIAL_FORM_DATA
    );

    setShowForm(
      false
    );
  }

  // =======================================================
  // CREATE LEAD
  // =======================================================

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      !canCreate
    ) {
      alert(
        "You do not have permission to create leads."
      );

      return;
    }

    const cleanName =
      formData.name.trim();

    const cleanCompany =
      formData.company.trim();

    if (
      !cleanName ||
      !cleanCompany
    ) {
      alert(
        "Please enter lead name and company."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      const payload = {
        name:
          cleanName,

        company:
          cleanCompany,

        email:
          formData.email.trim(),

        phone:
          formData.phone.trim(),

        status:
          formData.status,

        value:
          formData.value.trim(),
      };

      /*
       * Only submit another owner when the current user
       * has leads.assign.
       *
       * Otherwise the API automatically assigns the
       * creator as owner.
       */
      if (
        canAssign &&
        formData.owner_employee_id
      ) {
        payload.owner_employee_id =
          formData.owner_employee_id;
      }

      const response =
        await fetch(
          "/api/leads",
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
            "Failed to save lead."
        );
      }

      const createdLead =
        data.lead ||
        null;

      if (
        createdLead
      ) {
        setLeads(
          (
            currentLeads
          ) => [
            createdLead,
            ...currentLeads,
          ]
        );
      } else {
        await fetchLeads();
      }

      closeCreateForm();

      alert(
        data.message ||
          "Lead created successfully."
      );
    } catch (
      error
    ) {
      console.error(
        "Lead creation error:",
        error
      );

      alert(
        error.message ||
          "Error saving lead."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  // =======================================================
  // FILTERS
  // =======================================================

  const filteredLeads =
    useMemo(
      () => {
        const normalisedSearchValue =
          searchValue
            .trim()
            .toLowerCase();

        return leads.filter(
          (
            lead
          ) => {
            const matchesSearch =
              !normalisedSearchValue ||
              [
                lead.name,
                lead.company,
                lead.status,
                lead.source,
                lead.ai_score,
                lead.owner
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
                      normalisedSearchValue
                    )
              );

            const matchesStatus =
              statusFilter ===
                "All" ||
              String(
                lead.status ||
                  ""
              )
                .trim()
                .toLowerCase() ===
                statusFilter.toLowerCase();

            return (
              matchesSearch &&
              matchesStatus
            );
          }
        );
      },
      [
        leads,
        searchValue,
        statusFilter,
      ]
    );

  // =======================================================
  // SUMMARY
  // =======================================================

  const hotLeads =
    leads.filter(
      (
        lead
      ) =>
        String(
          lead.ai_score ||
            ""
        )
          .toLowerCase()
          .includes(
            "hot"
          )
    ).length;

  const wonLeads =
    leads.filter(
      (
        lead
      ) =>
        String(
          lead.status ||
            ""
        )
          .trim()
          .toLowerCase() ===
        "won"
    ).length;

  const newLeads =
    leads.filter(
      (
        lead
      ) =>
        String(
          lead.status ||
            ""
        )
          .trim()
          .toLowerCase() ===
        "new"
    ).length;

  function clearFilters() {
    setSearchValue(
      ""
    );

    setStatusFilter(
      "All"
    );
  }

  // =======================================================
  // ACCESS
  // =======================================================

  const canCreate =
    Boolean(
      access.canCreate
    );

  const canAssign =
    Boolean(
      access.canAssign
    );

  const visibilityLabel =
    access.canViewAll
      ? "All organisation leads"
      : access.canViewTeam
        ? "Team leads"
        : access.canViewOwn
          ? "My leads"
          : "Lead access";

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Leads"
        description="Manage enquiries, opportunities and AI-qualified leads."
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
                CRM workspace
              </span>

              <h2>
                Lead pipeline
              </h2>

              <p>
                Review lead progress and
                open an individual record
                to view contact details,
                estimated value and AI
                recommendations.
              </p>
            </div>

            {canCreate && (
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
                  : "Add lead"}
              </button>
            )}
          </section>

          {/* =================================================
              CREATE FORM
          ================================================= */}

          {showForm &&
            canCreate && (
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
                      Create a new lead
                    </h3>

                    <p>
                      Contact and commercial
                      information will only
                      appear inside the lead
                      record.
                    </p>
                  </div>
                </div>

                <form
                  className={
                    styles.leadForm
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
                    <div
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="lead-name"
                      >
                        Lead name *
                      </label>

                      <input
                        id="lead-name"
                        name="name"
                        placeholder="Example: James Smith"
                        value={
                          formData.name
                        }
                        onChange={
                          handleChange
                        }
                        required
                      />
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="lead-company"
                      >
                        Company *
                      </label>

                      <input
                        id="lead-company"
                        name="company"
                        placeholder="Example: NorthStar Logistics"
                        value={
                          formData.company
                        }
                        onChange={
                          handleChange
                        }
                        required
                      />
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="lead-email"
                      >
                        Email
                      </label>

                      <input
                        id="lead-email"
                        name="email"
                        type="email"
                        placeholder="name@company.com"
                        value={
                          formData.email
                        }
                        onChange={
                          handleChange
                        }
                      />
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="lead-phone"
                      >
                        Phone
                      </label>

                      <input
                        id="lead-phone"
                        name="phone"
                        type="tel"
                        placeholder="Telephone number"
                        value={
                          formData.phone
                        }
                        onChange={
                          handleChange
                        }
                      />
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="lead-status"
                      >
                        Status
                      </label>

                      <select
                        id="lead-status"
                        name="status"
                        value={
                          formData.status
                        }
                        onChange={
                          handleChange
                        }
                      >
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
                    </div>

                    <div
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="lead-value"
                      >
                        Estimated value
                      </label>

                      <input
                        id="lead-value"
                        name="value"
                        placeholder="Example: £2,500"
                        value={
                          formData.value
                        }
                        onChange={
                          handleChange
                        }
                      />
                    </div>

                    {/* =======================================
                        OWNER
                    ======================================= */}

                    {canAssign && (
                      <div
                        className={
                          styles.field
                        }
                      >
                        <label
                          htmlFor="lead-owner"
                        >
                          Lead owner
                        </label>

                        <select
                          id="lead-owner"
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
                      className={
                        styles.primaryButton
                      }
                      type="submit"
                      disabled={
                        saving
                      }
                    >
                      {saving
                        ? "Saving lead..."
                        : "Save lead"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          {/* =================================================
              ACCESS SUMMARY
          ================================================= */}

          {!loading &&
            !errorMessage && (
              <section
                className={
                  styles.toolbarPanel
                }
              >
                <div>
                  <strong>
                    {visibilityLabel}
                  </strong>

                  <p>
                    {access.canViewAll
                      ? "You can view all lead records in your organisation."
                      : access.canViewTeam
                        ? "You can view leads owned by employees in your department."
                        : "You can view leads assigned to you."}
                  </p>
                </div>
              </section>
            )}

          {/* =================================================
              SUMMARY
          ================================================= */}

          <section
            className={
              styles.summaryRow
            }
          >
            <SummaryCard
              label="Total leads"
              value={
                leads.length
              }
              detail={
                visibilityLabel
              }
            />

            <SummaryCard
              label="New"
              value={
                newLeads
              }
              detail="Waiting for initial engagement"
            />

            <SummaryCard
              label="AI hot leads"
              value={
                hotLeads
              }
              detail="High-priority opportunities"
            />

            <SummaryCard
              label="Won"
              value={
                wonLeads
              }
              detail="Successfully converted"
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
              <span
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                placeholder="Search by name, company, owner, source or AI score..."
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
                aria-label="Search leads"
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
                aria-label="Filter leads by status"
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
                  Unable to load leads
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
                  fetchLeads
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
                    Lead records
                  </h3>

                  <p>
                    Sensitive information
                    is available only inside
                    each lead record.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {
                    filteredLeads.length
                  }{" "}
                  result
                  {filteredLeads.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredLeads.length ===
              0 ? (
                <EmptyState
                  hasFilters={
                    Boolean(
                      searchValue
                    ) ||
                    statusFilter !==
                      "All"
                  }
                  onClearFilters={
                    clearFilters
                  }
                  onAddLead={
                    openCreateForm
                  }
                  canCreate={
                    canCreate
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
                      styles.leadTable
                    }
                  >
                    <thead>
                      <tr>
                        <th>
                          Lead
                        </th>

                        <th>
                          Company
                        </th>

                        <th>
                          Owner
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Source
                        </th>

                        <th>
                          AI score
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
                      {filteredLeads.map(
                        (
                          lead
                        ) => (
                          <tr
                            key={
                              lead.id
                            }
                          >
                            <td>
                              <div
                                className={
                                  styles.leadIdentity
                                }
                              >
                                <span
                                  className={
                                    styles.leadAvatar
                                  }
                                >
                                  {getInitials(
                                    lead.name
                                  )}
                                </span>

                                <div
                                  className={
                                    styles.leadIdentityCopy
                                  }
                                >
                                  <Link
                                    href={`/leads/${lead.id}`}
                                    className={
                                      styles.leadLink
                                    }
                                  >
                                    {lead.name ||
                                      "Unnamed lead"}
                                  </Link>

                                  <small>
                                    Open to view
                                    full details
                                  </small>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span
                                className={
                                  styles.companyName
                                }
                              >
                                {lead.company ||
                                  "No company"}
                              </span>
                            </td>

                            <td>
                              <span
                                className={
                                  styles.companyName
                                }
                              >
                                {lead.owner
                                  ?.full_name ||
                                  "Unassigned"}
                              </span>
                            </td>

                            <td>
                              <StatusBadge
                                status={
                                  lead.status ||
                                  "New"
                                }
                              />
                            </td>

                            <td>
                              <span
                                className={
                                  styles.sourceBadge
                                }
                              >
                                {lead.source ||
                                  "Manual"}
                              </span>
                            </td>

                            <td>
                              <AiScoreBadge
                                score={
                                  lead.ai_score
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
                                  lead.created_at
                                )}
                              </span>
                            </td>

                            <td>
                              <Link
                                href={`/leads/${lead.id}`}
                                className={
                                  styles.openButton
                                }
                                aria-label={`Open ${
                                  lead.name ||
                                  "lead"
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

// =========================================================
// SUMMARY CARD
// =========================================================

function SummaryCard({
  label,
  value,
  detail,
}) {
  return (
    <div
      className={
        styles.summaryCard
      }
    >
      <span>
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
// AI SCORE
// =========================================================

function AiScoreBadge({
  score,
}) {
  const normalisedScore =
    String(
      score ||
        ""
    )
      .trim()
      .toLowerCase();

  let label =
    score ||
    "Not analysed";

  let icon =
    "—";

  let className =
    styles.aiNeutral;

  if (
    normalisedScore.includes(
      "hot"
    )
  ) {
    label =
      "Hot";

    icon =
      "●";

    className =
      styles.aiHot;
  } else if (
    normalisedScore.includes(
      "warm"
    )
  ) {
    label =
      "Warm";

    icon =
      "●";

    className =
      styles.aiWarm;
  } else if (
    normalisedScore.includes(
      "cold"
    )
  ) {
    label =
      "Cold";

    icon =
      "●";

    className =
      styles.aiCold;
  }

  return (
    <span
      className={`${styles.aiScore} ${className}`}
    >
      <span
        aria-hidden="true"
      >
        {icon}
      </span>

      {label}
    </span>
  );
}

// =========================================================
// EMPTY STATE
// =========================================================

function EmptyState({
  hasFilters,
  onClearFilters,
  onAddLead,
  canCreate,
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
        ◎
      </span>

      <h3>
        {hasFilters
          ? "No matching leads"
          : "No leads found"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current search and status filters."
          : canCreate
            ? "Create your first lead to begin managing your sales pipeline."
            : "There are no lead records available within your current access."}
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
            onAddLead
          }
        >
          Add lead
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
// INITIALS
// =========================================================

function getInitials(
  value = ""
) {
  const words =
    String(
      value
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    words.length ===
    0
  ) {
    return "LD";
  }

  if (
    words.length ===
    1
  ) {
    return words[0]
      .slice(
        0,
        2
      )
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[
      words.length -
        1
    ][0]
  }`.toUpperCase();
}

// =========================================================
// DATE
// =========================================================

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

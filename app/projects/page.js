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

import styles from "./projects.module.css";

// =========================================================
// CONSTANTS
// =========================================================

const INITIAL_FORM_DATA = {
  project_name: "",
  description: "",
  amount: "",
  status: "Planning",
  start_date: "",
  due_date: "",
  owner_employee_id: "",
};

const STATUS_OPTIONS = [
  "Planning",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
];

const COMPLETED_STATUSES = [
  "completed",
  "complete",
  "done",
];

// =========================================================
// PAGE
// =========================================================

export default function ProjectsPage() {
  const [
    projects,
    setProjects,
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
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      setLoading(true);

      setErrorMessage("");

      const response =
        await fetch(
          "/api/projects",
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
            "Failed to load projects."
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
      };

      setAccess(
        nextAccess
      );

      setProjects(
        Array.isArray(
          data.projects
        )
          ? data.projects
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
      // QUICK CREATE
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

          setShowForm(
            true
          );

          window.history.replaceState(
            {},
            "",
            window.location
              .pathname
          );
        }
      } catch {
        // Ignore query helper errors.
      }
    } catch (error) {
      console.error(
        "Projects loading error:",
        error
      );

      setProjects([]);

      setErrorMessage(
        error.message ||
          "We could not load the projects."
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
    setShowForm(false);

    setFormData(
      INITIAL_FORM_DATA
    );
  }

  // =======================================================
  // CREATE
  // =======================================================

  async function createProject(
    event
  ) {
    event.preventDefault();

    if (
      !access.canCreate
    ) {
      alert(
        "You do not have permission to create projects."
      );

      return;
    }

    const projectName =
      formData.project_name
        .trim();

    if (
      !projectName
    ) {
      alert(
        "Please enter a project name."
      );

      return;
    }

    if (
      formData.start_date &&
      formData.due_date &&
      formData.due_date <
        formData.start_date
    ) {
      alert(
        "Project due date cannot be before the start date."
      );

      return;
    }

    try {
      setSaving(true);

      const payload = {
        project_name:
          projectName,

        description:
          formData.description
            .trim(),

        amount:
          formData.amount
            .trim(),

        status:
          formData.status ||
          "Planning",

        start_date:
          formData.start_date ||
          null,

        due_date:
          formData.due_date ||
          null,

        customer_id:
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
          "/api/projects",
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
            "Failed to create project."
        );
      }

      if (
        data.project
      ) {
        setProjects(
          (
            current
          ) => [
            data.project,
            ...current,
          ]
        );
      } else {
        await fetchProjects();
      }

      closeCreateForm();

      alert(
        data.message ||
          "Project created successfully."
      );
    } catch (error) {
      console.error(
        "Project creation error:",
        error
      );

      alert(
        error.message ||
          "Error creating project."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // FILTERS
  // =======================================================

  const filteredProjects =
    useMemo(
      () => {
        const search =
          searchValue
            .trim()
            .toLowerCase();

        return projects.filter(
          (
            project
          ) => {
            const matchesSearch =
              !search ||
              [
                project.project_name,
                project.description,
                project.status,
                project.owner
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
                project.status
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
        projects,
        searchValue,
        statusFilter,
      ]
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

  // =======================================================
  // SUMMARY
  // =======================================================

  const activeProjects =
    projects.filter(
      (
        project
      ) =>
        [
          "planning",
          "in progress",
          "on hold",
        ].includes(
          normaliseStatus(
            project.status
          )
        )
    ).length;

  const completedProjects =
    projects.filter(
      (
        project
      ) =>
        COMPLETED_STATUSES.includes(
          normaliseStatus(
            project.status
          )
        )
    ).length;

  const delayedProjects =
    projects.filter(
      (
        project
      ) =>
        isProjectDelayed(
          project
        )
    ).length;

  const totalProjectValue =
    projects.reduce(
      (
        total,
        project
      ) =>
        total +
        getMoneyValue(
          project.amount
        ),
      0
    );

  const visibilityLabel =
    access.canViewAll
      ? "All organisation projects"
      : access.canViewTeam
        ? "Team projects"
        : access.canViewOwn
          ? "My projects"
          : "Project access";

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Projects"
        description="Manage delivery, progress, tasks and project risk."
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
                Delivery workspace
              </span>

              <h2>
                Project operations
              </h2>

              <p>
                Track delivery,
                ownership, project
                value and key dates.
                Detailed task progress
                remains inside each
                secure project
                workspace.
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
                  : "Create project"}
              </button>
            )}
          </section>

          {/* ===============================================
              FORM
          =============================================== */}

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
                      Create a new
                      project
                    </h3>

                    <p>
                      Add delivery
                      dates, commercial
                      value, ownership
                      and starting
                      status.
                    </p>
                  </div>
                </div>

                <form
                  className={
                    styles.projectForm
                  }
                  onSubmit={
                    createProject
                  }
                >
                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <FormField
                      label="Project name"
                      name="project_name"
                      value={
                        formData.project_name
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: Customer Portal Implementation"
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

                    <FormField
                      label="Start date"
                      name="start_date"
                      type="date"
                      value={
                        formData.start_date
                      }
                      onChange={
                        handleChange
                      }
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
                      className={
                        styles.field
                      }
                    >
                      <label
                        htmlFor="project-status"
                      >
                        Status
                      </label>

                      <select
                        id="project-status"
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
                              {status}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {access.canAssign && (
                      <div
                        className={
                          styles.field
                        }
                      >
                        <label
                          htmlFor="project-owner"
                        >
                          Project owner
                        </label>

                        <select
                          id="project-owner"
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

                    <div
                      className={`${styles.field} ${styles.fieldFull}`}
                    >
                      <label
                        htmlFor="project-description"
                      >
                        Description
                      </label>

                      <textarea
                        id="project-description"
                        name="description"
                        value={
                          formData.description
                        }
                        onChange={
                          handleChange
                        }
                        rows={5}
                        placeholder="Describe the project scope and delivery objective."
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
                        ? "Saving project..."
                        : "Save project"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          {/* ===============================================
              SUMMARY
          =============================================== */}

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              icon="▰"
              label="Total projects"
              value={
                projects.length
              }
              detail={
                visibilityLabel
              }
              tone="gold"
            />

            <SummaryCard
              icon="→"
              label="Active"
              value={
                activeProjects
              }
              detail="Currently in delivery"
              tone="blue"
            />

            <SummaryCard
              icon="✓"
              label="Completed"
              value={
                completedProjects
              }
              detail="Successfully delivered"
              tone="green"
            />

            <SummaryCard
              icon="!"
              label="Delayed"
              value={
                delayedProjects
              }
              detail={
                formatCurrency(
                  totalProjectValue
                )
              }
              tone="red"
            />
          </section>

          {/* ===============================================
              TOOLBAR
          =============================================== */}

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
                placeholder="Search project, owner, description or status..."
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
                aria-label="Search projects"
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

          {/* ===============================================
              CONTENT
          =============================================== */}

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
                  projects
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
                  fetchProjects
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
                    Project records
                  </h3>

                  <p>
                    Open a project
                    workspace to manage
                    tasks, progress,
                    invoicing and
                    delivery risk.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {
                    filteredProjects.length
                  }{" "}
                  result
                  {filteredProjects.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredProjects.length ===
              0 ? (
                <EmptyState
                  hasFilters={
                    filtersActive
                  }
                  canCreate={
                    access.canCreate
                  }
                  onClearFilters={
                    clearFilters
                  }
                  onCreateProject={
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
                      styles.projectTable
                    }
                  >
                    <thead>
                      <tr>
                        <th>
                          Project
                        </th>

                        <th>
                          Owner
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Amount
                        </th>

                        <th>
                          Start date
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
                      {filteredProjects.map(
                        (
                          project
                        ) => {
                          const delayed =
                            isProjectDelayed(
                              project
                            );

                          return (
                            <tr
                              key={
                                project.id
                              }
                            >
                              <td>
                                <div
                                  className={
                                    styles.projectIdentity
                                  }
                                >
                                  <span
                                    className={
                                      styles.projectIcon
                                    }
                                  >
                                    ▰
                                  </span>

                                  <div
                                    className={
                                      styles.projectIdentityCopy
                                    }
                                  >
                                    <Link
                                      href={`/projects/${project.id}`}
                                      className={
                                        styles.projectLink
                                      }
                                    >
                                      {project.project_name ||
                                        "Unnamed project"}
                                    </Link>

                                    <small>
                                      {project.description ||
                                        "Open delivery workspace"}
                                    </small>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <span
                                  className={
                                    styles.dateText
                                  }
                                >
                                  {project.owner
                                    ?.full_name ||
                                    "Unassigned"}
                                </span>
                              </td>

                              <td>
                                <StatusBadge
                                  status={
                                    project.status ||
                                    "Planning"
                                  }
                                />
                              </td>

                              <td>
                                <strong
                                  className={
                                    styles.amountText
                                  }
                                >
                                  {formatProjectAmount(
                                    project.amount
                                  )}
                                </strong>
                              </td>

                              <td>
                                <span
                                  className={
                                    styles.dateText
                                  }
                                >
                                  {formatDate(
                                    project.start_date
                                  )}
                                </span>
                              </td>

                              <td>
                                <span
                                  className={`${styles.dateText} ${
                                    delayed
                                      ? styles.dateTextOverdue
                                      : ""
                                  }`}
                                >
                                  {formatDate(
                                    project.due_date
                                  )}
                                </span>

                                {delayed && (
                                  <span
                                    className={
                                      styles.overdueLabel
                                    }
                                  >
                                    Delayed
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
                                    project.created_at
                                  )}
                                </span>
                              </td>

                              <td>
                                <Link
                                  href={`/projects/${project.id}`}
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

// =========================================================
// FIELD
// =========================================================

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
}) {
  return (
    <div
      className={
        styles.field
      }
    >
      <label
        htmlFor={`project-${name}`}
      >
        {label}
        {required
          ? " *"
          : ""}
      </label>

      <input
        id={`project-${name}`}
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
  const toneClass =
    styles[
      `summary${capitalise(
        tone
      )}`
    ] ||
    "";

  return (
    <div
      className={`${styles.summaryCard} ${toneClass}`}
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
  onCreateProject,
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
        ▰
      </span>

      <h3>
        {hasFilters
          ? "No matching projects"
          : "No projects found"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current filters."
          : canCreate
            ? "Create your first delivery project."
            : "There are no projects available within your current access."}
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
            onCreateProject
          }
        >
          Create project
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

function isProjectDelayed(
  project
) {
  if (
    COMPLETED_STATUSES.includes(
      normaliseStatus(
        project.status
      )
    ) ||
    normaliseStatus(
      project.status
    ) ===
      "cancelled"
  ) {
    return false;
  }

  return isDateOverdue(
    project.due_date
  );
}

function isDateOverdue(
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

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  return (
    date.getTime() <
    today.getTime()
  );
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

function formatProjectAmount(
  value
) {
  if (!value) {
    return "Not set";
  }

  if (
    String(value).includes(
      "£"
    )
  ) {
    return value;
  }

  const number =
    getMoneyValue(
      value
    );

  return number
    ? formatCurrency(
        number
      )
    : value;
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

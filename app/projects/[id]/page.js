"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useParams,
  useRouter,
} from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import StatusBadge from "../../../components/StatusBadge";

import styles from "./project-details.module.css";

// =========================================================
// CONSTANTS
// =========================================================

const PROJECT_STATUS_OPTIONS = [
  "Planning",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
];

const COMPLETED_TASK_STATUSES = [
  "completed",
  "complete",
  "done",
];

const EMPTY_ACCESS = {
  isOwner: false,
  canViewAll: false,
  canViewTeam: false,
  canViewOwn: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canAssign: false,
};

const EMPTY_EDIT_FORM = {
  project_name: "",
  description: "",
  amount: "",
  status: "Planning",
  start_date: "",
  due_date: "",
  owner_employee_id: "",
};

// =========================================================
// PAGE
// =========================================================

export default function ProjectDetailsPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const projectId =
    params?.id;

  const [
    project,
    setProject,
  ] = useState(null);

  const [
    customer,
    setCustomer,
  ] = useState(null);

  const [
    quote,
    setQuote,
  ] = useState(null);

  const [
    tasks,
    setTasks,
  ] = useState([]);

  const [
    invoices,
    setInvoices,
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
  ] = useState(
    EMPTY_ACCESS
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    showEditForm,
    setShowEditForm,
  ] = useState(false);

  const [
    editForm,
    setEditForm,
  ] = useState(
    EMPTY_EDIT_FORM
  );

  const [
    savingProject,
    setSavingProject,
  ] = useState(false);

  const [
    deletingProject,
    setDeletingProject,
  ] = useState(false);

  const [
    generatingInvoice,
    setGeneratingInvoice,
  ] = useState(false);

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId]);

  async function fetchProjectDetails() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response =
        await fetch(
          `/api/projects/${encodeURIComponent(
            projectId
          )}`,
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
            "Failed to load project."
        );
      }

      const nextProject =
        data.project ||
        null;

      setProject(
        nextProject
      );

      setCustomer(
        data.customer ||
          null
      );

      setQuote(
        data.quote ||
          null
      );

      setTasks(
        Array.isArray(
          data.tasks
        )
          ? [...data.tasks].sort(
              sortTasks
            )
          : []
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

      setAccess({
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
      });

      if (nextProject) {
        populateEditForm(
          nextProject
        );
      }
    } catch (error) {
      console.error(
        "Project details loading error:",
        error
      );

      setProject(null);

      setErrorMessage(
        error.message ||
          "We could not load this project."
      );
    } finally {
      setLoading(false);
    }
  }

  // =======================================================
  // EDIT FORM
  // =======================================================

  function populateEditForm(
    projectRecord
  ) {
    setEditForm({
      project_name:
        projectRecord
          ?.project_name ||
        "",

      description:
        projectRecord
          ?.description ||
        "",

      amount:
        projectRecord
          ?.amount ||
        "",

      status:
        projectRecord
          ?.status ||
        "Planning",

      start_date:
        normaliseDateInput(
          projectRecord
            ?.start_date
        ),

      due_date:
        normaliseDateInput(
          projectRecord
            ?.due_date
        ),

      owner_employee_id:
        projectRecord
          ?.owner_employee_id ||
        "",
    });
  }

  function handleEditChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setEditForm(
      (
        current
      ) => ({
        ...current,

        [name]:
          value,
      })
    );
  }

  function openEditForm() {
    if (
      !project ||
      !access.canEdit
    ) {
      return;
    }

    populateEditForm(
      project
    );

    setShowEditForm(
      true
    );
  }

  function closeEditForm() {
    if (
      project
    ) {
      populateEditForm(
        project
      );
    }

    setShowEditForm(
      false
    );
  }

  // =======================================================
  // SAVE PROJECT
  // =======================================================

  async function saveProject(
    event
  ) {
    event.preventDefault();

    if (
      !project ||
      !access.canEdit
    ) {
      return;
    }

    const projectName =
      editForm.project_name
        .trim();

    if (!projectName) {
      alert(
        "Project name is required."
      );

      return;
    }

    if (
      editForm.start_date &&
      editForm.due_date &&
      editForm.due_date <
        editForm.start_date
    ) {
      alert(
        "Project due date cannot be before the start date."
      );

      return;
    }

    try {
      setSavingProject(
        true
      );

      const payload = {
        project_name:
          projectName,

        description:
          editForm.description
            .trim(),

        amount:
          editForm.amount
            .trim(),

        status:
          editForm.status,

        start_date:
          editForm.start_date ||
          null,

        due_date:
          editForm.due_date ||
          null,
      };

      if (
        access.canAssign
      ) {
        payload.owner_employee_id =
          editForm.owner_employee_id ||
          null;
      }

      const response =
        await fetch(
          `/api/projects/${encodeURIComponent(
            project.id
          )}`,
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

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update project."
        );
      }

      if (
        data.project
      ) {
        setProject(
          data.project
        );

        populateEditForm(
          data.project
        );
      }

      setShowEditForm(
        false
      );

      alert(
        data.message ||
          "Project updated successfully."
      );
    } catch (error) {
      console.error(
        "Project update error:",
        error
      );

      alert(
        error.message ||
          "Error updating project."
      );
    } finally {
      setSavingProject(
        false
      );
    }
  }

  // =======================================================
  // DELETE PROJECT
  // =======================================================

  async function deleteProject() {
    if (
      !project ||
      !access.canDelete ||
      deletingProject
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this project? Projects with linked tasks or invoices cannot be deleted."
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingProject(
        true
      );

      const response =
        await fetch(
          `/api/projects/${encodeURIComponent(
            project.id
          )}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to delete project."
        );
      }

      alert(
        data.message ||
          "Project deleted successfully."
      );

      router.push(
        "/projects"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Project deletion error:",
        error
      );

      alert(
        error.message ||
          "Error deleting project."
      );
    } finally {
      setDeletingProject(
        false
      );
    }
  }

  // =======================================================
  // GENERATE INVOICE
  // =======================================================

  async function generateInvoice() {
    if (
      !project ||
      generatingInvoice
    ) {
      return;
    }

    try {
      setGeneratingInvoice(
        true
      );

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
              JSON.stringify({
                project_id:
                  project.id,

                customer_id:
                  project.customer_id ||
                  null,

                quote_id:
                  project.quote_id ||
                  null,

                client:
                  customer
                    ?.company ||
                  customer
                    ?.customer_name ||
                  project.project_name,

                service:
                  quote?.service ||
                  project.description ||
                  "Project Service",

                amount:
                  project.amount ||
                  "£0.00",

                subtotal:
                  project.amount ||
                  "£0.00",

                vat_rate:
                  "0%",

                vat_amount:
                  "£0.00",

                total_amount:
                  project.amount ||
                  "£0.00",

                status:
                  "Draft Invoice",

                due_date:
                  null,

                payment_terms:
                  "Payment due within 14 days of invoice date.",
              }),
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

      const createdInvoice =
        Array.isArray(
          data
        )
          ? data[0]
          : data?.invoice ||
            data;

      alert(
        data.message ||
          "Invoice generated successfully."
      );

      if (
        createdInvoice?.id
      ) {
        router.push(
          `/invoices/${createdInvoice.id}`
        );
      } else {
        await fetchProjectDetails();
      }
    } catch (error) {
      console.error(
        "Invoice generation error:",
        error
      );

      alert(
        error.message ||
          "Error generating invoice."
      );
    } finally {
      setGeneratingInvoice(
        false
      );
    }
  }

  // =======================================================
  // METRICS
  // =======================================================

  const projectMetrics =
    useMemo(() => {
      const totalTasks =
        tasks.length;

      const completedTasks =
        tasks.filter(
          (
            task
          ) =>
            COMPLETED_TASK_STATUSES.includes(
              normaliseStatus(
                task.status
              )
            )
        ).length;

      const blockedTasks =
        tasks.filter(
          (
            task
          ) =>
            normaliseStatus(
              task.status
            ) ===
            "blocked"
        ).length;

      const overdueTasks =
        tasks.filter(
          (
            task
          ) =>
            isTaskOverdue(
              task
            )
        ).length;

      const inProgressTasks =
        tasks.filter(
          (
            task
          ) =>
            normaliseStatus(
              task.status
            ) ===
            "in progress"
        ).length;

      const progress =
        totalTasks === 0
          ? 0
          : Math.round(
              (
                completedTasks /
                totalTasks
              ) *
                100
            );

      const delayed =
        normaliseStatus(
          project?.status
        ) !==
          "completed" &&
        normaliseStatus(
          project?.status
        ) !==
          "cancelled" &&
        (
          isDateOverdue(
            project?.due_date
          ) ||
          overdueTasks >
            0
        );

      return {
        totalTasks,
        completedTasks,
        blockedTasks,
        overdueTasks,
        inProgressTasks,
        progress,
        delayed,
      };
    }, [
      tasks,
      project,
    ]);

  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Project Workspace"
          description="Loading project information."
        >
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // ERROR
  // =======================================================

  if (errorMessage) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Project Workspace"
          description="Manage project delivery and tasks."
        >
          <section
            className={
              styles.errorPanel
            }
          >
            <div>
              <strong>
                Unable to load project
              </strong>

              <p>
                {errorMessage}
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              <Link
                href="/projects"
                className={
                  styles.secondaryButton
                }
              >
                Back to projects
              </Link>

              <button
                type="button"
                className={
                  styles.primaryButton
                }
                onClick={
                  fetchProjectDetails
                }
              >
                Try again
              </button>
            </div>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // NOT FOUND
  // =======================================================

  if (!project) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Project Workspace"
          description="Manage project delivery and tasks."
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
              ▰
            </span>

            <h2>
              Project not found
            </h2>

            <p>
              This project may have
              been deleted or you may
              not have access to it.
            </p>

            <Link
              href="/projects"
              className={
                styles.primaryButton
              }
            >
              Return to projects
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // DERIVED DATA
  // =======================================================

  const recommendations =
    buildProjectRecommendations(
      project,
      projectMetrics
    );

  const deliveryRisk =
    getDeliveryRisk(
      project,
      projectMetrics
    );

  const ownerName =
    project.owner
      ?.full_name ||
    "Unassigned";

  const customerName =
    customer?.company ||
    customer
      ?.customer_name ||
    "Not linked";

  const quoteName =
    quote?.quote_number ||
    quote?.service ||
    "Linked quote";

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          project.project_name ||
          "Project Workspace"
        }
        description="Manage project delivery, ownership, progress and invoicing."
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
                styles.headerCopy
              }
            >
              <Link
                href="/projects"
                className={
                  styles.backLink
                }
              >
                ← Back to projects
              </Link>

              <span
                className={
                  styles.eyebrow
                }
              >
                Delivery workspace
              </span>

              <h2>
                {project.project_name ||
                  "Unnamed project"}
              </h2>

              <p>
                Manage project
                ownership, delivery
                progress, commercial
                links and invoicing.
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              {access.canEdit && (
                <button
                  type="button"
                  className={
                    styles.primaryButton
                  }
                  onClick={
                    showEditForm
                      ? closeEditForm
                      : openEditForm
                  }
                >
                  {showEditForm
                    ? "Close edit"
                    : "Edit project"}
                </button>
              )}

              {normaliseStatus(
                project.status
              ) ===
                "completed" && (
                <button
                  type="button"
                  className={
                    styles.successButton
                  }
                  disabled={
                    generatingInvoice
                  }
                  onClick={
                    generateInvoice
                  }
                >
                  {generatingInvoice
                    ? "Generating invoice..."
                    : "Generate invoice"}
                </button>
              )}

              {access.canDelete && (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  disabled={
                    deletingProject
                  }
                  onClick={
                    deleteProject
                  }
                >
                  {deletingProject
                    ? "Deleting..."
                    : "Delete project"}
                </button>
              )}
            </div>
          </section>

          {/* ===============================================
              EDIT PROJECT
          =============================================== */}

          {showEditForm &&
            access.canEdit && (
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
                      Edit project
                    </h3>

                    <p>
                      Update delivery
                      information and
                      project ownership.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={
                    saveProject
                  }
                >
                  <div
                    style={{
                      display:
                        "grid",

                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",

                      gap:
                        "16px",

                      marginBottom:
                        "16px",
                    }}
                  >
                    <ProjectField
                      label="Project name"
                      name="project_name"
                      value={
                        editForm.project_name
                      }
                      onChange={
                        handleEditChange
                      }
                      required
                    />

                    <ProjectField
                      label="Amount"
                      name="amount"
                      value={
                        editForm.amount
                      }
                      onChange={
                        handleEditChange
                      }
                    />

                    <ProjectField
                      label="Start date"
                      name="start_date"
                      type="date"
                      value={
                        editForm.start_date
                      }
                      onChange={
                        handleEditChange
                      }
                    />

                    <ProjectField
                      label="Due date"
                      name="due_date"
                      type="date"
                      value={
                        editForm.due_date
                      }
                      onChange={
                        handleEditChange
                      }
                    />

                    <label
                      style={
                        fieldStyle
                      }
                    >
                      <span
                        style={
                          fieldLabelStyle
                        }
                      >
                        Status
                      </span>

                      <select
                        name="status"
                        value={
                          editForm.status
                        }
                        onChange={
                          handleEditChange
                        }
                        style={
                          inputStyle
                        }
                      >
                        {PROJECT_STATUS_OPTIONS.map(
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
                    </label>

                    {access.canAssign && (
                      <label
                        style={
                          fieldStyle
                        }
                      >
                        <span
                          style={
                            fieldLabelStyle
                          }
                        >
                          Project owner
                        </span>

                        <select
                          name="owner_employee_id"
                          value={
                            editForm.owner_employee_id
                          }
                          onChange={
                            handleEditChange
                          }
                          style={
                            inputStyle
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
                                {employee.full_name}

                                {employee.job_title
                                  ? ` — ${employee.job_title}`
                                  : ""}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    )}
                  </div>

                  <label
                    style={{
                      ...fieldStyle,

                      marginBottom:
                        "18px",
                    }}
                  >
                    <span
                      style={
                        fieldLabelStyle
                      }
                    >
                      Description
                    </span>

                    <textarea
                      name="description"
                      value={
                        editForm.description
                      }
                      onChange={
                        handleEditChange
                      }
                      rows={5}
                      style={{
                        ...inputStyle,

                        resize:
                          "vertical",
                      }}
                    />
                  </label>

                  <div
                    className={
                      styles.headerActions
                    }
                  >
                    <button
                      type="button"
                      className={
                        styles.secondaryButton
                      }
                      disabled={
                        savingProject
                      }
                      onClick={
                        closeEditForm
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
                        savingProject
                      }
                    >
                      {savingProject
                        ? "Saving..."
                        : "Save changes"}
                    </button>
                  </div>
                </form>
              </section>
            )}

          {/* ===============================================
              HERO
          =============================================== */}

          <section
            className={
              styles.heroCard
            }
          >
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
                  styles.identityCopy
                }
              >
                <span
                  className={
                    styles.identityLabel
                  }
                >
                  Project delivery
                </span>

                <h3>
                  {project.project_name ||
                    "Unnamed project"}
                </h3>

                <p>
                  {project.description ||
                    "No project description has been added."}
                </p>

                <div
                  className={
                    styles.identityMeta
                  }
                >
                  <StatusBadge
                    status={
                      project.status ||
                      "Planning"
                    }
                  />

                  <span
                    className={
                      styles.metaBadge
                    }
                  >
                    Owner:{" "}
                    {ownerName}
                  </span>

                  <span
                    className={
                      styles.metaBadge
                    }
                  >
                    Start{" "}
                    {formatDate(
                      project.start_date
                    )}
                  </span>

                  <span
                    className={
                      projectMetrics.delayed
                        ? styles.overdueBadge
                        : styles.metaBadge
                    }
                  >
                    {projectMetrics.delayed
                      ? "Delivery delayed"
                      : `Due ${formatDate(
                          project.due_date
                        )}`}
                  </span>
                </div>
              </div>
            </div>

            <div
              className={
                styles.heroMetrics
              }
            >
              <HeroMetric
                label="Project value"
                value={
                  formatProjectAmount(
                    project.amount
                  )
                }
              />

              <HeroMetric
                label="Progress"
                value={`${projectMetrics.progress}%`}
                success={
                  projectMetrics.progress ===
                  100
                }
              />

              <HeroMetric
                label="Delivery risk"
                value={
                  deliveryRisk
                }
                warning={
                  deliveryRisk ===
                  "High"
                }
              />
            </div>
          </section>

          {/* ===============================================
              INFORMATION / INTELLIGENCE
          =============================================== */}

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
                    Project information
                  </h3>

                  <p>
                    Scope, ownership,
                    dates, value and
                    business links
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.detailList
                }
              >
                <DetailRow
                  label="Project name"
                  value={
                    project.project_name
                  }
                />

                <DetailRow
                  label="Owner"
                  value={
                    ownerName
                  }
                />

                <DetailRow
                  label="Description"
                  value={
                    project.description
                  }
                />

                <DetailRow
                  label="Status"
                  customValue={
                    <StatusBadge
                      status={
                        project.status ||
                        "Planning"
                      }
                    />
                  }
                />

                <DetailRow
                  label="Project value"
                  value={
                    formatProjectAmount(
                      project.amount
                    )
                  }
                />

                <DetailRow
                  label="Start date"
                  value={
                    formatDate(
                      project.start_date
                    )
                  }
                />

                <DetailRow
                  label="Due date"
                  value={
                    formatDate(
                      project.due_date
                    )
                  }
                />

                <DetailRow
                  label="Created"
                  value={
                    formatDate(
                      project.created_at
                    )
                  }
                />

                <DetailRow
                  label="Customer"
                  customValue={
                    customer ? (
                      <Link
                        href={`/customers/${customer.id}`}
                      >
                        {customerName} →
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
                  label="Source quote"
                  customValue={
                    quote ? (
                      <Link
                        href={`/quotes/${quote.id}`}
                      >
                        {quoteName} →
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
                    Delivery intelligence
                  </span>

                  <h3>
                    Project risk overview
                  </h3>
                </div>
              </div>

              <div
                className={
                  styles.riskGrid
                }
              >
                <RiskMetric
                  label="Delivery risk"
                  value={
                    deliveryRisk
                  }
                />

                <RiskMetric
                  label="Progress"
                  value={`${projectMetrics.progress}%`}
                />

                <RiskMetric
                  label="Blocked tasks"
                  value={
                    projectMetrics.blockedTasks
                  }
                />

                <RiskMetric
                  label="Overdue tasks"
                  value={
                    projectMetrics.overdueTasks
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
                        {recommendation}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>
          </section>

          {/* ===============================================
              PROGRESS
          =============================================== */}

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
                  Project progress
                </h3>

                <p>
                  Delivery completion
                  based on currently
                  linked project tasks.
                </p>
              </div>
            </div>

            <div
              className={
                styles.progressOverview
              }
            >
              <div
                className={
                  styles.progressHeader
                }
              >
                <strong>
                  {projectMetrics.progress}%
                </strong>

                <span>
                  {projectMetrics.completedTasks}{" "}
                  of{" "}
                  {projectMetrics.totalTasks}{" "}
                  tasks completed
                </span>
              </div>

              <div
                className={
                  styles.progressTrack
                }
              >
                <div
                  className={
                    styles.progressFill
                  }
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        projectMetrics.progress
                      )
                    )}%`,
                  }}
                />
              </div>

              <div
                className={
                  styles.progressMetrics
                }
              >
                <ProgressMetric
                  label="Total tasks"
                  value={
                    projectMetrics.totalTasks
                  }
                />

                <ProgressMetric
                  label="Completed"
                  value={
                    projectMetrics.completedTasks
                  }
                />

                <ProgressMetric
                  label="In progress"
                  value={
                    projectMetrics.inProgressTasks
                  }
                />

                <ProgressMetric
                  label="Blocked"
                  value={
                    projectMetrics.blockedTasks
                  }
                  warning
                />

                <ProgressMetric
                  label="Overdue"
                  value={
                    projectMetrics.overdueTasks
                  }
                  danger
                />
              </div>
            </div>
          </section>

          {/* ===============================================
              TASKS - READ ONLY UNTIL BATCH 4C
          =============================================== */}

          <section
            className={
              styles.taskPanel
            }
          >
            <div
              className={
                styles.taskPanelHeader
              }
            >
              <div>
                <h3>
                  Project tasks
                </h3>

                <p>
                  Task management will
                  become permission-aware
                  in the next security
                  batch.
                </p>
              </div>

              <span
                className={
                  styles.taskCount
                }
              >
                {tasks.length} task
                {tasks.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>

            {tasks.length ===
            0 ? (
              <div
                style={
                  emptyStateStyle
                }
              >
                <strong>
                  No project tasks
                </strong>

                <p>
                  No tasks are currently
                  linked to this project.
                </p>
              </div>
            ) : (
              <div
                style={{
                  overflowX:
                    "auto",
                }}
              >
                <table
                  style={
                    tableStyle
                  }
                >
                  <thead>
                    <tr>
                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Task
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Status
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Priority
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Due date
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {tasks.map(
                      (
                        task
                      ) => (
                        <tr
                          key={
                            task.id
                          }
                        >
                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <strong>
                              {task.task_name ||
                                "Unnamed task"}
                            </strong>

                            {task.description && (
                              <div
                                style={
                                  tableDescriptionStyle
                                }
                              >
                                {task.description}
                              </div>
                            )}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <StatusBadge
                              status={
                                task.status ||
                                "To Do"
                              }
                            />
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {task.priority ||
                              "Medium"}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <span
                              style={
                                isTaskOverdue(
                                  task
                                )
                                  ? overdueTextStyle
                                  : undefined
                              }
                            >
                              {formatDate(
                                task.due_date
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ===============================================
              INVOICES
          =============================================== */}

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
                  Project invoices
                </h3>

                <p>
                  Invoices linked to
                  this delivery project.
                </p>
              </div>

              <span
                className={
                  styles.taskCount
                }
              >
                {invoices.length} invoice
                {invoices.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>

            {invoices.length ===
            0 ? (
              <div
                style={
                  emptyStateStyle
                }
              >
                <strong>
                  No project invoices
                </strong>

                <p>
                  No invoices are
                  currently linked to
                  this project.
                </p>
              </div>
            ) : (
              <div
                style={{
                  overflowX:
                    "auto",
                }}
              >
                <table
                  style={
                    tableStyle
                  }
                >
                  <thead>
                    <tr>
                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Invoice
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Service
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Amount
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Status
                      </th>

                      <th
                        style={
                          tableHeaderStyle
                        }
                      >
                        Due date
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {invoices.map(
                      (
                        invoice
                      ) => (
                        <tr
                          key={
                            invoice.id
                          }
                        >
                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <Link
                              href={`/invoices/${invoice.id}`}
                            >
                              {invoice.invoice_number ||
                                "Open invoice"}{" "}
                              →
                            </Link>
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {invoice.service ||
                              "Not set"}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {invoice.total_amount ||
                              invoice.amount ||
                              "Not set"}
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            <StatusBadge
                              status={
                                invoice.status ||
                                "Draft Invoice"
                              }
                            />
                          </td>

                          <td
                            style={
                              tableCellStyle
                            }
                          >
                            {formatDate(
                              invoice.due_date
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ===============================================
              ACCESS
          =============================================== */}

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
                  Record access
                </h3>

                <p>
                  Ownership and access
                  information for this
                  project.
                </p>
              </div>
            </div>

            <div
              className={
                styles.detailList
              }
            >
              <DetailRow
                label="Project owner"
                value={
                  ownerName
                }
              />

              <DetailRow
                label="Signed-in employee"
                value={
                  currentEmployee
                    ?.full_name ||
                  currentEmployee
                    ?.email ||
                  "Current user"
                }
              />

              <DetailRow
                label="Visibility"
                value={
                  getVisibilityLabel(
                    access
                  )
                }
              />

              <DetailRow
                label="Can edit"
                value={
                  access.canEdit
                    ? "Yes"
                    : "No"
                }
              />

              <DetailRow
                label="Can reassign"
                value={
                  access.canAssign
                    ? "Yes"
                    : "No"
                }
              />
            </div>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// FORM FIELD
// =========================================================

function ProjectField({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
}) {
  return (
    <label
      style={
        fieldStyle
      }
    >
      <span
        style={
          fieldLabelStyle
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
        required={
          required
        }
        style={
          inputStyle
        }
      />
    </label>
  );
}

// =========================================================
// DETAIL ROW
// =========================================================

function DetailRow({
  label,
  value,
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

// =========================================================
// HERO METRIC
// =========================================================

function HeroMetric({
  label,
  value,
  success = false,
  warning = false,
}) {
  return (
    <div
      className={`${styles.heroMetric} ${
        success
          ? styles.heroMetricSuccess
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

// =========================================================
// PROGRESS METRIC
// =========================================================

function ProgressMetric({
  label,
  value,
  warning = false,
  danger = false,
}) {
  return (
    <div
      className={`${styles.progressMetric} ${
        warning
          ? styles.progressMetricWarning
          : ""
      } ${
        danger
          ? styles.progressMetricDanger
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

// =========================================================
// RISK METRIC
// =========================================================

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

function normaliseDateInput(
  value
) {
  if (!value) {
    return "";
  }

  return String(
    value
  ).slice(
    0,
    10
  );
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

  const cleanedValue =
    String(value)
      .replace(
        /,/g,
        ""
      )
      .replace(
        /[^\d.-]/g,
        ""
      );

  const parsedValue =
    Number.parseFloat(
      cleanedValue
    );

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : 0;
}

function formatProjectAmount(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not set";
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",

      minimumFractionDigits:
        0,

      maximumFractionDigits:
        0,
    }
  ).format(
    getMoneyValue(
      value
    )
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "Not available";
  }

  const date =
    String(
      value
    ).includes(
      "T"
    )
      ? new Date(
          value
        )
      : new Date(
          `${value}T12:00:00`
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

function isDateOverdue(
  value
) {
  if (!value) {
    return false;
  }

  const date =
    String(
      value
    ).includes(
      "T"
    )
      ? new Date(
          value
        )
      : new Date(
          `${value}T23:59:59`
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  return (
    date <
    new Date()
  );
}

function isTaskOverdue(
  task
) {
  if (
    !task.due_date ||
    COMPLETED_TASK_STATUSES.includes(
      normaliseStatus(
        task.status
      )
    )
  ) {
    return false;
  }

  return isDateOverdue(
    task.due_date
  );
}

function sortTasks(
  firstTask,
  secondTask
) {
  const firstCompleted =
    COMPLETED_TASK_STATUSES.includes(
      normaliseStatus(
        firstTask.status
      )
    );

  const secondCompleted =
    COMPLETED_TASK_STATUSES.includes(
      normaliseStatus(
        secondTask.status
      )
    );

  if (
    firstCompleted !==
    secondCompleted
  ) {
    return firstCompleted
      ? 1
      : -1;
  }

  const firstDate =
    firstTask.due_date ||
    "9999-12-31";

  const secondDate =
    secondTask.due_date ||
    "9999-12-31";

  return firstDate.localeCompare(
    secondDate
  );
}

function getDeliveryRisk(
  project,
  metrics
) {
  if (
    normaliseStatus(
      project.status
    ) ===
    "completed"
  ) {
    return "No risk";
  }

  if (
    metrics.overdueTasks >
      0 ||
    metrics.blockedTasks >
      1 ||
    isDateOverdue(
      project.due_date
    )
  ) {
    return "High";
  }

  if (
    metrics.blockedTasks ===
      1 ||
    (
      metrics.totalTasks >
        0 &&
      metrics.progress <
        30
    )
  ) {
    return "Medium";
  }

  if (
    metrics.totalTasks ===
    0
  ) {
    return "Not assessed";
  }

  return "Low";
}

function buildProjectRecommendations(
  project,
  metrics
) {
  const recommendations =
    [];

  if (
    metrics.totalTasks ===
    0
  ) {
    recommendations.push(
      "No delivery tasks are currently linked to this project."
    );
  }

  if (
    metrics.overdueTasks >
    0
  ) {
    recommendations.push(
      `Review the ${metrics.overdueTasks} overdue task${
        metrics.overdueTasks ===
        1
          ? ""
          : "s"
      } and confirm the delivery dates.`
    );
  }

  if (
    metrics.blockedTasks >
    0
  ) {
    recommendations.push(
      `Review the ${metrics.blockedTasks} blocked task${
        metrics.blockedTasks ===
        1
          ? ""
          : "s"
      } affecting delivery.`
    );
  }

  if (
    !project.due_date
  ) {
    recommendations.push(
      "Add a project due date so delivery risk can be tracked."
    );
  }

  if (
    !project.customer_id
  ) {
    recommendations.push(
      "Link the project to a customer for a complete business history."
    );
  }

  if (
    metrics.progress ===
      100 &&
    normaliseStatus(
      project.status
    ) ===
      "completed"
  ) {
    recommendations.push(
      "The project is complete and ready for invoicing and customer handover."
    );
  }

  if (
    recommendations.length ===
    0
  ) {
    recommendations.push(
      "The project is progressing normally. Continue monitoring delivery dates."
    );
  }

  return recommendations.slice(
    0,
    5
  );
}

function getVisibilityLabel(
  access
) {
  if (
    access.canViewAll
  ) {
    return "All organisation projects";
  }

  if (
    access.canViewTeam
  ) {
    return "Team projects";
  }

  if (
    access.canViewOwn
  ) {
    return "Own projects";
  }

  return "Restricted";
}

// =========================================================
// INLINE FORM / TABLE STYLES
//
// These deliberately use the same restrained font sizing
// as the rest of the SaiNal One workspace. We can move
// them into the CSS module during the final UI sweep.
// =========================================================

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
};

const fieldLabelStyle = {
  fontSize: "13px",
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  minHeight: "42px",
  border:
    "1px solid #d8dee8",
  borderRadius: "8px",
  padding:
    "9px 11px",
  fontSize: "14px",
  fontFamily: "inherit",
  background:
    "#ffffff",
};

const emptyStateStyle = {
  padding: "30px 20px",
  textAlign: "center",
  fontSize: "14px",
};

const tableStyle = {
  width: "100%",
  borderCollapse:
    "collapse",
  fontSize: "14px",
};

const tableHeaderStyle = {
  padding:
    "12px 14px",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: 700,
  borderBottom:
    "1px solid #e5e7eb",
};

const tableCellStyle = {
  padding:
    "14px",
  verticalAlign:
    "top",
  borderBottom:
    "1px solid #eef1f5",
};

const tableDescriptionStyle = {
  marginTop: "4px",
  fontSize: "12px",
  opacity: 0.72,
  maxWidth: "420px",
};

const overdueTextStyle = {
  fontWeight: 700,
};

"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import styles from "./departments.module.css";

const INITIAL_FORM_DATA = {
  name: "",
  code: "",
  description: "",
  parent_department_id: "",
  manager_id: "",
  status: "Active",
};

const STATUS_OPTIONS = [
  "Active",
  "Inactive",
  "Archived",
];

export default function DepartmentsPage() {
  const [departments, setDepartments] =
    useState([]);

  const [employees, setEmployees] =
    useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
  ] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [
    editingDepartmentId,
    setEditingDepartmentId,
  ] = useState(null);

  const [formData, setFormData] =
    useState(INITIAL_FORM_DATA);

  const [searchValue, setSearchValue] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [
    hierarchyFilter,
    setHierarchyFilter,
  ] = useState("All");

  useEffect(() => {
    fetchWorkspace();
  }, []);

  async function fetchWorkspace() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(
        "/api/departments",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load departments."
        );
      }

      setDepartments(
        Array.isArray(data.departments)
          ? data.departments
          : []
      );

      setEmployees(
        Array.isArray(data.employees)
          ? data.employees
          : []
      );

      setCurrentEmployee(
        data.currentEmployee || null
      );
    } catch (error) {
      console.error(
        "Department workspace loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to load departments."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } =
      event.target;

    setFormData((current) => ({
      ...current,
      [name]:
        name === "code"
          ? value.toUpperCase()
          : value,
    }));
  }

  function openCreateForm() {
    setEditingDepartmentId(null);
    setFormData(INITIAL_FORM_DATA);
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openEditForm(department) {
    setEditingDepartmentId(
      department.id
    );

    setFormData({
      name: department.name || "",
      code: department.code || "",
      description:
        department.description || "",
      parent_department_id:
        department.parent_department_id ||
        "",
      manager_id:
        department.manager_id || "",
      status:
        department.status || "Active",
    });

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeForm() {
    setEditingDepartmentId(null);
    setFormData(INITIAL_FORM_DATA);
    setShowForm(false);
  }

  async function saveDepartment(event) {
    event.preventDefault();

    if (!formData.name.trim()) {
      alert(
        "Please enter the department name."
      );
      return;
    }

    if (!formData.code.trim()) {
      alert(
        "Please enter the department code."
      );
      return;
    }

    try {
      setSaving(true);

      const endpoint =
        editingDepartmentId
          ? `/api/departments/${editingDepartmentId}`
          : "/api/departments";

      const method =
        editingDepartmentId
          ? "PATCH"
          : "POST";

      const response = await fetch(
        endpoint,
        {
          method,
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            formData
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save department."
        );
      }

      const wasEditing = Boolean(
        editingDepartmentId
      );

      closeForm();
      await fetchWorkspace();

      alert(
        wasEditing
          ? "Department updated successfully."
          : "Department created successfully."
      );
    } catch (error) {
      console.error(
        "Department save error:",
        error
      );

      alert(
        error.message ||
          "Unable to save department."
      );
    } finally {
      setSaving(false);
    }
  }

  async function archiveDepartment(
    department
  ) {
    const confirmed = window.confirm(
      `Archive ${department.name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/departments/${department.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to archive department."
        );
      }

      await fetchWorkspace();

      alert(
        data.message ||
          "Department archived successfully."
      );
    } catch (error) {
      console.error(
        "Department archive error:",
        error
      );

      alert(
        error.message ||
          "Unable to archive department."
      );
    }
  }

  const filteredDepartments =
    useMemo(() => {
      const search =
        searchValue
          .trim()
          .toLowerCase();

      return departments.filter(
        (department) => {
          const matchesSearch =
            !search ||
            [
              department.name,
              department.code,
              department.description,
              department.manager
                ?.full_name,
              department.parent_department
                ?.name,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(search)
            );

          const matchesStatus =
            statusFilter === "All" ||
            department.status ===
              statusFilter;

          const matchesHierarchy =
            hierarchyFilter === "All" ||
            (hierarchyFilter ===
              "Top level" &&
              !department.parent_department_id) ||
            (hierarchyFilter ===
              "Child departments" &&
              Boolean(
                department.parent_department_id
              ));

          return (
            matchesSearch &&
            matchesStatus &&
            matchesHierarchy
          );
        }
      );
    }, [
      departments,
      searchValue,
      statusFilter,
      hierarchyFilter,
    ]);

  const activeDepartments =
    departments.filter(
      (department) =>
        department.status === "Active"
    ).length;

  const managedDepartments =
    departments.filter(
      (department) =>
        Boolean(department.manager_id)
    ).length;

  const childDepartments =
    departments.filter(
      (department) =>
        Boolean(
          department.parent_department_id
        )
    ).length;

  const totalEmployees =
    departments.reduce(
      (total, department) =>
        total +
        Number(
          department.employee_count || 0
        ),
      0
    );

  const canManage = Boolean(
    currentEmployee
      ?.is_organization_owner
  );

  const availableParents =
    departments.filter(
      (department) =>
        department.id !==
          editingDepartmentId &&
        department.status !==
          "Archived"
    );

  const availableManagers =
    employees.filter(
      (employee) =>
        employee.is_active &&
        employee.employment_status !==
          "Inactive" &&
        employee.employment_status !==
          "Left"
    );

  return (
    <ProtectedRoute>
      <AppLayout
        title="Departments"
        description="Manage organisation structure, department managers and reporting hierarchy."
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
                Administration
              </span>

              <h2>
                Department management
              </h2>

              <p>
                Design the organisation
                hierarchy, assign department
                managers and group employees
                into operational teams.
              </p>
            </div>

            {canManage && (
              <button
                type="button"
                className={
                  styles.primaryButton
                }
                onClick={
                  showForm
                    ? closeForm
                    : openCreateForm
                }
              >
                <span>
                  {showForm ? "×" : "+"}
                </span>

                {showForm
                  ? "Close form"
                  : "Add department"}
              </button>
            )}
          </section>

          {!canManage &&
            !loading && (
              <section
                className={
                  styles.noticePanel
                }
              >
                <strong>
                  Read-only access
                </strong>

                <p>
                  Only the organisation
                  owner can create, edit or
                  archive departments at
                  this stage.
                </p>
              </section>
            )}

          {showForm &&
            canManage && (
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
                      {editingDepartmentId
                        ? "Edit department"
                        : "Create department"}
                    </h3>

                    <p>
                      Configure the
                      department identity,
                      manager and position in
                      the organisation
                      hierarchy.
                    </p>
                  </div>
                </div>

                <form
                  className={
                    styles.departmentForm
                  }
                  onSubmit={
                    saveDepartment
                  }
                >
                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <FormField
                      label="Department name"
                      name="name"
                      value={
                        formData.name
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: Sales"
                      required
                    />

                    <FormField
                      label="Department code"
                      name="code"
                      value={
                        formData.code
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: SALES"
                      required
                    />

                    <SelectField
                      label="Parent department"
                      name="parent_department_id"
                      value={
                        formData.parent_department_id
                      }
                      onChange={
                        handleChange
                      }
                    >
                      <option value="">
                        Top-level department
                      </option>

                      {availableParents.map(
                        (department) => (
                          <option
                            key={
                              department.id
                            }
                            value={
                              department.id
                            }
                          >
                            {department.name} (
                            {department.code})
                          </option>
                        )
                      )}
                    </SelectField>

                    <SelectField
                      label="Department manager"
                      name="manager_id"
                      value={
                        formData.manager_id
                      }
                      onChange={
                        handleChange
                      }
                    >
                      <option value="">
                        No manager assigned
                      </option>

                      {availableManagers.map(
                        (employee) => (
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
                    </SelectField>

                    <SelectField
                      label="Status"
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
                    </SelectField>

                    <FormField
                      label="Description"
                      name="description"
                      value={
                        formData.description
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Describe the department's responsibilities and purpose"
                      textarea
                      rows={5}
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
                      onClick={closeForm}
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
                        ? "Saving department..."
                        : editingDepartmentId
                          ? "Update department"
                          : "Create department"}
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
              icon="▦"
              label="Departments"
              value={
                departments.length
              }
              detail="All department records"
              tone="gold"
            />

            <SummaryCard
              icon="✓"
              label="Active"
              value={
                activeDepartments
              }
              detail="Operational departments"
              tone="green"
            />

            <SummaryCard
              icon="◉"
              label="With manager"
              value={
                managedDepartments
              }
              detail="Manager assigned"
              tone="blue"
            />

            <SummaryCard
              icon="⌁"
              label="Employees"
              value={totalEmployees}
              detail="Assigned to departments"
              tone="purple"
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
                value={searchValue}
                onChange={(event) =>
                  setSearchValue(
                    event.target.value
                  )
                }
                placeholder="Search department, code, manager or parent..."
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

              <select
                className={
                  styles.filterSelect
                }
                value={hierarchyFilter}
                onChange={(event) =>
                  setHierarchyFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All hierarchy levels
                </option>

                <option value="Top level">
                  Top-level departments
                </option>

                <option value="Child departments">
                  Child departments
                </option>
              </select>
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
                  Unable to load departments
                </strong>

                <p>{errorMessage}</p>
              </div>

              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  fetchWorkspace
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
                    Organisation structure
                  </h3>

                  <p>
                    Review department
                    hierarchy, managers,
                    employee allocation and
                    operational status.
                  </p>
                </div>

                <div
                  className={
                    styles.tableHeadingMeta
                  }
                >
                  <span
                    className={
                      styles.hierarchyCount
                    }
                  >
                    {childDepartments} child
                    department
                    {childDepartments === 1
                      ? ""
                      : "s"}
                  </span>

                  <span
                    className={
                      styles.resultCount
                    }
                  >
                    {
                      filteredDepartments.length
                    }{" "}
                    result
                    {filteredDepartments.length ===
                    1
                      ? ""
                      : "s"}
                  </span>
                </div>
              </div>

              {filteredDepartments.length ===
              0 ? (
                <EmptyState
                  canManage={canManage}
                  hasDepartments={
                    departments.length > 0
                  }
                  onCreate={
                    openCreateForm
                  }
                />
              ) : (
                <div
                  className={
                    styles.departmentGrid
                  }
                >
                  {filteredDepartments.map(
                    (department) => (
                      <DepartmentCard
                        key={
                          department.id
                        }
                        department={
                          department
                        }
                        canManage={
                          canManage
                        }
                        onEdit={() =>
                          openEditForm(
                            department
                          )
                        }
                        onArchive={() =>
                          archiveDepartment(
                            department
                          )
                        }
                      />
                    )
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function DepartmentCard({
  department,
  canManage,
  onEdit,
  onArchive,
}) {
  const statusClass =
    department.status === "Active"
      ? styles.statusGreen
      : department.status === "Inactive"
        ? styles.statusAmber
        : styles.statusNeutral;

  return (
    <article
      className={
        styles.departmentCard
      }
    >
      <div
        className={
          styles.departmentCardHeader
        }
      >
        <span
          className={
            styles.departmentIcon
          }
          aria-hidden="true"
        >
          ▦
        </span>

        <span
          className={`${styles.statusBadge} ${statusClass}`}
        >
          {department.status}
        </span>
      </div>

      <div
        className={
          styles.departmentIdentity
        }
      >
        <span
          className={
            styles.departmentCode
          }
        >
          {department.code}
        </span>

        <h3>{department.name}</h3>

        <p>
          {department.description ||
            "No department description has been added."}
        </p>
      </div>

      <div
        className={
          styles.departmentDetails
        }
      >
        <DetailRow
          label="Manager"
          value={
            department.manager
              ?.full_name ||
            "Not assigned"
          }
        />

        <DetailRow
          label="Parent"
          value={
            department.parent_department
              ?.name ||
            "Top level"
          }
        />

        <DetailRow
          label="Employees"
          value={`${department.employee_count || 0}`}
          strong
        />
      </div>

      {canManage && (
        <div
          className={
            styles.cardActions
          }
        >
          <button
            type="button"
            className={
              styles.openButton
            }
            onClick={onEdit}
          >
            Edit department
          </button>

          {department.status !==
            "Archived" && (
            <button
              type="button"
              className={
                styles.archiveButton
              }
              onClick={onArchive}
            >
              Archive
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function DetailRow({
  label,
  value,
  strong = false,
}) {
  return (
    <div
      className={styles.detailRow}
    >
      <span>{label}</span>

      {strong ? (
        <strong>{value}</strong>
      ) : (
        <p>{value}</p>
      )}
    </div>
  );
}

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
        {required ? " *" : ""}
      </span>

      {textarea ? (
        <textarea
          name={name}
          rows={rows}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
        />
      ) : (
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  children,
}) {
  return (
    <label
      className={styles.field}
    >
      <span>{label}</span>

      <select
        name={name}
        value={value}
        onChange={onChange}
      >
        {children}
      </select>
    </label>
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

      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function EmptyState({
  canManage,
  hasDepartments,
  onCreate,
}) {
  return (
    <div
      className={styles.emptyState}
    >
      <span
        className={styles.emptyIcon}
      >
        ▦
      </span>

      <h3>
        {hasDepartments
          ? "No matching departments"
          : "No departments yet"}
      </h3>

      <p>
        {hasDepartments
          ? "Try changing the search or filters."
          : "Create the first department to begin building the organisation structure."}
      </p>

      {canManage &&
        !hasDepartments && (
          <button
            type="button"
            className={
              styles.primaryButton
            }
            onClick={onCreate}
          >
            Add department
          </button>
        )}
    </div>
  );
}

function LoadingState() {
  return (
    <section
      className={
        styles.loadingGrid
      }
    >
      {Array.from({
        length: 4,
      }).map((_, index) => (
        <div
          key={index}
          className={
            styles.loadingCard
          }
        />
      ))}
    </section>
  );
}

function capitalise(value) {
  const text = String(value || "");

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}

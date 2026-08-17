"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";

import styles from "./employees.module.css";

// =========================================================
// DEFAULT FORM
// =========================================================

const EMPTY_EMPLOYEE_FORM = {
  full_name: "",
  email: "",
  employee_number: "",
  phone: "",
  job_title: "",
  department_id: "",
  manager_id: "",
  backup_employee_id: "",
  employment_type: "Employee",
  employment_status: "Active",
  availability_status: "Available",
  start_date: "",
  role_ids: [],
};

// =========================================================
// OPTIONS
// =========================================================

const EMPLOYMENT_TYPES = [
  "Employee",
  "Contractor",
  "Temporary",
  "Intern",
];

const EMPLOYMENT_STATUSES = [
  "Active",
  "On Leave",
  "Inactive",
];

const AVAILABILITY_STATUSES = [
  "Available",
  "Busy",
  "Unavailable",
];

// =========================================================
// PAGE
// =========================================================

export default function EmployeesPage() {
  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    departments,
    setDepartments,
  ] = useState([]);

  const [
    roles,
    setRoles,
  ] = useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
  ] = useState(null);

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
    search,
    setSearch,
  ] = useState("");

  const [
    departmentFilter,
    setDepartmentFilter,
  ] = useState("all");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    showAddEmployee,
    setShowAddEmployee,
  ] = useState(false);

  const [
    formData,
    setFormData,
  ] = useState(
    EMPTY_EMPLOYEE_FORM
  );

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response =
        await fetch(
          "/api/employees",
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load employees."
        );
      }

      setEmployees(
        Array.isArray(
          data.employees
        )
          ? data.employees
          : []
      );

      setDepartments(
        Array.isArray(
          data.departments
        )
          ? data.departments
          : []
      );

      setRoles(
        Array.isArray(
          data.roles
        )
          ? data.roles
          : []
      );

      setCurrentEmployee(
        data.currentEmployee ||
          null
      );
    } catch (error) {
      console.error(
        "Employees loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to load employees."
      );
    } finally {
      setLoading(false);
    }
  }

  // =======================================================
  // FILTERING
  // =======================================================

  const filteredEmployees =
    useMemo(() => {
      const searchValue =
        search
          .trim()
          .toLowerCase();

      return employees.filter(
        (employee) => {
          const matchesSearch =
            !searchValue ||
            [
              employee.full_name,
              employee.email,
              employee.employee_number,
              employee.job_title,
              employee.department
                ?.name,
            ]
              .filter(Boolean)
              .some((value) =>
                String(value)
                  .toLowerCase()
                  .includes(
                    searchValue
                  )
              );

          const matchesDepartment =
            departmentFilter ===
              "all" ||
            String(
              employee.department_id ||
                ""
            ) ===
              String(
                departmentFilter
              );

          const employeeStatus =
            employee.is_active ===
            false
              ? "inactive"
              : String(
                  employee.employment_status ||
                    "Active"
                )
                  .trim()
                  .toLowerCase();

          const matchesStatus =
            statusFilter ===
              "all" ||
            employeeStatus ===
              statusFilter;

          return (
            matchesSearch &&
            matchesDepartment &&
            matchesStatus
          );
        }
      );
    }, [
      employees,
      search,
      departmentFilter,
      statusFilter,
    ]);

  // =======================================================
  // METRICS
  // =======================================================

  const metrics =
    useMemo(() => {
      const active =
        employees.filter(
          (employee) =>
            employee.is_active !==
              false &&
            String(
              employee.employment_status ||
                ""
            )
              .trim()
              .toLowerCase() !==
              "inactive"
        ).length;

      const available =
        employees.filter(
          (employee) =>
            employee.is_active !==
              false &&
            String(
              employee.availability_status ||
                ""
            )
              .trim()
              .toLowerCase() ===
              "available"
        ).length;

      const usedDepartments =
        new Set(
          employees
            .filter(
              (employee) =>
                employee.department_id
            )
            .map(
              (employee) =>
                employee.department_id
            )
        ).size;

      return {
        total:
          employees.length,

        active,

        available,

        departments:
          usedDepartments,
      };
    }, [
      employees,
    ]);

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
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  }

  function toggleRole(
    roleId
  ) {
    setFormData(
      (current) => {
        const selected =
          current.role_ids.includes(
            roleId
          );

        return {
          ...current,

          role_ids:
            selected
              ? current.role_ids.filter(
                  (id) =>
                    id !== roleId
                )
              : [
                  ...current.role_ids,
                  roleId,
                ],
        };
      }
    );
  }

  function closeEmployeeForm() {
    if (saving) {
      return;
    }

    setShowAddEmployee(
      false
    );

    setFormData({
      ...EMPTY_EMPLOYEE_FORM,
      role_ids: [],
    });
  }

  // =======================================================
  // CREATE EMPLOYEE
  // =======================================================

  async function createEmployee(
    event
  ) {
    event.preventDefault();

    if (
      !formData.full_name.trim()
    ) {
      alert(
        "Employee name is required."
      );

      return;
    }

    if (
      !formData.email.trim()
    ) {
      alert(
        "Employee email is required."
      );

      return;
    }

    if (
      !formData.employee_number.trim()
    ) {
      alert(
        "Employee number is required."
      );

      return;
    }

    try {
      setSaving(true);

      const response =
        await fetch(
          "/api/employees",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                full_name:
                  formData.full_name,

                email:
                  formData.email,

                employee_number:
                  formData.employee_number,

                phone:
                  formData.phone ||
                  null,

                job_title:
                  formData.job_title ||
                  null,

                department_id:
                  formData.department_id ||
                  null,

                manager_id:
                  formData.manager_id ||
                  null,

                backup_employee_id:
                  formData.backup_employee_id ||
                  null,

                employment_type:
                  formData.employment_type,

                employment_status:
                  formData.employment_status,

                availability_status:
                  formData.availability_status,

                start_date:
                  formData.start_date ||
                  null,

                role_ids:
                  formData.role_ids,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create employee."
        );
      }

      closeEmployeeForm();

      await loadEmployees();

      alert(
        data.message ||
          "Employee created successfully."
      );
    } catch (error) {
      console.error(
        "Employee creation error:",
        error
      );

      alert(
        error.message ||
          "Unable to create employee."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // ACCESS
  // =======================================================

  const canManageEmployees =
    Boolean(
      currentEmployee
        ?.is_organization_owner
    );

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Team Management"
        description="Manage the people responsible for delivering customer work across SaiNal One."
      >
        <div
          className={
            styles.page
          }
        >
          {/* ===============================================
              HERO
          =============================================== */}

          <section
            className={
              styles.hero
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                TEAM MANAGEMENT
              </span>

              <h2>
                Your team
              </h2>

              <p>
                Build your organisation,
                assign responsibilities
                and connect employees to
                projects, tasks and
                workflows.
              </p>
            </div>

            {canManageEmployees && (
              <button
                type="button"
                className={
                  styles.primaryButton
                }
                onClick={() =>
                  setShowAddEmployee(
                    true
                  )
                }
              >
                + Add employee
              </button>
            )}
          </section>

          {/* ===============================================
              ERROR
          =============================================== */}

          {errorMessage && (
            <section
              className={
                styles.errorPanel
              }
            >
              <div>
                <strong>
                  Unable to load team
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
                  loadEmployees
                }
              >
                Try again
              </button>
            </section>
          )}

          {/* ===============================================
              METRICS
          =============================================== */}

          <section
            className={
              styles.metricsGrid
            }
          >
            <MetricCard
              label="Total employees"
              value={
                loading
                  ? "—"
                  : metrics.total
              }
              description="People in your organisation"
            />

            <MetricCard
              label="Active"
              value={
                loading
                  ? "—"
                  : metrics.active
              }
              description="Currently active employees"
            />

            <MetricCard
              label="Available"
              value={
                loading
                  ? "—"
                  : metrics.available
              }
              description="Available for work"
            />

            <MetricCard
              label="Departments"
              value={
                loading
                  ? "—"
                  : metrics.departments
              }
              description="Departments with employees"
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
            <div
              className={
                styles.searchBox
              }
            >
              <span>
                ⌕
              </span>

              <input
                type="search"
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Search employees..."
              />
            </div>

            <select
              value={
                departmentFilter
              }
              onChange={(
                event
              ) =>
                setDepartmentFilter(
                  event.target
                    .value
                )
              }
            >
              <option value="all">
                All departments
              </option>

              {departments.map(
                (
                  department
                ) => (
                  <option
                    key={
                      department.id
                    }
                    value={
                      department.id
                    }
                  >
                    {department.name}
                  </option>
                )
              )}
            </select>

            <select
              value={
                statusFilter
              }
              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target
                    .value
                )
              }
            >
              <option value="all">
                All statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="on leave">
                On leave
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>
          </section>

          {/* ===============================================
              EMPLOYEE LIST
          =============================================== */}

          <section
            className={
              styles.teamPanel
            }
          >
            <div
              className={
                styles.panelHeader
              }
            >
              <div>
                <h3>
                  Employees
                </h3>

                <p>
                  {loading
                    ? "Loading your team..."
                    : `${filteredEmployees.length} employee${
                        filteredEmployees.length ===
                        1
                          ? ""
                          : "s"
                      } shown`}
                </p>
              </div>
            </div>

            {loading ? (
              <EmployeeLoading />
            ) : filteredEmployees.length ===
              0 ? (
              <div
                className={
                  styles.emptyState
                }
              >
                <span>
                  👥
                </span>

                <h3>
                  No employees found
                </h3>

                <p>
                  {employees.length ===
                  0
                    ? "Create your first employee to start building your team."
                    : "No employees match the current search and filters."}
                </p>

                {canManageEmployees &&
                  employees.length ===
                    0 && (
                    <button
                      type="button"
                      className={
                        styles.primaryButton
                      }
                      onClick={() =>
                        setShowAddEmployee(
                          true
                        )
                      }
                    >
                      + Add employee
                    </button>
                  )}
              </div>
            ) : (
              <div
                className={
                  styles.tableWrap
                }
              >
                <table
                  className={
                    styles.employeeTable
                  }
                >
                  <thead>
                    <tr>
                      <th>
                        Employee
                      </th>

                      <th>
                        Role
                      </th>

                      <th>
                        Department
                      </th>

                      <th>
                        Manager
                      </th>

                      <th>
                        Availability
                      </th>

                      <th>
                        Status
                      </th>

                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {filteredEmployees.map(
                      (
                        employee
                      ) => (
                        <EmployeeRow
                          key={
                            employee.id
                          }
                          employee={
                            employee
                          }
                          currentEmployee={
                            currentEmployee
                          }
                        />
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ===============================================
              ADD EMPLOYEE
          =============================================== */}

          {showAddEmployee && (
            <div
              className={
                styles.modalBackdrop
              }
              onMouseDown={(
                event
              ) => {
                if (
                  event.target ===
                  event.currentTarget
                ) {
                  closeEmployeeForm();
                }
              }}
            >
              <section
                className={
                  styles.modal
                }
              >
                <div
                  className={
                    styles.modalHeader
                  }
                >
                  <div>
                    <span
                      className={
                        styles.eyebrow
                      }
                    >
                      TEAM MEMBER
                    </span>

                    <h2>
                      Add employee
                    </h2>

                    <p>
                      Create an employee
                      record and assign
                      their organisation
                      details.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={
                      styles.closeButton
                    }
                    onClick={
                      closeEmployeeForm
                    }
                    disabled={
                      saving
                    }
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <form
                  className={
                    styles.employeeForm
                  }
                  onSubmit={
                    createEmployee
                  }
                >
                  <FormField
                    label="Full name *"
                  >
                    <input
                      type="text"
                      name="full_name"
                      value={
                        formData.full_name
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: John Smith"
                      disabled={
                        saving
                      }
                      required
                    />
                  </FormField>

                  <FormField
                    label="Employee number *"
                  >
                    <input
                      type="text"
                      name="employee_number"
                      value={
                        formData.employee_number
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: EMP-002"
                      disabled={
                        saving
                      }
                      required
                    />
                  </FormField>

                  <FormField
                    label="Email *"
                  >
                    <input
                      type="email"
                      name="email"
                      value={
                        formData.email
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="employee@company.com"
                      disabled={
                        saving
                      }
                      required
                    />
                  </FormField>

                  <FormField
                    label="Phone"
                  >
                    <input
                      type="tel"
                      name="phone"
                      value={
                        formData.phone
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="+44..."
                      disabled={
                        saving
                      }
                    />
                  </FormField>

                  <FormField
                    label="Job title"
                  >
                    <input
                      type="text"
                      name="job_title"
                      value={
                        formData.job_title
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: Sales Manager"
                      disabled={
                        saving
                      }
                    />
                  </FormField>

                  <FormField
                    label="Department"
                  >
                    <select
                      name="department_id"
                      value={
                        formData.department_id
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        saving
                      }
                    >
                      <option value="">
                        No department
                      </option>

                      {departments.map(
                        (
                          department
                        ) => (
                          <option
                            key={
                              department.id
                            }
                            value={
                              department.id
                            }
                          >
                            {
                              department.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </FormField>

                  <FormField
                    label="Manager"
                  >
                    <select
                      name="manager_id"
                      value={
                        formData.manager_id
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        saving
                      }
                    >
                      <option value="">
                        No manager
                      </option>

                      {employees
                        .filter(
                          (
                            employee
                          ) =>
                            employee.is_active !==
                            false
                        )
                        .map(
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
                              {employee.full_name ||
                                employee.email}
                            </option>
                          )
                        )}
                    </select>
                  </FormField>

                  <FormField
                    label="Backup employee"
                  >
                    <select
                      name="backup_employee_id"
                      value={
                        formData.backup_employee_id
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        saving
                      }
                    >
                      <option value="">
                        No backup
                      </option>

                      {employees
                        .filter(
                          (
                            employee
                          ) =>
                            employee.is_active !==
                            false
                        )
                        .map(
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
                              {employee.full_name ||
                                employee.email}
                            </option>
                          )
                        )}
                    </select>
                  </FormField>

                  <FormField
                    label="Employment type"
                  >
                    <select
                      name="employment_type"
                      value={
                        formData.employment_type
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        saving
                      }
                    >
                      {EMPLOYMENT_TYPES.map(
                        (
                          option
                        ) => (
                          <option
                            key={
                              option
                            }
                            value={
                              option
                            }
                          >
                            {option}
                          </option>
                        )
                      )}
                    </select>
                  </FormField>

                  <FormField
                    label="Employment status"
                  >
                    <select
                      name="employment_status"
                      value={
                        formData.employment_status
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        saving
                      }
                    >
                      {EMPLOYMENT_STATUSES.map(
                        (
                          option
                        ) => (
                          <option
                            key={
                              option
                            }
                            value={
                              option
                            }
                          >
                            {option}
                          </option>
                        )
                      )}
                    </select>
                  </FormField>

                  <FormField
                    label="Availability"
                  >
                    <select
                      name="availability_status"
                      value={
                        formData.availability_status
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        saving
                      }
                    >
                      {AVAILABILITY_STATUSES.map(
                        (
                          option
                        ) => (
                          <option
                            key={
                              option
                            }
                            value={
                              option
                            }
                          >
                            {option}
                          </option>
                        )
                      )}
                    </select>
                  </FormField>

                  <FormField
                    label="Start date"
                  >
                    <input
                      type="date"
                      name="start_date"
                      value={
                        formData.start_date
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        saving
                      }
                    />
                  </FormField>

                  <div
                    className={
                      styles.rolesField
                    }
                  >
                    <span
                      className={
                        styles.fieldLabel
                      }
                    >
                      Roles
                    </span>

                    {roles.length ===
                    0 ? (
                      <p
                        className={
                          styles.fieldHint
                        }
                      >
                        No roles have
                        been configured
                        yet.
                      </p>
                    ) : (
                      <div
                        className={
                          styles.roleOptions
                        }
                      >
                        {roles
                          .filter(
                            (
                              role
                            ) =>
                              role.is_active !==
                              false
                          )
                          .map(
                            (
                              role
                            ) => (
                              <label
                                key={
                                  role.id
                                }
                                className={
                                  styles.roleOption
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.role_ids.includes(
                                    role.id
                                  )}
                                  onChange={() =>
                                    toggleRole(
                                      role.id
                                    )
                                  }
                                  disabled={
                                    saving
                                  }
                                />

                                <span>
                                  <strong>
                                    {
                                      role.name
                                    }
                                  </strong>

                                  {role.description && (
                                    <small>
                                      {
                                        role.description
                                      }
                                    </small>
                                  )}
                                </span>
                              </label>
                            )
                          )}
                      </div>
                    )}
                  </div>

                  <div
                    className={
                      styles.formNotice
                    }
                  >
                    <strong>
                      Employee record
                      only
                    </strong>

                    <p>
                      Creating this
                      employee does not
                      automatically
                      create their login
                      account. User
                      invitations will
                      be connected in a
                      later step.
                    </p>
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
                        closeEmployeeForm
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
                        ? "Creating..."
                        : "Create employee"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// METRIC
// =========================================================

function MetricCard({
  label,
  value,
  description,
}) {
  return (
    <article
      className={
        styles.metricCard
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <p>
        {description}
      </p>
    </article>
  );
}

// =========================================================
// EMPLOYEE ROW
// =========================================================

function EmployeeRow({
  employee,
  currentEmployee,
}) {
  const roles =
    Array.isArray(
      employee.user_roles
    )
      ? employee.user_roles
          .map(
            (
              assignment
            ) =>
              assignment.role
                ?.name
          )
          .filter(Boolean)
      : [];

  const isCurrent =
    String(
      employee.id
    ) ===
    String(
      currentEmployee?.id
    );

  const isActive =
    employee.is_active !==
      false &&
    String(
      employee.employment_status ||
        ""
    )
      .trim()
      .toLowerCase() !==
      "inactive";

  return (
    <tr>
      <td>
        <div
          className={
            styles.employeeIdentity
          }
        >
          <span
            className={
              styles.avatar
            }
          >
            {getInitials(
              employee.full_name
            )}
          </span>

          <div>
            <strong>
              {employee.full_name ||
                "Unnamed employee"}

              {isCurrent && (
                <small
                  className={
                    styles.youBadge
                  }
                >
                  You
                </small>
              )}

              {employee.is_organization_owner && (
                <small
                  className={
                    styles.ownerBadge
                  }
                >
                  Owner
                </small>
              )}
            </strong>

            <span>
              {employee.email ||
                employee.employee_number ||
                "No email"}
            </span>
          </div>
        </div>
      </td>

      <td>
        <div
          className={
            styles.roleCell
          }
        >
          <strong>
            {employee.job_title ||
              "No job title"}
          </strong>

          <span>
            {roles.length > 0
              ? roles.join(", ")
              : "No role assigned"}
          </span>
        </div>
      </td>

      <td>
        {employee.department
          ?.name ||
          "—"}
      </td>

      <td>
        {employee.manager
          ?.full_name ||
          "—"}
      </td>

      <td>
        <AvailabilityBadge
          value={
            employee.availability_status
          }
        />
      </td>

      <td>
        <StatusBadge
          active={
            isActive
          }
          label={
            employee.employment_status ||
            (isActive
              ? "Active"
              : "Inactive")
          }
        />
      </td>

      <td>
        <Link
          href={`/employees/${employee.id}`}
          className={
            styles.viewLink
          }
        >
          View →
        </Link>
      </td>
    </tr>
  );
}

// =========================================================
// FORM FIELD
// =========================================================

function FormField({
  label,
  children,
}) {
  return (
    <label
      className={
        styles.formField
      }
    >
      <span
        className={
          styles.fieldLabel
        }
      >
        {label}
      </span>

      {children}
    </label>
  );
}

// =========================================================
// BADGES
// =========================================================

function AvailabilityBadge({
  value,
}) {
  const status =
    String(
      value || "Unknown"
    )
      .trim()
      .toLowerCase();

  return (
    <span
      className={`${styles.badge} ${
        status ===
        "available"
          ? styles.availableBadge
          : status ===
              "busy"
            ? styles.busyBadge
            : styles.unavailableBadge
      }`}
    >
      {value ||
        "Unknown"}
    </span>
  );
}

function StatusBadge({
  active,
  label,
}) {
  return (
    <span
      className={`${styles.badge} ${
        active
          ? styles.activeBadge
          : styles.inactiveBadge
      }`}
    >
      {label}
    </span>
  );
}

// =========================================================
// LOADING
// =========================================================

function EmployeeLoading() {
  return (
    <div
      className={
        styles.loadingList
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
    </div>
  );
}

// =========================================================
// HELPERS
// =========================================================

function getInitials(
  value
) {
  const words =
    String(
      value || "Employee"
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    words.length ===
    0
  ) {
    return "E";
  }

  if (
    words.length ===
    1
  ) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[
      words.length - 1
    ][0]
  }`.toUpperCase();
}

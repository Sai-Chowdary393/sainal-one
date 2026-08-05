"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import styles from "./employees.module.css";

const INITIAL_FORM_DATA = {
  user_id: "",
  employee_number: "",
  full_name: "",
  email: "",
  phone: "",
  job_title: "",
  department_id: "",
  manager_id: "",
  backup_employee_id: "",
  employment_type: "Employee",
  employment_status: "Active",
  availability_status:
    "Available",
  start_date: "",
  end_date: "",
  timezone: "Europe/London",
  locale: "en-GB",
  role_ids: [],
};

const EMPLOYMENT_TYPES = [
  "Owner",
  "Employee",
  "Contractor",
  "Intern",
  "Consultant",
];

const EMPLOYMENT_STATUSES = [
  "Invited",
  "Active",
  "On Leave",
  "Suspended",
  "Inactive",
  "Left",
];

const AVAILABILITY_STATUSES = [
  "Available",
  "Busy",
  "Away",
  "On Leave",
  "Unavailable",
];

export default function EmployeesPage() {
  const [employees, setEmployees] =
    useState([]);

  const [
    departments,
    setDepartments,
  ] = useState([]);

  const [roles, setRoles] =
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
    editingEmployeeId,
    setEditingEmployeeId,
  ] = useState(null);

  const [formData, setFormData] =
    useState(INITIAL_FORM_DATA);

  const [searchValue, setSearchValue] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [
    departmentFilter,
    setDepartmentFilter,
  ] = useState("All");

  useEffect(() => {
    fetchWorkspace();
  }, []);

  async function fetchWorkspace() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(
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
            "Failed to load employees."
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
        Array.isArray(data.roles)
          ? data.roles
          : []
      );

      setCurrentEmployee(
        data.currentEmployee ||
          null
      );
    } catch (error) {
      console.error(
        "Employee workspace loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to load the employee workspace."
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
      [name]: value,
    }));
  }

  function handleRoleChange(roleId) {
    setFormData((current) => {
      const alreadySelected =
        current.role_ids.includes(
          roleId
        );

      return {
        ...current,

        role_ids:
          alreadySelected
            ? current.role_ids.filter(
                (id) =>
                  id !== roleId
              )
            : [
                ...current.role_ids,
                roleId,
              ],
      };
    });
  }

  function openCreateForm() {
    setEditingEmployeeId(null);
    setFormData(
      INITIAL_FORM_DATA
    );
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openEditForm(employee) {
    setEditingEmployeeId(
      employee.id
    );

    setFormData({
      user_id:
        employee.user_id || "",

      employee_number:
        employee.employee_number ||
        "",

      full_name:
        employee.full_name || "",

      email:
        employee.email || "",

      phone:
        employee.phone || "",

      job_title:
        employee.job_title || "",

      department_id:
        employee.department_id ||
        "",

      manager_id:
        employee.manager_id || "",

      backup_employee_id:
        employee.backup_employee_id ||
        "",

      employment_type:
        employee.employment_type ||
        "Employee",

      employment_status:
        employee.employment_status ||
        "Active",

      availability_status:
        employee.availability_status ||
        "Available",

      start_date:
        employee.start_date || "",

      end_date:
        employee.end_date || "",

      timezone:
        employee.timezone ||
        "Europe/London",

      locale:
        employee.locale ||
        "en-GB",

      role_ids: Array.isArray(
        employee.user_roles
      )
        ? employee.user_roles
            .map(
              (assignment) =>
                assignment.role?.id
            )
            .filter(Boolean)
        : [],
    });

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeForm() {
    setShowForm(false);
    setEditingEmployeeId(null);
    setFormData(
      INITIAL_FORM_DATA
    );
  }

  async function saveEmployee(
    event
  ) {
    event.preventDefault();

    if (
      !formData.full_name.trim()
    ) {
      alert(
        "Please enter the employee name."
      );
      return;
    }

    if (
      !formData.email.trim()
    ) {
      alert(
        "Please enter the employee email."
      );
      return;
    }

    if (
      !formData.employee_number.trim()
    ) {
      alert(
        "Please enter the employee number."
      );
      return;
    }

    try {
      setSaving(true);

      const endpoint =
        editingEmployeeId
          ? `/api/employees/${editingEmployeeId}`
          : "/api/employees";

      const method =
        editingEmployeeId
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

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to save employee."
        );
      }

      closeForm();
      await fetchWorkspace();

      alert(
        editingEmployeeId
          ? "Employee updated successfully."
          : "Employee created successfully."
      );
    } catch (error) {
      console.error(
        "Employee save error:",
        error
      );

      alert(
        error.message ||
          "Unable to save employee."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivateEmployee(
    employee
  ) {
    const confirmed = window.confirm(
      `Deactivate ${employee.full_name}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/employees/${employee.id}`,
        {
          method: "DELETE",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to deactivate employee."
        );
      }

      await fetchWorkspace();

      alert(
        data.message ||
          "Employee deactivated successfully."
      );
    } catch (error) {
      console.error(
        "Employee deactivation error:",
        error
      );

      alert(
        error.message ||
          "Unable to deactivate employee."
      );
    }
  }

  const filteredEmployees =
    useMemo(() => {
      const search =
        searchValue
          .trim()
          .toLowerCase();

      return employees.filter(
        (employee) => {
          const matchesSearch =
            !search ||
            [
              employee.full_name,
              employee.email,
              employee.employee_number,
              employee.job_title,
              employee.department
                ?.name,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(search)
            );

          const matchesStatus =
            statusFilter ===
              "All" ||
            employee.employment_status ===
              statusFilter;

          const matchesDepartment =
            departmentFilter ===
              "All" ||
            employee.department_id ===
              departmentFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesDepartment
          );
        }
      );
    }, [
      employees,
      searchValue,
      statusFilter,
      departmentFilter,
    ]);

  const activeEmployees =
    employees.filter(
      (employee) =>
        employee.is_active &&
        employee.employment_status ===
          "Active"
    ).length;

  const onLeaveEmployees =
    employees.filter(
      (employee) =>
        employee.employment_status ===
          "On Leave" ||
        employee.availability_status ===
          "On Leave"
    ).length;

  const unlinkedEmployees =
    employees.filter(
      (employee) =>
        !employee.user_id
    ).length;

  const canManage =
    Boolean(
      currentEmployee
        ?.is_organization_owner
    );

  return (
    <ProtectedRoute>
      <AppLayout
        title="Employees"
        description="Manage people, reporting lines, departments, availability and business access."
      >
        <div
          className={styles.page}
        >
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
                Employee management
              </h2>

              <p>
                Manage employees,
                reporting relationships,
                availability, departments
                and assigned roles.
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
                  {showForm
                    ? "×"
                    : "+"}
                </span>

                {showForm
                  ? "Close form"
                  : "Add employee"}
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
                  owner can add, edit or
                  deactivate employees at
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
                      {editingEmployeeId
                        ? "Edit employee"
                        : "Create employee"}
                    </h3>

                    <p>
                      Link an existing
                      Supabase Auth user by
                      entering their user
                      UUID, or leave it
                      blank until the
                      employee receives an
                      account.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={
                    saveEmployee
                  }
                  className={
                    styles.employeeForm
                  }
                >
                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <FormField
                      label="Employee number"
                      name="employee_number"
                      value={
                        formData.employee_number
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: SN-0002"
                      required
                    />

                    <FormField
                      label="Full name"
                      name="full_name"
                      value={
                        formData.full_name
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: James Smith"
                      required
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
                      placeholder="employee@company.com"
                      required
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
                      label="Job title"
                      name="job_title"
                      value={
                        formData.job_title
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: Sales Manager"
                    />

                    <FormField
                      label="Auth User ID"
                      name="user_id"
                      value={
                        formData.user_id
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Supabase Auth user UUID"
                      disabled={
                        Boolean(
                          editingEmployeeId
                        )
                      }
                    />

                    <SelectField
                      label="Department"
                      name="department_id"
                      value={
                        formData.department_id
                      }
                      onChange={
                        handleChange
                      }
                    >
                      <option value="">
                        No department
                      </option>

                      {departments
                        .filter(
                          (
                            department
                          ) =>
                            department.status ===
                            "Active"
                        )
                        .map(
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
                              }{" "}
                              (
                              {
                                department.code
                              }
                              )
                            </option>
                          )
                        )}
                    </SelectField>

                    <SelectField
                      label="Manager"
                      name="manager_id"
                      value={
                        formData.manager_id
                      }
                      onChange={
                        handleChange
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
                            employee.id !==
                              editingEmployeeId &&
                            employee.is_active
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
                              {
                                employee.full_name
                              }
                            </option>
                          )
                        )}
                    </SelectField>

                    <SelectField
                      label="Backup employee"
                      name="backup_employee_id"
                      value={
                        formData.backup_employee_id
                      }
                      onChange={
                        handleChange
                      }
                    >
                      <option value="">
                        No backup employee
                      </option>

                      {employees
                        .filter(
                          (
                            employee
                          ) =>
                            employee.id !==
                              editingEmployeeId &&
                            employee.is_active
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
                              {
                                employee.full_name
                              }
                            </option>
                          )
                        )}
                    </SelectField>

                    <SelectField
                      label="Employment type"
                      name="employment_type"
                      value={
                        formData.employment_type
                      }
                      onChange={
                        handleChange
                      }
                    >
                      {EMPLOYMENT_TYPES.map(
                        (value) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {value}
                          </option>
                        )
                      )}
                    </SelectField>

                    <SelectField
                      label="Employment status"
                      name="employment_status"
                      value={
                        formData.employment_status
                      }
                      onChange={
                        handleChange
                      }
                    >
                      {EMPLOYMENT_STATUSES.map(
                        (value) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {value}
                          </option>
                        )
                      )}
                    </SelectField>

                    <SelectField
                      label="Availability"
                      name="availability_status"
                      value={
                        formData.availability_status
                      }
                      onChange={
                        handleChange
                      }
                    >
                      {AVAILABILITY_STATUSES.map(
                        (value) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {value}
                          </option>
                        )
                      )}
                    </SelectField>

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
                      label="End date"
                      name="end_date"
                      type="date"
                      value={
                        formData.end_date
                      }
                      onChange={
                        handleChange
                      }
                    />

                    <FormField
                      label="Timezone"
                      name="timezone"
                      value={
                        formData.timezone
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Europe/London"
                    />

                    <FormField
                      label="Locale"
                      name="locale"
                      value={
                        formData.locale
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="en-GB"
                    />

                    <div
                      className={`${styles.field} ${styles.fieldFull}`}
                    >
                      <label>
                        Assigned roles
                      </label>

                      <div
                        className={
                          styles.roleGrid
                        }
                      >
                        {roles
                          .filter(
                            (role) =>
                              role.is_active
                          )
                          .map(
                            (role) => (
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
                                    handleRoleChange(
                                      role.id
                                    )
                                  }
                                />

                                <span>
                                  <strong>
                                    {
                                      role.name
                                    }
                                  </strong>

                                  <small>
                                    {
                                      role.code
                                    }
                                  </small>
                                </span>
                              </label>
                            )
                          )}
                      </div>
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
                      className={
                        styles.primaryButton
                      }
                      disabled={
                        saving
                      }
                    >
                      {saving
                        ? "Saving employee..."
                        : editingEmployeeId
                          ? "Update employee"
                          : "Create employee"}
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
              icon="◉"
              label="Total employees"
              value={
                employees.length
              }
              detail="All employee records"
              tone="gold"
            />

            <SummaryCard
              icon="✓"
              label="Active employees"
              value={
                activeEmployees
              }
              detail="Currently active"
              tone="green"
            />

            <SummaryCard
              icon="○"
              label="On leave"
              value={
                onLeaveEmployees
              }
              detail="Currently unavailable"
              tone="blue"
            />

            <SummaryCard
              icon="⌁"
              label="Without login"
              value={
                unlinkedEmployees
              }
              detail="Not linked to Auth"
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
              <span
                aria-hidden="true"
              >
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
                placeholder="Search employee, email, department or job title..."
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
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All statuses
                </option>

                {EMPLOYMENT_STATUSES.map(
                  (value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  )
                )}
              </select>

              <select
                className={
                  styles.filterSelect
                }
                value={
                  departmentFilter
                }
                onChange={(event) =>
                  setDepartmentFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All departments
                </option>

                {departments.map(
                  (department) => (
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
                  Unable to load employees
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
                    Employee directory
                  </h3>

                  <p>
                    Review reporting lines,
                    departments,
                    availability and assigned
                    roles.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {
                    filteredEmployees.length
                  }{" "}
                  result
                  {filteredEmployees.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredEmployees.length ===
              0 ? (
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
                    ◉
                  </span>

                  <h3>
                    No employees found
                  </h3>

                  <p>
                    No employee records
                    match the current search
                    and filters.
                  </p>
                </div>
              ) : (
                <div
                  className={
                    styles.tableWrapper
                  }
                >
                  <table
                    className={
                      styles.employeeTable
                    }
                  >
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Job title</th>
                        <th>Manager</th>
                        <th>Roles</th>
                        <th>Status</th>
                        <th>
                          Availability
                        </th>
                        <th
                          aria-label="Actions"
                        />
                      </tr>
                    </thead>

                    <tbody>
                      {filteredEmployees.map(
                        (employee) => (
                          <tr
                            key={
                              employee.id
                            }
                          >
                            <td>
                              <div
                                className={
                                  styles.employeeIdentity
                                }
                              >
                                <span
                                  className={
                                    styles.employeeAvatar
                                  }
                                >
                                  {getInitials(
                                    employee.full_name
                                  )}
                                </span>

                                <div
                                  className={
                                    styles.employeeIdentityCopy
                                  }
                                >
                                  <strong>
                                    {
                                      employee.full_name
                                    }
                                  </strong>

                                  <small>
                                    {employee.employee_number ||
                                      "No employee number"}
                                    {" · "}
                                    {employee.email}
                                  </small>
                                </div>
                              </div>
                            </td>

                            <td>
                              {employee.department
                                ?.name ||
                                "Not assigned"}
                            </td>

                            <td>
                              {employee.job_title ||
                                "Not provided"}
                            </td>

                            <td>
                              {employee.manager
                                ?.full_name ||
                                "No manager"}
                            </td>

                            <td>
                              <div
                                className={
                                  styles.roleBadges
                                }
                              >
                                {Array.isArray(
                                  employee.user_roles
                                ) &&
                                employee.user_roles
                                  .length >
                                  0 ? (
                                  employee.user_roles.map(
                                    (
                                      assignment
                                    ) => (
                                      <span
                                        key={
                                          assignment.id
                                        }
                                        className={
                                          styles.roleBadge
                                        }
                                      >
                                        {assignment
                                          .role
                                          ?.name ||
                                          "Role"}
                                      </span>
                                    )
                                  )
                                ) : (
                                  <span
                                    className={
                                      styles.emptyValue
                                    }
                                  >
                                    No role
                                  </span>
                                )}
                              </div>
                            </td>

                            <td>
                              <StatusBadge
                                value={
                                  employee.employment_status
                                }
                              />
                            </td>

                            <td>
                              <StatusBadge
                                value={
                                  employee.availability_status
                                }
                              />
                            </td>

                            <td>
                              {canManage && (
                                <div
                                  className={
                                    styles.actionGroup
                                  }
                                >
                                  <button
                                    type="button"
                                    className={
                                      styles.openButton
                                    }
                                    onClick={() =>
                                      openEditForm(
                                        employee
                                      )
                                    }
                                  >
                                    Edit
                                  </button>

                                  {!employee.is_organization_owner &&
                                    employee.is_active && (
                                      <button
                                        type="button"
                                        className={
                                          styles.deleteButton
                                        }
                                        onClick={() =>
                                          deactivateEmployee(
                                            employee
                                          )
                                        }
                                      >
                                        Deactivate
                                      </button>
                                    )}
                                </div>
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
  disabled = false,
}) {
  return (
    <div
      className={styles.field}
    >
      <label
        htmlFor={`employee-${name}`}
      >
        {label}
        {required ? " *" : ""}
      </label>

      <input
        id={`employee-${name}`}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
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
    <div
      className={styles.field}
    >
      <label
        htmlFor={`employee-${name}`}
      >
        {label}
      </label>

      <select
        id={`employee-${name}`}
        name={name}
        value={value}
        onChange={onChange}
      >
        {children}
      </select>
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

      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function StatusBadge({ value }) {
  const normalized =
    String(value || "")
      .toLowerCase();

  let toneClass =
    styles.statusNeutral;

  if (
    normalized.includes(
      "active"
    ) ||
    normalized.includes(
      "available"
    )
  ) {
    toneClass =
      styles.statusGreen;
  } else if (
    normalized.includes(
      "leave"
    ) ||
    normalized.includes(
      "away"
    ) ||
    normalized.includes(
      "busy"
    )
  ) {
    toneClass =
      styles.statusAmber;
  } else if (
    normalized.includes(
      "inactive"
    ) ||
    normalized.includes(
      "left"
    ) ||
    normalized.includes(
      "suspended"
    ) ||
    normalized.includes(
      "unavailable"
    )
  ) {
    toneClass =
      styles.statusRed;
  }

  return (
    <span
      className={`${styles.statusBadge} ${toneClass}`}
    >
      {value || "Not set"}
    </span>
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

function getInitials(value = "") {
  const words = String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "EM";
  }

  if (words.length === 1) {
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

function capitalise(value) {
  const text =
    String(value || "");

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}

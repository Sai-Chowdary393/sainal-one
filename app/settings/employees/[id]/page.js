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

import AppLayout from "../../../../components/layout/AppLayout";
import ProtectedRoute from "../../../../components/ProtectedRoute";

import styles from "./employee-details.module.css";

// =========================================================
// OPTIONS
// =========================================================

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

// =========================================================
// PAGE
// =========================================================

export default function EmployeeDetailsPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const employeeId =
    params?.id;

  const [
    employee,
    setEmployee,
  ] = useState(null);

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
    deactivating,
    setDeactivating,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    editMode,
    setEditMode,
  ] = useState(false);

  const [
    formData,
    setFormData,
  ] = useState({
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
    availability_status: "Available",
    start_date: "",
    end_date: "",
    timezone: "Europe/London",
    locale: "en-GB",
    role_ids: [],
    is_active: true,
  });

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    if (!employeeId) {
      return;
    }

    loadWorkspace();
  }, [
    employeeId,
  ]);

  async function loadWorkspace() {
    try {
      setLoading(true);

      setErrorMessage("");

      const [
        employeeResponse,
        directoryResponse,
      ] =
        await Promise.all([
          fetch(
            `/api/employees/${employeeId}`,
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            "/api/employees",
            {
              cache:
                "no-store",
            }
          ),
        ]);

      const [
        employeeData,
        directoryData,
      ] =
        await Promise.all([
          employeeResponse.json(),
          directoryResponse.json(),
        ]);

      if (
        !employeeResponse.ok
      ) {
        throw new Error(
          employeeData.error ||
            "Unable to load employee."
        );
      }

      if (
        !directoryResponse.ok
      ) {
        throw new Error(
          directoryData.error ||
            "Unable to load employee directory."
        );
      }

      setEmployee(
        employeeData
      );

      setEmployees(
        Array.isArray(
          directoryData.employees
        )
          ? directoryData.employees
          : []
      );

      setDepartments(
        Array.isArray(
          directoryData.departments
        )
          ? directoryData.departments
          : []
      );

      setRoles(
        Array.isArray(
          directoryData.roles
        )
          ? directoryData.roles
          : []
      );

      setCurrentEmployee(
        directoryData.currentEmployee ||
          null
      );

      syncForm(
        employeeData
      );
    } catch (error) {
      console.error(
        "Employee workspace loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to load employee."
      );
    } finally {
      setLoading(false);
    }
  }

  // =======================================================
  // FORM SYNC
  // =======================================================

  function syncForm(
    selectedEmployee
  ) {
    setFormData({
      employee_number:
        selectedEmployee.employee_number ||
        "",

      full_name:
        selectedEmployee.full_name ||
        "",

      email:
        selectedEmployee.email ||
        "",

      phone:
        selectedEmployee.phone ||
        "",

      job_title:
        selectedEmployee.job_title ||
        "",

      department_id:
        selectedEmployee.department_id ||
        "",

      manager_id:
        selectedEmployee.manager_id ||
        "",

      backup_employee_id:
        selectedEmployee.backup_employee_id ||
        "",

      employment_type:
        selectedEmployee.employment_type ||
        "Employee",

      employment_status:
        selectedEmployee.employment_status ||
        "Active",

      availability_status:
        selectedEmployee.availability_status ||
        "Available",

      start_date:
        selectedEmployee.start_date ||
        "",

      end_date:
        selectedEmployee.end_date ||
        "",

      timezone:
        selectedEmployee.timezone ||
        "Europe/London",

      locale:
        selectedEmployee.locale ||
        "en-GB",

      role_ids:
        Array.isArray(
          selectedEmployee.user_roles
        )
          ? selectedEmployee.user_roles
              .map(
                (
                  assignment
                ) =>
                  assignment.role?.id
              )
              .filter(Boolean)
          : [],

      is_active:
        selectedEmployee.is_active !==
        false,
    });
  }

  function handleChange(
    event
  ) {
    const {
      name,
      value,
      type,
      checked,
    } =
      event.target;

    setFormData(
      (
        current
      ) => ({
        ...current,

        [name]:
          type ===
          "checkbox"
            ? checked
            : value,
      })
    );
  }

  function handleRoleChange(
    roleId
  ) {
    setFormData(
      (
        current
      ) => {
        const selected =
          current.role_ids.includes(
            roleId
          );

        return {
          ...current,

          role_ids:
            selected
              ? current.role_ids.filter(
                  (
                    id
                  ) =>
                    id !==
                    roleId
                )
              : [
                  ...current.role_ids,
                  roleId,
                ],
        };
      }
    );
  }

  function cancelEdit() {
    if (
      employee
    ) {
      syncForm(
        employee
      );
    }

    setEditMode(
      false
    );
  }

  // =======================================================
  // SAVE
  // =======================================================

  async function saveEmployee(
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
          `/api/employees/${employeeId}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                employee_number:
                  formData.employee_number,

                full_name:
                  formData.full_name,

                email:
                  formData.email,

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

                end_date:
                  formData.end_date ||
                  null,

                timezone:
                  formData.timezone,

                locale:
                  formData.locale,

                role_ids:
                  formData.role_ids,

                is_active:
                  formData.is_active,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to update employee."
        );
      }

      await loadWorkspace();

      setEditMode(
        false
      );

      alert(
        data.message ||
          "Employee updated successfully."
      );
    } catch (error) {
      console.error(
        "Employee update error:",
        error
      );

      alert(
        error.message ||
          "Unable to update employee."
      );
    } finally {
      setSaving(false);
    }
  }

  // =======================================================
  // DEACTIVATE
  // =======================================================

  async function deactivateEmployee() {
    const confirmed =
      window.confirm(
        `Deactivate ${employee.full_name}?`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setDeactivating(
        true
      );

      const response =
        await fetch(
          `/api/employees/${employeeId}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to deactivate employee."
        );
      }

      alert(
        data.message ||
          "Employee deactivated successfully."
      );

      router.push(
        "/settings/employees"
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
    } finally {
      setDeactivating(
        false
      );
    }
  }

  // =======================================================
  // DERIVED
  // =======================================================

  const canManage =
    Boolean(
      currentEmployee
        ?.is_organization_owner
    );

  const selectedRoles =
    useMemo(() => {
      if (
        !employee
      ) {
        return [];
      }

      return Array.isArray(
        employee.user_roles
      )
        ? employee.user_roles
            .map(
              (
                assignment
              ) =>
                assignment.role
            )
            .filter(Boolean)
        : [];
    }, [
      employee,
    ]);

  const manager =
    employee?.manager ||
    null;

  const backupEmployee =
    employee?.backup_employee ||
    null;

  const department =
    employee?.department ||
    null;

  const isCurrentEmployee =
    String(
      currentEmployee?.id ||
        ""
    ) ===
    String(
      employee?.id ||
        ""
    );

  // =======================================================
  // LOADING
  // =======================================================

  if (
    loading
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Employee Workspace"
          description="Loading employee information."
        >
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // ERROR
  // =======================================================

  if (
    errorMessage &&
    !employee
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Employee Workspace"
          description="Review employee information and organisation access."
        >
          <section
            className={
              styles.errorPanel
            }
          >
            <strong>
              Unable to load employee
            </strong>

            <p>
              {errorMessage}
            </p>

            <button
              type="button"
              className={
                styles.secondaryButton
              }
              onClick={
                loadWorkspace
              }
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // NOT FOUND
  // =======================================================

  if (
    !employee
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Employee Workspace"
          description="Review employee information and organisation access."
        >
          <section
            className={
              styles.emptyState
            }
          >
            <h2>
              Employee not found
            </h2>

            <p>
              This employee may have
              been removed or you may
              not have access.
            </p>

            <Link
              href="/settings/employees"
              className={
                styles.primaryButton
              }
            >
              Back to employees
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          employee.full_name ||
          "Employee"
        }
        description="Manage employee profile, reporting line, availability and access."
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
            <div
              className={
                styles.identityBlock
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
                <Link
                  href="/settings/employees"
                  className={
                    styles.backLink
                  }
                >
                  ← Back to employees
                </Link>

                <span
                  className={
                    styles.eyebrow
                  }
                >
                  Employee workspace
                </span>

                <h2>
                  {employee.full_name}
                </h2>

                <p>
                  {employee.job_title ||
                    "No job title assigned"}
                </p>

                <div
                  className={
                    styles.badges
                  }
                >
                  <StatusBadge
                    value={
                      employee.employment_status
                    }
                  />

                  <StatusBadge
                    value={
                      employee.availability_status
                    }
                  />

                  {employee.is_organization_owner && (
                    <span
                      className={
                        styles.ownerBadge
                      }
                    >
                      Organisation Owner
                    </span>
                  )}

                  {isCurrentEmployee && (
                    <span
                      className={
                        styles.youBadge
                      }
                    >
                      You
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div
              className={
                styles.heroActions
              }
            >
              {canManage &&
                !editMode && (
                  <button
                    type="button"
                    className={
                      styles.secondaryButton
                    }
                    onClick={() =>
                      setEditMode(
                        true
                      )
                    }
                  >
                    Edit employee
                  </button>
                )}

              {canManage &&
                !employee.is_organization_owner &&
                employee.is_active && (
                  <button
                    type="button"
                    className={
                      styles.dangerButton
                    }
                    disabled={
                      deactivating
                    }
                    onClick={
                      deactivateEmployee
                    }
                  >
                    {deactivating
                      ? "Deactivating..."
                      : "Deactivate"}
                  </button>
                )}
            </div>
          </section>

          {/* ===============================================
              EDIT MODE
          =============================================== */}

          {editMode ? (
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
                    Edit employee
                  </h3>

                  <p>
                    Update profile,
                    reporting line,
                    availability and
                    assigned access.
                  </p>
                </div>
              </div>

              <form
                className={
                  styles.editForm
                }
                onSubmit={
                  saveEmployee
                }
              >
                <FormField
                  label="Employee number"
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
                    disabled={
                      saving
                    }
                    required
                  />
                </FormField>

                <FormField
                  label="Full name"
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
                    disabled={
                      saving
                    }
                    required
                  />
                </FormField>

                <FormField
                  label="Email"
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
                            {department.name}
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
                          item
                        ) =>
                          item.id !==
                            employee.id &&
                          item.is_active
                      )
                      .map(
                        (
                          item
                        ) => (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {item.full_name}
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
                      No backup employee
                    </option>

                    {employees
                      .filter(
                        (
                          item
                        ) =>
                          item.id !==
                            employee.id &&
                          item.is_active
                      )
                      .map(
                        (
                          item
                        ) => (
                          <option
                            key={
                              item.id
                            }
                            value={
                              item.id
                            }
                          >
                            {item.full_name}
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

                <FormField
                  label="End date"
                >
                  <input
                    type="date"
                    name="end_date"
                    value={
                      formData.end_date
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      saving
                    }
                  />
                </FormField>

                <FormField
                  label="Timezone"
                >
                  <input
                    type="text"
                    name="timezone"
                    value={
                      formData.timezone
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      saving
                    }
                  />
                </FormField>

                <FormField
                  label="Locale"
                >
                  <input
                    type="text"
                    name="locale"
                    value={
                      formData.locale
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
                    Assigned roles
                  </span>

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
                          role.is_active
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
                                handleRoleChange(
                                  role.id
                                )
                              }
                              disabled={
                                saving
                              }
                            />

                            <span>
                              <strong>
                                {role.name}
                              </strong>

                              <small>
                                {role.code}
                              </small>
                            </span>
                          </label>
                        )
                      )}
                  </div>
                </div>

                {!employee.is_organization_owner && (
                  <label
                    className={
                      styles.activeToggle
                    }
                  >
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={
                        formData.is_active
                      }
                      onChange={
                        handleChange
                      }
                      disabled={
                        saving
                      }
                    />

                    <span>
                      <strong>
                        Active employee
                      </strong>

                      <small>
                        Controls whether
                        this employee can
                        remain active in
                        the organisation.
                      </small>
                    </span>
                  </label>
                )}

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
                      cancelEdit
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
                      ? "Saving..."
                      : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <>
              {/* ===========================================
                  SUMMARY
              =========================================== */}

              <section
                className={
                  styles.summaryGrid
                }
              >
                <SummaryCard
                  label="Employment"
                  value={
                    employee.employment_type ||
                    "Not set"
                  }
                  detail={
                    employee.employment_status ||
                    "No status"
                  }
                />

                <SummaryCard
                  label="Availability"
                  value={
                    employee.availability_status ||
                    "Not set"
                  }
                  detail="Current work availability"
                />

                <SummaryCard
                  label="Department"
                  value={
                    department?.name ||
                    "Not assigned"
                  }
                  detail={
                    department?.code ||
                    "No department"
                  }
                />

                <SummaryCard
                  label="Roles"
                  value={
                    selectedRoles.length
                  }
                  detail="Assigned access roles"
                />
              </section>

              {/* ===========================================
                  DETAILS
              =========================================== */}

              <section
                className={
                  styles.grid
                }
              >
                <section
                  className={
                    styles.panel
                  }
                >
                  <PanelHeader
                    title="Employee information"
                    description="Profile and contact information."
                  />

                  <div
                    className={
                      styles.detailList
                    }
                  >
                    <DetailRow
                      label="Employee number"
                      value={
                        employee.employee_number
                      }
                    />

                    <DetailRow
                      label="Full name"
                      value={
                        employee.full_name
                      }
                    />

                    <DetailRow
                      label="Email"
                      value={
                        employee.email
                      }
                    />

                    <DetailRow
                      label="Phone"
                      value={
                        employee.phone
                      }
                    />

                    <DetailRow
                      label="Job title"
                      value={
                        employee.job_title
                      }
                    />

                    <DetailRow
                      label="Auth account"
                      value={
                        employee.user_id
                          ? "Linked"
                          : "Not linked"
                      }
                    />
                  </div>
                </section>

                <section
                  className={
                    styles.panel
                  }
                >
                  <PanelHeader
                    title="Organisation"
                    description="Reporting line and organisation placement."
                  />

                  <div
                    className={
                      styles.detailList
                    }
                  >
                    <DetailRow
                      label="Department"
                      value={
                        department?.name
                      }
                    />

                    <DetailRow
                      label="Manager"
                      value={
                        manager?.full_name
                      }
                    />

                    <DetailRow
                      label="Backup employee"
                      value={
                        backupEmployee?.full_name
                      }
                    />

                    <DetailRow
                      label="Employment type"
                      value={
                        employee.employment_type
                      }
                    />

                    <DetailRow
                      label="Employment status"
                      value={
                        employee.employment_status
                      }
                    />

                    <DetailRow
                      label="Availability"
                      value={
                        employee.availability_status
                      }
                    />
                  </div>
                </section>

                <section
                  className={
                    styles.panel
                  }
                >
                  <PanelHeader
                    title="Employment dates"
                    description="Employment timing and locale."
                  />

                  <div
                    className={
                      styles.detailList
                    }
                  >
                    <DetailRow
                      label="Start date"
                      value={formatDate(
                        employee.start_date
                      )}
                    />

                    <DetailRow
                      label="End date"
                      value={formatDate(
                        employee.end_date
                      )}
                    />

                    <DetailRow
                      label="Timezone"
                      value={
                        employee.timezone
                      }
                    />

                    <DetailRow
                      label="Locale"
                      value={
                        employee.locale
                      }
                    />

                    <DetailRow
                      label="Active"
                      value={
                        employee.is_active
                          ? "Yes"
                          : "No"
                      }
                    />
                  </div>
                </section>

                <section
                  className={
                    styles.panel
                  }
                >
                  <PanelHeader
                    title="Roles & access"
                    description="Business roles assigned to this employee."
                  />

                  {selectedRoles.length ===
                  0 ? (
                    <div
                      className={
                        styles.emptyRoles
                      }
                    >
                      No roles assigned
                    </div>
                  ) : (
                    <div
                      className={
                        styles.roleCards
                      }
                    >
                      {selectedRoles.map(
                        (
                          role
                        ) => (
                          <div
                            key={
                              role.id
                            }
                            className={
                              styles.roleCard
                            }
                          >
                            <strong>
                              {role.name}
                            </strong>

                            <span>
                              {role.code}
                            </span>

                            {role.description && (
                              <p>
                                {role.description}
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </section>
              </section>
            </>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// COMPONENTS
// =========================================================

function PanelHeader({
  title,
  description,
}) {
  return (
    <div
      className={
        styles.panelHeader
      }
    >
      <h3>
        {title}
      </h3>

      <p>
        {description}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
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

      <strong>
        {value ||
          "Not provided"}
      </strong>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}) {
  return (
    <article
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
    </article>
  );
}

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

function StatusBadge({
  value,
}) {
  const normalized =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  let tone =
    styles.statusNeutral;

  if (
    normalized.includes(
      "active"
    ) ||
    normalized.includes(
      "available"
    )
  ) {
    tone =
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
    tone =
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
    tone =
      styles.statusRed;
  }

  return (
    <span
      className={`${styles.statusBadge} ${tone}`}
    >
      {value ||
        "Not set"}
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
    return "EM";
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
      words.length - 1
    ][0]
  }`.toUpperCase();
}

function formatDate(
  value
) {
  if (
    !value
  ) {
    return "Not provided";
  }

  const date =
    new Date(
      `${String(
        value
      ).split("T")[0]}T12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not provided";
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

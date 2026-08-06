"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import styles from "./roles.module.css";

const INITIAL_FORM_DATA = {
  name: "",
  code: "",
  description: "",
  is_active: true,
  permission_ids: [],
};

export default function RolesPage() {
  const [roles, setRoles] =
    useState([]);

  const [permissions, setPermissions] =
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
    editingRoleId,
    setEditingRoleId,
  ] = useState(null);

  const [formData, setFormData] =
    useState(INITIAL_FORM_DATA);

  const [searchValue, setSearchValue] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [typeFilter, setTypeFilter] =
    useState("All");

  const [
    expandedModules,
    setExpandedModules,
  ] = useState({});

  useEffect(() => {
    fetchWorkspace();
  }, []);

  async function fetchWorkspace() {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(
        "/api/roles",
        {
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load roles and permissions."
        );
      }

      setRoles(
        Array.isArray(data.roles)
          ? data.roles
          : []
      );

      setPermissions(
        Array.isArray(
          data.permissions
        )
          ? data.permissions
          : []
      );

      setCurrentEmployee(
        data.currentEmployee ||
          null
      );

      const moduleState = {};

      (
        Array.isArray(
          data.permissions
        )
          ? data.permissions
          : []
      ).forEach((permission) => {
        moduleState[
          permission.module
        ] = true;
      });

      setExpandedModules(
        moduleState
      );
    } catch (error) {
      console.error(
        "Roles workspace loading error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to load roles and permissions."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setFormData((current) => ({
      ...current,

      [name]:
        type === "checkbox"
          ? checked
          : name === "code"
            ? value.toUpperCase()
            : value,
    }));
  }

  function openCreateForm() {
    setEditingRoleId(null);
    setFormData(
      INITIAL_FORM_DATA
    );
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openEditForm(role) {
    setEditingRoleId(role.id);

    setFormData({
      name: role.name || "",
      code: role.code || "",
      description:
        role.description || "",
      is_active:
        role.is_active !== false,
      permission_ids:
        Array.isArray(
          role.permission_ids
        )
          ? role.permission_ids
          : [],
    });

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeForm() {
    setEditingRoleId(null);
    setFormData(
      INITIAL_FORM_DATA
    );
    setShowForm(false);
  }

  function togglePermission(
    permissionId
  ) {
    setFormData((current) => {
      const selected =
        current.permission_ids.includes(
          permissionId
        );

      return {
        ...current,

        permission_ids: selected
          ? current.permission_ids.filter(
              (id) =>
                id !== permissionId
            )
          : [
              ...current.permission_ids,
              permissionId,
            ],
      };
    });
  }

  function toggleModule(module) {
    setExpandedModules(
      (current) => ({
        ...current,
        [module]:
          !current[module],
      })
    );
  }

  function selectModulePermissions(
    modulePermissions
  ) {
    const moduleIds =
      modulePermissions.map(
        (permission) =>
          permission.id
      );

    const allSelected =
      moduleIds.every((id) =>
        formData.permission_ids.includes(
          id
        )
      );

    setFormData((current) => {
      if (allSelected) {
        return {
          ...current,

          permission_ids:
            current.permission_ids.filter(
              (id) =>
                !moduleIds.includes(id)
            ),
        };
      }

      return {
        ...current,

        permission_ids: [
          ...new Set([
            ...current.permission_ids,
            ...moduleIds,
          ]),
        ],
      };
    });
  }

  function selectAllPermissions() {
    const allPermissionIds =
      permissions.map(
        (permission) =>
          permission.id
      );

    const allSelected =
      allPermissionIds.every((id) =>
        formData.permission_ids.includes(
          id
        )
      );

    setFormData((current) => ({
      ...current,

      permission_ids:
        allSelected
          ? []
          : allPermissionIds,
    }));
  }

  async function saveRole(event) {
    event.preventDefault();

    if (!formData.name.trim()) {
      alert(
        "Please enter the role name."
      );
      return;
    }

    if (!formData.code.trim()) {
      alert(
        "Please enter the role code."
      );
      return;
    }

    try {
      setSaving(true);

      const endpoint =
        editingRoleId
          ? `/api/roles/${editingRoleId}`
          : "/api/roles";

      const method =
        editingRoleId
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
            "Failed to save role."
        );
      }

      const wasEditing = Boolean(
        editingRoleId
      );

      closeForm();

      await fetchWorkspace();

      alert(
        wasEditing
          ? "Role and permissions updated successfully."
          : "Role created successfully."
      );
    } catch (error) {
      console.error(
        "Role save error:",
        error
      );

      alert(
        error.message ||
          "Unable to save role."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivateRole(
    role
  ) {
    const confirmed =
      window.confirm(
        `Deactivate ${role.name}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/roles/${role.id}`,
        {
          method: "DELETE",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to deactivate role."
        );
      }

      await fetchWorkspace();

      alert(
        data.message ||
          "Role deactivated successfully."
      );
    } catch (error) {
      console.error(
        "Role deactivation error:",
        error
      );

      alert(
        error.message ||
          "Unable to deactivate role."
      );
    }
  }

  const groupedPermissions =
    useMemo(() => {
      return permissions.reduce(
        (groups, permission) => {
          const module =
            permission.module ||
            "Other";

          if (!groups[module]) {
            groups[module] = [];
          }

          groups[module].push(
            permission
          );

          return groups;
        },
        {}
      );
    }, [permissions]);

  const filteredRoles =
    useMemo(() => {
      const search =
        searchValue
          .trim()
          .toLowerCase();

      return roles.filter(
        (role) => {
          const matchesSearch =
            !search ||
            [
              role.name,
              role.code,
              role.description,
              ...(role.permissions ||
                []).map(
                (permission) =>
                  permission.name
              ),
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(search)
            );

          const matchesStatus =
            statusFilter === "All" ||
            (statusFilter ===
              "Active" &&
              role.is_active) ||
            (statusFilter ===
              "Inactive" &&
              !role.is_active);

          const matchesType =
            typeFilter === "All" ||
            (typeFilter ===
              "System" &&
              role.is_system_role) ||
            (typeFilter ===
              "Custom" &&
              !role.is_system_role);

          return (
            matchesSearch &&
            matchesStatus &&
            matchesType
          );
        }
      );
    }, [
      roles,
      searchValue,
      statusFilter,
      typeFilter,
    ]);

  const activeRoles =
    roles.filter(
      (role) => role.is_active
    ).length;

  const customRoles =
    roles.filter(
      (role) =>
        !role.is_system_role
    ).length;

  const totalAssignments =
    roles.reduce(
      (total, role) =>
        total +
        Number(
          role.employee_count || 0
        ),
      0
    );

  const canManage = Boolean(
    currentEmployee
      ?.is_organization_owner
  );

  const editingRole =
    roles.find(
      (role) =>
        role.id === editingRoleId
    ) || null;

  const isProtectedOwnerRole =
    Boolean(
      editingRole
        ?.is_system_role &&
        editingRole?.code ===
          "ORG_OWNER"
    );

  const allPermissionsSelected =
    permissions.length > 0 &&
    permissions.every(
      (permission) =>
        formData.permission_ids.includes(
          permission.id
        )
    );

  return (
    <ProtectedRoute>
      <AppLayout
        title="Roles & Permissions"
        description="Configure business roles, access rights and employee responsibilities."
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
                Roles and permissions
              </h2>

              <p>
                Create configurable roles,
                control access to business
                modules and assign the right
                responsibilities to each
                employee.
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
                  ? "Close editor"
                  : "Create role"}
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
                  owner can create roles or
                  update permission
                  assignments.
                </p>
              </section>
            )}

          {showForm &&
            canManage && (
              <form
                className={
                  styles.roleEditor
                }
                onSubmit={saveRole}
              >
                <section
                  className={
                    styles.roleDetailsPanel
                  }
                >
                  <div
                    className={
                      styles.editorHeader
                    }
                  >
                    <div>
                      <span
                        className={
                          styles.editorEyebrow
                        }
                      >
                        {editingRoleId
                          ? "Edit role"
                          : "New role"}
                      </span>

                      <h3>
                        {editingRoleId
                          ? editingRole
                              ?.name ||
                            "Role details"
                          : "Create a custom role"}
                      </h3>

                      <p>
                        Define the role
                        identity and select
                        the permissions it
                        should provide.
                      </p>
                    </div>

                    {editingRole
                      ?.is_system_role && (
                      <span
                        className={
                          styles.systemBadge
                        }
                      >
                        Protected system
                        role
                      </span>
                    )}
                  </div>

                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <FormField
                      label="Role name"
                      name="name"
                      value={
                        formData.name
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: Sales Manager"
                      required
                      disabled={
                        Boolean(
                          editingRole
                            ?.is_system_role
                        )
                      }
                    />

                    <FormField
                      label="Role code"
                      name="code"
                      value={
                        formData.code
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Example: SALES_MANAGER"
                      required
                      disabled={
                        Boolean(
                          editingRole
                            ?.is_system_role
                        )
                      }
                    />

                    <FormField
                      label="Description"
                      name="description"
                      value={
                        formData.description
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Describe the responsibilities covered by this role"
                      textarea
                      rows={5}
                      fullWidth
                    />

                    <label
                      className={`${styles.activeOption} ${
                        isProtectedOwnerRole
                          ? styles.activeOptionDisabled
                          : ""
                      }`}
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
                          isProtectedOwnerRole
                        }
                      />

                      <span>
                        <strong>
                          Active role
                        </strong>

                        <small>
                          Employees can be
                          assigned this role
                          while it is active.
                        </small>
                      </span>
                    </label>
                  </div>
                </section>

                <section
                  className={
                    styles.permissionsPanel
                  }
                >
                  <div
                    className={
                      styles.permissionsHeader
                    }
                  >
                    <div>
                      <span
                        className={
                          styles.editorEyebrow
                        }
                      >
                        Access control
                      </span>

                      <h3>
                        Permission selection
                      </h3>

                      <p>
                        Select the actions
                        this role can perform
                        across SaiNal One.
                      </p>
                    </div>

                    <div
                      className={
                        styles.permissionHeaderActions
                      }
                    >
                      <span
                        className={
                          styles.selectedCount
                        }
                      >
                        {
                          formData
                            .permission_ids
                            .length
                        }{" "}
                        of{" "}
                        {
                          permissions.length
                        }{" "}
                        selected
                      </span>

                      <button
                        type="button"
                        className={
                          styles.secondaryButton
                        }
                        onClick={
                          selectAllPermissions
                        }
                        disabled={
                          isProtectedOwnerRole
                        }
                      >
                        {allPermissionsSelected
                          ? "Clear all"
                          : "Select all"}
                      </button>
                    </div>
                  </div>

                  {isProtectedOwnerRole && (
                    <div
                      className={
                        styles.protectedNotice
                      }
                    >
                      <strong>
                        Full access is
                        required
                      </strong>

                      <p>
                        The Organisation
                        Owner role must retain
                        every active
                        permission.
                      </p>
                    </div>
                  )}

                  <div
                    className={
                      styles.permissionModules
                    }
                  >
                    {Object.entries(
                      groupedPermissions
                    ).map(
                      ([
                        module,
                        modulePermissions,
                      ]) => {
                        const moduleIds =
                          modulePermissions.map(
                            (permission) =>
                              permission.id
                          );

                        const selectedCount =
                          moduleIds.filter(
                            (id) =>
                              formData.permission_ids.includes(
                                id
                              )
                          ).length;

                        const allSelected =
                          selectedCount ===
                          moduleIds.length;

                        return (
                          <section
                            key={module}
                            className={
                              styles.permissionModule
                            }
                          >
                            <button
                              type="button"
                              className={
                                styles.moduleHeader
                              }
                              onClick={() =>
                                toggleModule(
                                  module
                                )
                              }
                            >
                              <span
                                className={
                                  styles.moduleIcon
                                }
                              >
                                {getModuleIcon(
                                  module
                                )}
                              </span>

                              <span
                                className={
                                  styles.moduleHeaderCopy
                                }
                              >
                                <strong>
                                  {module}
                                </strong>

                                <small>
                                  {
                                    selectedCount
                                  }{" "}
                                  of{" "}
                                  {
                                    moduleIds.length
                                  }{" "}
                                  selected
                                </small>
                              </span>

                              <span
                                className={
                                  styles.moduleExpand
                                }
                              >
                                {expandedModules[
                                  module
                                ]
                                  ? "−"
                                  : "+"}
                              </span>
                            </button>

                            {expandedModules[
                              module
                            ] && (
                              <div
                                className={
                                  styles.permissionModuleContent
                                }
                              >
                                <div
                                  className={
                                    styles.moduleActions
                                  }
                                >
                                  <button
                                    type="button"
                                    className={
                                      styles.moduleSelectButton
                                    }
                                    onClick={() =>
                                      selectModulePermissions(
                                        modulePermissions
                                      )
                                    }
                                    disabled={
                                      isProtectedOwnerRole
                                    }
                                  >
                                    {allSelected
                                      ? "Clear module"
                                      : "Select module"}
                                  </button>
                                </div>

                                <div
                                  className={
                                    styles.permissionGrid
                                  }
                                >
                                  {modulePermissions.map(
                                    (
                                      permission
                                    ) => (
                                      <label
                                        key={
                                          permission.id
                                        }
                                        className={`${styles.permissionOption} ${
                                          formData.permission_ids.includes(
                                            permission.id
                                          )
                                            ? styles.permissionOptionSelected
                                            : ""
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={formData.permission_ids.includes(
                                            permission.id
                                          )}
                                          onChange={() =>
                                            togglePermission(
                                              permission.id
                                            )
                                          }
                                          disabled={
                                            isProtectedOwnerRole
                                          }
                                        />

                                        <span>
                                          <strong>
                                            {
                                              permission.name
                                            }
                                          </strong>

                                          <small>
                                            {
                                              permission.description
                                            }
                                          </small>

                                          <code>
                                            {
                                              permission.permission_key
                                            }
                                          </code>
                                        </span>
                                      </label>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          </section>
                        );
                      }
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
                        ? "Saving role..."
                        : editingRoleId
                          ? "Update role"
                          : "Create role"}
                    </button>
                  </div>
                </section>
              </form>
            )}

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              icon="◆"
              label="Total roles"
              value={roles.length}
              detail="All configured roles"
              tone="gold"
            />

            <SummaryCard
              icon="✓"
              label="Active roles"
              value={activeRoles}
              detail="Available for assignment"
              tone="green"
            />

            <SummaryCard
              icon="◇"
              label="Custom roles"
              value={customRoles}
              detail="Created by organisation"
              tone="blue"
            />

            <SummaryCard
              icon="◉"
              label="Assignments"
              value={totalAssignments}
              detail="Employee role assignments"
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
                placeholder="Search role, code or permission..."
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

                <option value="Active">
                  Active roles
                </option>

                <option value="Inactive">
                  Inactive roles
                </option>
              </select>

              <select
                className={
                  styles.filterSelect
                }
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All role types
                </option>

                <option value="System">
                  System roles
                </option>

                <option value="Custom">
                  Custom roles
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
                  Unable to load roles
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
                styles.rolesPanel
              }
            >
              <div
                className={
                  styles.rolesHeading
                }
              >
                <div>
                  <h3>
                    Organisation roles
                  </h3>

                  <p>
                    Review role access,
                    assigned employees and
                    permission coverage.
                  </p>
                </div>

                <span
                  className={
                    styles.resultCount
                  }
                >
                  {filteredRoles.length}{" "}
                  result
                  {filteredRoles.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {filteredRoles.length ===
              0 ? (
                <EmptyState
                  canManage={canManage}
                  hasRoles={
                    roles.length > 0
                  }
                  onCreate={
                    openCreateForm
                  }
                />
              ) : (
                <div
                  className={
                    styles.rolesGrid
                  }
                >
                  {filteredRoles.map(
                    (role) => (
                      <RoleCard
                        key={role.id}
                        role={role}
                        canManage={
                          canManage
                        }
                        onEdit={() =>
                          openEditForm(role)
                        }
                        onDeactivate={() =>
                          deactivateRole(
                            role
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

function RoleCard({
  role,
  canManage,
  onEdit,
  onDeactivate,
}) {
  return (
    <article
      className={
        styles.roleCard
      }
    >
      <div
        className={
          styles.roleCardHeader
        }
      >
        <span
          className={
            styles.roleIcon
          }
        >
          ◆
        </span>

        <div
          className={
            styles.roleBadges
          }
        >
          {role.is_system_role && (
            <span
              className={
                styles.systemBadge
              }
            >
              System
            </span>
          )}

          <span
            className={`${styles.statusBadge} ${
              role.is_active
                ? styles.statusGreen
                : styles.statusNeutral
            }`}
          >
            {role.is_active
              ? "Active"
              : "Inactive"}
          </span>
        </div>
      </div>

      <div
        className={
          styles.roleIdentity
        }
      >
        <span
          className={
            styles.roleCode
          }
        >
          {role.code}
        </span>

        <h3>{role.name}</h3>

        <p>
          {role.description ||
            "No role description has been added."}
        </p>
      </div>

      <div
        className={
          styles.roleMetrics
        }
      >
        <Metric
          label="Permissions"
          value={
            role.permission_count || 0
          }
        />

        <Metric
          label="Employees"
          value={
            role.employee_count || 0
          }
        />
      </div>

      <div
        className={
          styles.permissionPreview
        }
      >
        <span>
          Permission coverage
        </span>

        <div
          className={
            styles.permissionTags
          }
        >
          {(role.permissions || [])
            .slice(0, 5)
            .map((permission) => (
              <span
                key={permission.id}
                className={
                  styles.permissionTag
                }
              >
                {permission.name}
              </span>
            ))}

          {(role.permissions || [])
            .length > 5 && (
            <span
              className={
                styles.permissionMore
              }
            >
              +
              {(role.permissions ||
                []).length - 5}{" "}
              more
            </span>
          )}

          {(role.permissions || [])
            .length === 0 && (
            <span
              className={
                styles.emptyValue
              }
            >
              No permissions assigned
            </span>
          )}
        </div>
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
            Edit permissions
          </button>

          {!role.is_system_role &&
            role.is_active && (
              <button
                type="button"
                className={
                  styles.deactivateButton
                }
                onClick={
                  onDeactivate
                }
              >
                Deactivate
              </button>
            )}
        </div>
      )}
    </article>
  );
}

function Metric({
  label,
  value,
}) {
  return (
    <div
      className={styles.metric}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  textarea = false,
  rows = 4,
  required = false,
  disabled = false,
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
          disabled={disabled}
        />
      ) : (
        <input
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
        />
      )}
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
  hasRoles,
  onCreate,
}) {
  return (
    <div
      className={styles.emptyState}
    >
      <span
        className={
          styles.emptyIcon
        }
      >
        ◆
      </span>

      <h3>
        {hasRoles
          ? "No matching roles"
          : "No roles configured"}
      </h3>

      <p>
        {hasRoles
          ? "Try changing the current search or filters."
          : "Create a role and select the permissions employees need."}
      </p>

      {canManage && !hasRoles && (
        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={onCreate}
        >
          Create role
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
        length: 3,
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

function getModuleIcon(module) {
  const icons = {
    Administration: "⚙",
    Leads: "◎",
    Quotes: "◇",
    Proposals: "▤",
    Customers: "▣",
    Projects: "▰",
    Invoices: "£",
    "Follow-ups": "◷",
    Communication: "✉",
    Insights: "▥",
    AI: "✦",
  };

  return icons[module] || "◆";
}

function capitalise(value) {
  const text =
    String(value || "");

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}

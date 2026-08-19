"use client";

import Link from "next/link";

import useAccess from "../../hooks/useAccess";

import styles from "./layout.module.css";

// =========================================================
// QUICK ACTIONS
// =========================================================

const quickActions = [
  {
    label:
      "New Lead",

    description:
      "Add a new sales opportunity",

    href:
      "/leads?create=true",

    icon:
      "◎",

    permission:
      "leads.create",

    module:
      "Leads",
  },

  {
    label:
      "New Customer",

    description:
      "Create a customer record",

    href:
      "/customers?create=true",

    icon:
      "▣",

    permission:
      "customers.create",

    module:
      "Customers",
  },

  {
    label:
      "New Quote",

    description:
      "Prepare a customer quote",

    href:
      "/quotes?create=true",

    icon:
      "◇",

    permission:
      "quotes.create",

    module:
      "Quotes",
  },

  {
    label:
      "New Proposal",

    description:
      "Create a sales proposal",

    href:
      "/proposals?create=true",

    icon:
      "▤",

    permission:
      "proposals.create",

    module:
      "Proposals",
  },

  {
    label:
      "New Project",

    description:
      "Start a delivery project",

    href:
      "/projects?create=true",

    icon:
      "▰",

    permission:
      "projects.create",

    module:
      "Projects",
  },

  {
    label:
      "New Invoice",

    description:
      "Create a customer invoice",

    href:
      "/invoices?create=true",

    icon:
      "£",

    permission:
      "invoices.create",

    module:
      "Invoices",
  },

  {
    label:
      "New Follow-up",

    description:
      "Schedule the next action",

    href:
      "/follow-ups?create=true",

    icon:
      "◷",

    permission:
      "tasks.create",

    alternativePermissions: [
      "followups.create",
      "follow-ups.create",
    ],

    module:
      "Follow-ups",
  },
];

// =========================================================
// COMPONENT
// =========================================================

export default function QuickActionsDropdown({
  onNavigate,
}) {
  const {
    employee,
    permissions,
    loading,
  } =
    useAccess();

  const isOwner =
    Boolean(
      employee
        ?.is_organization_owner
    );

  const permissionKeys =
    (
      Array.isArray(
        permissions
      )
        ? permissions
        : []
    )
      .map(
        (
          permission
        ) =>
          typeof permission ===
          "string"
            ? permission
            : permission
                ?.permission_key
      )
      .filter(Boolean);

  // =======================================================
  // ACCESS
  // =======================================================

  function hasPermission(
    permissionKey
  ) {
    if (
      isOwner
    ) {
      return true;
    }

    return permissionKeys.includes(
      permissionKey
    );
  }

  function hasModuleCreatePermission(
    moduleName
  ) {
    if (
      isOwner
    ) {
      return true;
    }

    return (
      Array.isArray(
        permissions
      ) &&
      permissions.some(
        (
          permission
        ) => {
          if (
            typeof permission ===
            "string"
          ) {
            return false;
          }

          const module =
            String(
              permission
                ?.module ||
                ""
            )
              .trim()
              .toLowerCase();

          const action =
            String(
              permission
                ?.action ||
                ""
            )
              .trim()
              .toLowerCase();

          return (
            module ===
              String(
                moduleName ||
                  ""
              )
                .trim()
                .toLowerCase() &&
            action ===
              "create"
          );
        }
      )
    );
  }

  function canUseAction(
    action
  ) {
    if (
      isOwner
    ) {
      return true;
    }

    if (
      hasPermission(
        action.permission
      )
    ) {
      return true;
    }

    if (
      Array.isArray(
        action.alternativePermissions
      ) &&
      action.alternativePermissions.some(
        hasPermission
      )
    ) {
      return true;
    }

    return hasModuleCreatePermission(
      action.module
    );
  }

  const visibleActions =
    quickActions.filter(
      canUseAction
    );

  return (
    <div
      className={
        styles.settingsDropdown
      }
      role="menu"
      aria-label="Create new"
    >
      <div
        className={
          styles.dropdownHeader
        }
      >
        <div>
          <strong>
            Create new
          </strong>

          <p>
            Quickly add a new business
            record.
          </p>
        </div>
      </div>

      <div
        className={
          styles.settingsDropdownContent
        }
      >
        <section
          className={
            styles.settingsMenuSection
          }
        >
          <p
            className={
              styles.settingsMenuTitle
            }
          >
            Quick actions
          </p>

          {loading ? (
            <span
              className={
                styles.settingsMenuItem
              }
            >
              <span
                className={
                  styles.settingsMenuIcon
                }
              >
                …
              </span>

              <span>
                <strong>
                  Loading access
                </strong>

                <small>
                  Checking available actions
                </small>
              </span>
            </span>
          ) : visibleActions.length >
            0 ? (
            visibleActions.map(
              (
                action
              ) => (
                <Link
                  key={
                    action.label
                  }
                  href={
                    action.href
                  }
                  className={
                    styles.settingsMenuItem
                  }
                  onClick={
                    onNavigate
                  }
                  role="menuitem"
                >
                  <span
                    className={
                      styles.settingsMenuIcon
                    }
                    aria-hidden="true"
                  >
                    {
                      action.icon
                    }
                  </span>

                  <span>
                    <strong>
                      {
                        action.label
                      }
                    </strong>

                    <small>
                      {
                        action.description
                      }
                    </small>
                  </span>
                </Link>
              )
            )
          ) : (
            <div
              className={
                styles.settingsMenuItem
              }
            >
              <span
                className={
                  styles.settingsMenuIcon
                }
              >
                ◇
              </span>

              <span>
                <strong>
                  No create actions available
                </strong>

                <small>
                  Your current role has
                  read-only or restricted
                  access.
                </small>
              </span>
            </div>
          )}

          {/* ===============================================
              AI CREATE
          =============================================== */}

          {(isOwner ||
            permissionKeys.some(
              (
                permissionKey
              ) =>
                permissionKey.startsWith(
                  "ai."
                )
            )) && (
            <Link
              href="/ai-assistant"
              className={
                styles.settingsMenuItem
              }
              onClick={
                onNavigate
              }
              role="menuitem"
            >
              <span
                className={
                  styles.settingsMenuIcon
                }
                aria-hidden="true"
              >
                ✦
              </span>

              <span>
                <strong>
                  Create with AI
                </strong>

                <small>
                  Ask SaiNal AI to prepare
                  business content
                </small>
              </span>
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

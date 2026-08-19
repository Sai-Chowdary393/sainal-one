"use client";

import Link from "next/link";
import {
  usePathname,
} from "next/navigation";

import useAccess from "../../hooks/useAccess";

import styles from "./layout.module.css";

// =========================================================
// NAVIGATION
// =========================================================

const navigationGroups = [
  {
    label:
      "Workspace",

    items: [
      {
        label:
          "Dashboard",

        href:
          "/dashboard",

        icon:
          "⌂",

        alwaysVisible:
          true,
      },
    ],
  },

  {
    label:
      "CRM",

    items: [
      {
        label:
          "Leads",

        href:
          "/leads",

        icon:
          "◎",

        modules: [
          "Leads",
        ],

        prefixes: [
          "leads.",
        ],
      },

      {
        label:
          "Customers",

        href:
          "/customers",

        icon:
          "▣",

        modules: [
          "Customers",
        ],

        prefixes: [
          "customers.",
        ],
      },
    ],
  },

  {
    label:
      "Sales",

    items: [
      {
        label:
          "Quotes",

        href:
          "/quotes",

        icon:
          "◇",

        modules: [
          "Quotes",
        ],

        prefixes: [
          "quotes.",
        ],
      },

      {
        label:
          "Proposals",

        href:
          "/proposals",

        icon:
          "▤",

        modules: [
          "Proposals",
        ],

        prefixes: [
          "proposals.",
        ],
      },

      {
        label:
          "Invoices",

        href:
          "/invoices",

        icon:
          "£",

        modules: [
          "Invoices",
        ],

        prefixes: [
          "invoices.",
        ],
      },
    ],
  },

  {
    label:
      "Delivery",

    items: [
      {
        label:
          "Projects",

        href:
          "/projects",

        icon:
          "▰",

        modules: [
          "Projects",
        ],

        prefixes: [
          "projects.",
        ],
      },

      {
        label:
          "Follow-ups",

        href:
          "/follow-ups",

        icon:
          "◷",

        modules: [
          "Follow-ups",
          "Follow Ups",
          "Tasks",
        ],

        prefixes: [
          "followups.",
          "follow-ups.",
          "tasks.",
        ],
      },
    ],
  },

  {
    label:
      "Communication",

    items: [
      {
        label:
          "Emails",

        href:
          "/emails",

        icon:
          "✉",

        modules: [
          "Communication",
          "Emails",
        ],

        prefixes: [
          "emails.",
          "communication.",
        ],
      },

      {
        label:
          "AI Assistant",

        href:
          "/ai-assistant",

        icon:
          "✦",

        modules: [
          "AI",
        ],

        prefixes: [
          "ai.",
        ],
      },

      {
        label:
          "AI Business Insights",

        href:
          "/business-insights",

        icon:
          "▥",

        modules: [
          "Insights",
          "AI",
        ],

        prefixes: [
          "insights.",
          "ai.",
        ],
      },
    ],
  },

  {
    label:
      "Administration",

    items: [
      {
        label:
          "Employees",

        href:
          "/settings/employees",

        icon:
          "◉",

        modules: [
          "Administration",
        ],

        prefixes: [
          "employees.",
        ],
      },

      {
        label:
          "Departments",

        href:
          "/settings/departments",

        icon:
          "▦",

        modules: [
          "Administration",
        ],

        prefixes: [
          "departments.",
          "employees.",
        ],
      },

      {
        label:
          "Roles & Permissions",

        href:
          "/settings/roles",

        icon:
          "◆",

        modules: [
          "Administration",
        ],

        prefixes: [
          "roles.",
        ],
      },

      {
        label:
          "Workflow Builder",

        href:
          "/settings/workflows",

        icon:
          "⌘",

        modules: [
          "Workflows",
          "Administration",
        ],

        prefixes: [
          "workflows.",
        ],
      },

      {
        label:
          "Company Settings",

        href:
          "/settings",

        icon:
          "⚙",

        modules: [
          "Administration",
        ],

        prefixes: [
          "settings.",
        ],
      },
    ],
  },
];

// =========================================================
// PAGE
// =========================================================

export default function Sidebar({
  mobileOpen = false,
  collapsed = false,
  onClose,
  onToggleCollapse,
}) {
  const pathname =
    usePathname();

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

  // =======================================================
  // PERMISSION HELPERS
  // =======================================================

  function hasPermissionPrefix(
    prefixes = []
  ) {
    if (
      isOwner
    ) {
      return true;
    }

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

    return prefixes.some(
      (
        prefix
      ) =>
        permissionKeys.some(
          (
            permissionKey
          ) =>
            permissionKey.startsWith(
              prefix
            )
        )
    );
  }

  function hasModulePermission(
    modules = []
  ) {
    if (
      isOwner
    ) {
      return true;
    }

    const normalisedModules =
      modules.map(
        (
          module
        ) =>
          String(
            module
          )
            .trim()
            .toLowerCase()
      );

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

          return normalisedModules.includes(
            module
          );
        }
      )
    );
  }

  function canSeeItem(
    item
  ) {
    if (
      item.alwaysVisible
    ) {
      return true;
    }

    if (
      isOwner
    ) {
      return true;
    }

    return (
      hasPermissionPrefix(
        item.prefixes ||
          []
      ) ||
      hasModulePermission(
        item.modules ||
          []
      )
    );
  }

  // =======================================================
  // ACTIVE
  // =======================================================

  function isActive(
    href
  ) {
    if (
      href ===
      "/settings"
    ) {
      return (
        pathname ===
        "/settings"
      );
    }

    return (
      pathname ===
        href ||
      pathname.startsWith(
        `${href}/`
      )
    );
  }

  // =======================================================
  // FILTER GROUPS
  // =======================================================

  const visibleGroups =
    navigationGroups
      .map(
        (
          group
        ) => ({
          ...group,

          items:
            group.items.filter(
              canSeeItem
            ),
        })
      )
      .filter(
        (
          group
        ) =>
          group.items.length >
          0
      );

  return (
    <aside
      className={`${styles.sidebar} ${
        mobileOpen
          ? styles.sidebarOpen
          : ""
      } ${
        collapsed
          ? styles.sidebarCollapsed
          : ""
      }`}
    >
      {/* =================================================
          BRAND
      ================================================= */}

      <div
        className={
          styles.sidebarHeader
        }
      >
        <Link
          href="/dashboard"
          className={
            styles.brand
          }
          onClick={
            onClose
          }
          title={
            collapsed
              ? "SaiNal One"
              : undefined
          }
        >
          <span
            className={
              styles.brandMark
            }
          >
            SN
          </span>

          <span
            className={
              styles.brandText
            }
          >
            <strong
              className={
                styles.brandName
              }
            >
              SaiNal One
            </strong>

            <small
              className={
                styles.brandSubtitle
              }
            >
              Business Operating System
            </small>
          </span>
        </Link>

        <button
          type="button"
          className={
            styles.mobileCloseButton
          }
          onClick={
            onClose
          }
          aria-label="Close navigation"
        >
          ×
        </button>
      </div>

      {/* =================================================
          COLLAPSE
      ================================================= */}

      <button
        type="button"
        className={
          styles.sidebarCollapseButton
        }
        onClick={
          onToggleCollapse
        }
        aria-label={
          collapsed
            ? "Expand sidebar"
            : "Collapse sidebar"
        }
        title={
          collapsed
            ? "Expand sidebar"
            : "Collapse sidebar"
        }
      >
        {collapsed
          ? "›"
          : "‹"}
      </button>

      {/* =================================================
          NAVIGATION
      ================================================= */}

      <nav
        className={
          styles.navigation
        }
        aria-label="Primary navigation"
      >
        {loading ? (
          <div
            className={
              styles.navigationGroup
            }
          >
            <p
              className={
                styles.navigationLabel
              }
            >
              Workspace
            </p>

            <div
              className={
                styles.navigationItems
              }
            >
              <Link
                href="/dashboard"
                onClick={
                  onClose
                }
                className={
                  styles.navigationLink
                }
              >
                <span
                  className={
                    styles.navigationIcon
                  }
                >
                  ⌂
                </span>

                <span
                  className={
                    styles.navigationText
                  }
                >
                  Dashboard
                </span>
              </Link>
            </div>
          </div>
        ) : (
          visibleGroups.map(
            (
              group
            ) => (
              <div
                key={
                  group.label
                }
                className={
                  styles.navigationGroup
                }
              >
                <p
                  className={
                    styles.navigationLabel
                  }
                >
                  {
                    group.label
                  }
                </p>

                <div
                  className={
                    styles.navigationItems
                  }
                >
                  {group.items.map(
                    (
                      item
                    ) => {
                      const active =
                        isActive(
                          item.href
                        );

                      return (
                        <Link
                          key={
                            item.href
                          }
                          href={
                            item.href
                          }
                          onClick={
                            onClose
                          }
                          title={
                            collapsed
                              ? item.label
                              : undefined
                          }
                          aria-current={
                            active
                              ? "page"
                              : undefined
                          }
                          className={`${styles.navigationLink} ${
                            active
                              ? styles.navigationLinkActive
                              : ""
                          }`}
                        >
                          <span
                            className={
                              styles.navigationIcon
                            }
                            aria-hidden="true"
                          >
                            {
                              item.icon
                            }
                          </span>

                          <span
                            className={
                              styles.navigationText
                            }
                          >
                            {
                              item.label
                            }
                          </span>
                        </Link>
                      );
                    }
                  )}
                </div>
              </div>
            )
          )
        )}
      </nav>

      {/* =================================================
          FOOTER
      ================================================= */}

      <div
        className={
          styles.sidebarFooter
        }
      >
        <div
          className={
            styles.sidebarPlan
          }
        >
          <span
            className={
              styles.planBadge
            }
          >
            SaiNal One
          </span>

          <strong>
            Growing Business
          </strong>

          <small>
            Manage your business from one
            place.
          </small>
        </div>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";

import useAccess from "../../hooks/useAccess";

import styles from "./layout.module.css";

// =========================================================
// SETTINGS MENU
// =========================================================

const settingsSections = [
  {
    title:
      "Administration",

    items: [
      {
        label:
          "Company Profile",

        description:
          "Business details and configuration",

        href:
          "/settings",

        icon:
          "▣",

        prefixes: [
          "settings.",
        ],
      },

      {
        label:
          "Employees",

        description:
          "Employees and invitations",

        href:
          "/settings/employees",

        icon:
          "◎",

        prefixes: [
          "employees.",
        ],
      },

      {
        label:
          "Departments",

        description:
          "Organisation structure",

        href:
          "/settings/departments",

        icon:
          "▦",

        prefixes: [
          "departments.",
          "employees.",
        ],
      },

      {
        label:
          "Roles & Permissions",

        description:
          "Control access levels",

        href:
          "/settings/roles",

        icon:
          "◆",

        prefixes: [
          "roles.",
        ],
      },

      {
        label:
          "Workflow Builder",

        description:
          "Business workflow automation",

        href:
          "/settings/workflows",

        icon:
          "⌘",

        prefixes: [
          "workflows.",
        ],
      },
    ],
  },

  {
    title:
      "Account",

    items: [
      {
        label:
          "My Profile",

        description:
          "Personal employee profile",

        href:
          "/profile",

        icon:
          "◉",

        alwaysVisible:
          true,
      },

      {
        label:
          "Notifications",

        description:
          "Notification preferences",

        href:
          "/settings?section=notifications",

        icon:
          "◌",

        alwaysVisible:
          true,
      },

      {
        label:
          "Appearance",

        description:
          "Display preferences",

        href:
          "/settings?section=appearance",

        icon:
          "◐",

        alwaysVisible:
          true,
      },

      {
        label:
          "Help & Support",

        description:
          "Get product assistance",

        href:
          "/settings?section=help",

        icon:
          "?",

        alwaysVisible:
          true,
      },
    ],
  },
];

// =========================================================
// COMPONENT
// =========================================================

export default function SettingsDropdown({
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
      item.prefixes ||
      []
    ).some(
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

  const visibleSections =
    settingsSections
      .map(
        (
          section
        ) => ({
          ...section,

          items:
            section.items.filter(
              canSeeItem
            ),
        })
      )
      .filter(
        (
          section
        ) =>
          section.items.length >
          0
      );

  return (
    <div
      className={
        styles.settingsDropdown
      }
    >
      <div
        className={
          styles.dropdownHeader
        }
      >
        <div>
          <strong>
            Settings
          </strong>

          <p>
            Manage your account and
            organisation.
          </p>
        </div>
      </div>

      <div
        className={
          styles.settingsDropdownContent
        }
      >
        {loading ? (
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
              Settings
            </p>

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
                …
              </span>

              <span>
                <strong>
                  Loading access
                </strong>

                <small>
                  Checking available
                  settings
                </small>
              </span>
            </div>
          </section>
        ) : (
          visibleSections.map(
            (
              section
            ) => (
              <section
                className={
                  styles.settingsMenuSection
                }
                key={
                  section.title
                }
              >
                <p
                  className={
                    styles.settingsMenuTitle
                  }
                >
                  {
                    section.title
                  }
                </p>

                {section.items.map(
                  (
                    item
                  ) => (
                    <Link
                      key={
                        item.label
                      }
                      href={
                        item.href
                      }
                      className={
                        styles.settingsMenuItem
                      }
                      onClick={
                        onNavigate
                      }
                    >
                      <span
                        className={
                          styles.settingsMenuIcon
                        }
                        aria-hidden="true"
                      >
                        {
                          item.icon
                        }
                      </span>

                      <span>
                        <strong>
                          {
                            item.label
                          }
                        </strong>

                        <small>
                          {
                            item.description
                          }
                        </small>
                      </span>
                    </Link>
                  )
                )}
              </section>
            )
          )
        )}
      </div>
    </div>
  );
}

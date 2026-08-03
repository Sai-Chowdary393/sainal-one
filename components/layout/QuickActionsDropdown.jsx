"use client";

import Link from "next/link";
import styles from "./layout.module.css";

const quickActions = [
  {
    label: "New Lead",
    description:
      "Add a new sales opportunity",
    href: "/leads?create=true",
    icon: "◎",
  },
  {
    label: "New Customer",
    description:
      "Create a customer record",
    href: "/customers?create=true",
    icon: "▣",
  },
  {
    label: "New Quote",
    description:
      "Prepare a customer quote",
    href: "/quotes?create=true",
    icon: "◇",
  },
  {
    label: "New Proposal",
    description:
      "Create a sales proposal",
    href: "/proposals?create=true",
    icon: "▤",
  },
  {
    label: "New Project",
    description:
      "Start a delivery project",
    href: "/projects?create=true",
    icon: "▰",
  },
  {
    label: "New Invoice",
    description:
      "Create and send an invoice",
    href: "/invoices?create=true",
    icon: "£",
  },
  {
    label: "New Follow-up",
    description:
      "Schedule the next action",
    href: "/follow-ups?create=true",
    icon: "◷",
  },
];

export default function QuickActionsDropdown({
  onNavigate,
}) {
  return (
    <div
      className={styles.settingsDropdown}
      role="menu"
      aria-label="Create new"
    >
      <div className={styles.dropdownHeader}>
        <div>
          <strong>Create new</strong>

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

          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={
                styles.settingsMenuItem
              }
              onClick={onNavigate}
              role="menuitem"
            >
              <span
                className={
                  styles.settingsMenuIcon
                }
                aria-hidden="true"
              >
                {action.icon}
              </span>

              <span>
                <strong>
                  {action.label}
                </strong>

                <small>
                  {action.description}
                </small>
              </span>
            </Link>
          ))}
        </section>

        <section
          className={
            styles.settingsMenuSection
          }
        >
          <Link
            href="/ai-assistant"
            className={
              styles.settingsMenuItem
            }
            onClick={onNavigate}
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
        </section>
      </div>
    </div>
  );
}

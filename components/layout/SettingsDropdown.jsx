"use client";

import Link from "next/link";
import styles from "./layout.module.css";

const settingsSections = [
  {
    title: "Administration",
    items: [
      {
        label: "Company Profile",
        description: "Business details and branding",
        href: "/settings?section=company",
        icon: "▣",
      },
      {
        label: "AI Business Profile",
        description: "AI context and preferences",
        href: "/settings?section=ai",
        icon: "✦",
      },
      {
        label: "Team Members",
        description: "Users and invitations",
        href: "/settings?section=team",
        icon: "◎",
      },
      {
        label: "Roles & Permissions",
        description: "Control access levels",
        href: "/settings?section=roles",
        icon: "⌘",
      },
    ],
  },
  {
    title: "Business",
    items: [
      {
        label: "Billing & Subscription",
        description: "Plan and payment settings",
        href: "/settings?section=billing",
        icon: "£",
      },
      {
        label: "Integrations",
        description: "Connect business tools",
        href: "/settings?section=integrations",
        icon: "⇄",
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Preferences",
        description: "Language, time and display",
        href: "/settings?section=preferences",
        icon: "⚙",
      },
      {
        label: "Security",
        description: "Authentication and access",
        href: "/settings?section=security",
        icon: "◇",
      },
    ],
  },
];

export default function SettingsDropdown({ onNavigate }) {
  return (
    <div className={styles.settingsDropdown}>
      <div className={styles.dropdownHeader}>
        <div>
          <strong>Settings</strong>
          <p>Manage your organisation and system.</p>
        </div>
      </div>

      <div className={styles.settingsDropdownContent}>
        {settingsSections.map((section) => (
          <section
            className={styles.settingsMenuSection}
            key={section.title}
          >
            <p className={styles.settingsMenuTitle}>{section.title}</p>

            {section.items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={styles.settingsMenuItem}
                onClick={onNavigate}
              >
                <span className={styles.settingsMenuIcon}>
                  {item.icon}
                </span>

                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

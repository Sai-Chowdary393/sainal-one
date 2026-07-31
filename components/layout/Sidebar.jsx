"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";

const navigationGroups = [
  {
    label: "Workspace",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: "⌂",
      },
    ],
  },
  {
    label: "CRM",
    items: [
      {
        label: "Leads",
        href: "/leads",
        icon: "◎",
      },
      {
        label: "Customers",
        href: "/customers",
        icon: "▣",
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        label: "Quotes",
        href: "/quotes",
        icon: "◇",
      },
      {
        label: "Proposals",
        href: "/proposals",
        icon: "▤",
      },
      {
        label: "Invoices",
        href: "/invoices",
        icon: "£",
      },
    ],
  },
  {
    label: "Delivery",
    items: [
      {
        label: "Projects",
        href: "/projects",
        icon: "▰",
      },
      {
        label: "Follow-ups",
        href: "/follow-ups",
        icon: "◷",
      },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        label: "Emails",
        href: "/emails",
        icon: "✉",
      },
      {
        label: "AI Assistant",
        href: "/ai-assistant",
        icon: "✦",
      },
    ],
  },
];

export default function Sidebar({ mobileOpen = false, onClose }) {
  const pathname = usePathname();

  function isActive(href) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside
      className={`${styles.sidebar} ${
        mobileOpen ? styles.sidebarOpen : ""
      }`}
    >
      <div className={styles.sidebarHeader}>
        <Link
          href="/dashboard"
          className={styles.brand}
          onClick={onClose}
        >
          <span className={styles.brandMark}>SN</span>

          <span>
            <strong className={styles.brandName}>SaiNal One</strong>
            <small className={styles.brandSubtitle}>
              Business Operating System
            </small>
          </span>
        </Link>

        <button
          type="button"
          className={styles.mobileCloseButton}
          onClick={onClose}
          aria-label="Close navigation"
        >
          ×
        </button>
      </div>

      <nav className={styles.navigation}>
        {navigationGroups.map((group) => (
          <div className={styles.navigationGroup} key={group.label}>
            <p className={styles.navigationLabel}>{group.label}</p>

            <div className={styles.navigationItems}>
              {group.items.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`${styles.navigationLink} ${
                      active ? styles.navigationLinkActive : ""
                    }`}
                  >
                    <span className={styles.navigationIcon}>
                      {item.icon}
                    </span>

                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.sidebarPlan}>
          <span className={styles.planBadge}>SaiNal One</span>
          <strong>Growing Business</strong>
          <small>Manage everything in one place.</small>
        </div>
      </div>
    </aside>
  );
}

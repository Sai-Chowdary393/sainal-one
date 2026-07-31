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
      {
        label: "AI Business Insights",
        href: "/business-insights",
        icon: "▥",
      },
    ],
  },
];

export default function Sidebar({
  mobileOpen = false,
  collapsed = false,
  onClose,
  onToggleCollapse,
}) {
  const pathname = usePathname();

  const isActive = (href) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      className={`${styles.sidebar} ${
        mobileOpen ? styles.sidebarOpen : ""
      } ${collapsed ? styles.sidebarCollapsed : ""}`}
    >
      <div className={styles.sidebarHeader}>
        <Link
          href="/dashboard"
          className={styles.brand}
          onClick={onClose}
          title={collapsed ? "SaiNal One" : undefined}
        >
          <span className={styles.brandMark}>SN</span>

          <span className={styles.brandText}>
            <strong className={styles.brandName}>
              SaiNal One
            </strong>

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

      <button
        type="button"
        className={styles.sidebarCollapseButton}
        onClick={onToggleCollapse}
        aria-label={
          collapsed ? "Expand sidebar" : "Collapse sidebar"
        }
        title={
          collapsed ? "Expand sidebar" : "Collapse sidebar"
        }
      >
        {collapsed ? "›" : "‹"}
      </button>

      <nav
        className={styles.navigation}
        aria-label="Primary navigation"
      >
        {navigationGroups.map((group) => (
          <div
            key={group.label}
            className={styles.navigationGroup}
          >
            <p className={styles.navigationLabel}>
              {group.label}
            </p>

            <div className={styles.navigationItems}>
              {group.items.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`${styles.navigationLink} ${
                      active
                        ? styles.navigationLinkActive
                        : ""
                    }`}
                  >
                    <span
                      className={styles.navigationIcon}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>

                    <span className={styles.navigationText}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.sidebarPlan}>
          <span className={styles.planBadge}>
            SaiNal One
          </span>

          <strong>Growing Business</strong>

          <small>
            Manage your business from one place.
          </small>
        </div>
      </div>
    </aside>
  );
}

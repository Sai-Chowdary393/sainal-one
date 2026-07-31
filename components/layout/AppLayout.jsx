"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import styles from "./layout.module.css";

const SIDEBAR_STORAGE_KEY = "sainal-one-sidebar-collapsed";

export default function AppLayout({
  children,
  title = "Dashboard",
  description = "",
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarStateLoaded, setSidebarStateLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedState = window.localStorage.getItem(
        SIDEBAR_STORAGE_KEY
      );

      setSidebarCollapsed(savedState === "true");
    } catch (error) {
      console.error("Unable to load sidebar preference:", error);
    } finally {
      setSidebarStateLoaded(true);
    }
  }, []);

  function closeMobileSidebar() {
    setMobileSidebarOpen(false);
  }

  function openMobileSidebar() {
    setMobileSidebarOpen(true);
  }

  function toggleSidebar() {
    setSidebarCollapsed((currentValue) => {
      const nextValue = !currentValue;

      try {
        window.localStorage.setItem(
          SIDEBAR_STORAGE_KEY,
          String(nextValue)
        );
      } catch (error) {
        console.error("Unable to save sidebar preference:", error);
      }

      return nextValue;
    });
  }

  return (
    <div
      className={`${styles.appShell} ${
        sidebarCollapsed && sidebarStateLoaded
          ? styles.appShellCollapsed
          : ""
      }`}
    >
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        collapsed={sidebarCollapsed && sidebarStateLoaded}
        onClose={closeMobileSidebar}
        onToggleCollapse={toggleSidebar}
      />

      {mobileSidebarOpen && (
        <button
          type="button"
          className={styles.mobileOverlay}
          onClick={closeMobileSidebar}
          aria-label="Close navigation"
        />
      )}

      <div className={styles.workspace}>
        <Topbar
          title={title}
          description={description}
          onOpenSidebar={openMobileSidebar}
        />

        <main className={styles.pageContent}>{children}</main>
      </div>
    </div>
  );
}

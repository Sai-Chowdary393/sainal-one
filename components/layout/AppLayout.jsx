"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import styles from "./layout.module.css";

export default function AppLayout({
  children,
  title = "Dashboard",
  description = "",
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  function closeMobileSidebar() {
    setMobileSidebarOpen(false);
  }

  return (
    <div className={styles.appShell}>
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onClose={closeMobileSidebar}
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
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className={styles.pageContent}>{children}</main>
      </div>
    </div>
  );
}

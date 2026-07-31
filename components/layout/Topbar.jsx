"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import SettingsDropdown from "./SettingsDropdown";
import UserDropdown from "./UserDropdown";
import styles from "./layout.module.css";

export default function Topbar({
  title,
  description,
  onOpenSidebar,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [userName, setUserName] = useState("SaiNal One User");
  const [userEmail, setUserEmail] = useState("");

  const settingsRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target)
      ) {
        setSettingsOpen(false);
      }

      if (userRef.current && !userRef.current.contains(event.target)) {
        setUserOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  async function loadCurrentUser() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      setUserEmail(user.email || "");

      setUserName(
        user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "SaiNal One User"
      );
    } catch (error) {
      console.error("Unable to load current user:", error);
    }
  }

  function closeDropdowns() {
    setSettingsOpen(false);
    setUserOpen(false);
  }

  function openSettings() {
    setSettingsOpen((current) => !current);
    setUserOpen(false);
  }

  function openUserMenu() {
    setUserOpen((current) => !current);
    setSettingsOpen(false);
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarTitleSection}>
        <button
          type="button"
          className={styles.mobileMenuButton}
          onClick={onOpenSidebar}
          aria-label="Open navigation"
        >
          ☰
        </button>

        <div>
          <h1>{title}</h1>

          {description && <p>{description}</p>}
        </div>
      </div>

      <div className={styles.topbarActions}>
        <label className={styles.searchContainer}>
          <span className={styles.searchIcon}>⌕</span>

          <input
            type="search"
            placeholder="Search SaiNal One..."
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            aria-label="Search SaiNal One"
          />

          <span className={styles.searchShortcut}>⌘ K</span>
        </label>

        <button
          type="button"
          className={styles.quickActionButton}
          title="Create new"
          aria-label="Create new"
        >
          +
        </button>

        <button
          type="button"
          className={styles.iconButton}
          title="Notifications"
          aria-label="Notifications"
        >
          ◌
          <span className={styles.notificationDot} />
        </button>

        <div className={styles.dropdownWrapper} ref={settingsRef}>
          <button
            type="button"
            className={`${styles.iconButton} ${
              settingsOpen ? styles.actionButtonActive : ""
            }`}
            onClick={openSettings}
            aria-label="Open settings"
            aria-expanded={settingsOpen}
          >
            ⚙
          </button>

          {settingsOpen && (
            <SettingsDropdown onNavigate={closeDropdowns} />
          )}
        </div>

        <div className={styles.dropdownWrapper} ref={userRef}>
          <button
            type="button"
            className={`${styles.profileButton} ${
              userOpen ? styles.actionButtonActive : ""
            }`}
            onClick={openUserMenu}
            aria-label="Open user menu"
            aria-expanded={userOpen}
          >
            <span className={styles.smallAvatar}>
              {getInitials(userName || userEmail)}
            </span>

            <span className={styles.profileButtonText}>
              <strong>{userName}</strong>
              <small>Owner</small>
            </span>

            <span className={styles.profileChevron}>⌄</span>
          </button>

          {userOpen && (
            <UserDropdown
              userName={userName}
              userEmail={userEmail}
              onNavigate={closeDropdowns}
            />
          )}
        </div>
      </div>
    </header>
  );
}

function getInitials(value = "") {
  const cleanedValue = value.trim();

  if (!cleanedValue) {
    return "SN";
  }

  const parts = cleanedValue.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import SettingsDropdown from "./SettingsDropdown";
import UserDropdown from "./UserDropdown";
import QuickActionsDropdown from "./QuickActionsDropdown";
import styles from "./layout.module.css";

export default function Topbar({
  title,
  description,
  onOpenSidebar,
}) {
  const [quickActionsOpen, setQuickActionsOpen] =
    useState(false);

  const [settingsOpen, setSettingsOpen] =
    useState(false);

  const [userOpen, setUserOpen] =
    useState(false);

  const [searchValue, setSearchValue] =
    useState("");

  const [userName, setUserName] =
    useState("SaiNal One User");

  const [userEmail, setUserEmail] =
    useState("");

  const quickActionsRef = useRef(null);
  const settingsRef = useRef(null);
  const userRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        quickActionsRef.current &&
        !quickActionsRef.current.contains(event.target)
      ) {
        setQuickActionsOpen(false);
      }

      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target)
      ) {
        setSettingsOpen(false);
      }

      if (
        userRef.current &&
        !userRef.current.contains(event.target)
      ) {
        setUserOpen(false);
      }
    }

    function handleKeyboardShortcut(event) {
      const isSearchShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k";

      if (isSearchShortcut) {
        event.preventDefault();

        searchInputRef.current?.focus();

        setQuickActionsOpen(false);
        setSettingsOpen(false);
        setUserOpen(false);
      }

      if (event.key === "Escape") {
        closeDropdowns();
        searchInputRef.current?.blur();
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleKeyboardShortcut
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleKeyboardShortcut
      );
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
      console.error(
        "Unable to load current user:",
        error
      );
    }
  }

  function closeDropdowns() {
    setQuickActionsOpen(false);
    setSettingsOpen(false);
    setUserOpen(false);
  }

  function openQuickActions() {
    setQuickActionsOpen(
      (currentValue) => !currentValue
    );

    setSettingsOpen(false);
    setUserOpen(false);
  }

  function openSettings() {
    setSettingsOpen(
      (currentValue) => !currentValue
    );

    setQuickActionsOpen(false);
    setUserOpen(false);
  }

  function openUserMenu() {
    setUserOpen(
      (currentValue) => !currentValue
    );

    setQuickActionsOpen(false);
    setSettingsOpen(false);
  }

  function handleSearchChange(event) {
    setSearchValue(event.target.value);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();

    const cleanSearchValue =
      searchValue.trim();

    if (!cleanSearchValue) {
      return;
    }

    /*
     * Global search results will be connected later.
     * This currently keeps the UI ready without
     * sending the user to a broken route.
     */
    console.log(
      "SaiNal One search:",
      cleanSearchValue
    );
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

          {description && (
            <p>{description}</p>
          )}
        </div>
      </div>

      <div className={styles.topbarActions}>
        <form
          className={styles.searchContainer}
          onSubmit={handleSearchSubmit}
          role="search"
        >
          <span
            className={styles.searchIcon}
            aria-hidden="true"
          >
            ⌕
          </span>

          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search SaiNal One..."
            value={searchValue}
            onChange={handleSearchChange}
            aria-label="Search SaiNal One"
          />

          <span
            className={styles.searchShortcut}
            aria-hidden="true"
          >
            ⌘ K
          </span>
        </form>

        <div
          className={styles.dropdownWrapper}
          ref={quickActionsRef}
        >
          <button
            type="button"
            className={`${styles.quickActionButton} ${
              quickActionsOpen
                ? styles.actionButtonActive
                : ""
            }`}
            onClick={openQuickActions}
            title="Create new"
            aria-label="Create new"
            aria-expanded={quickActionsOpen}
            aria-haspopup="menu"
          >
            +
          </button>

          {quickActionsOpen && (
            <QuickActionsDropdown
              onNavigate={closeDropdowns}
            />
          )}
        </div>

        <button
          type="button"
          className={styles.iconButton}
          title="Notifications"
          aria-label="Notifications"
        >
          ◌

          <span
            className={styles.notificationDot}
            aria-hidden="true"
          />
        </button>

        <div
          className={styles.dropdownWrapper}
          ref={settingsRef}
        >
          <button
            type="button"
            className={`${styles.iconButton} ${
              settingsOpen
                ? styles.actionButtonActive
                : ""
            }`}
            onClick={openSettings}
            aria-label="Open settings"
            aria-expanded={settingsOpen}
            aria-haspopup="menu"
          >
            ⚙
          </button>

          {settingsOpen && (
            <SettingsDropdown
              onNavigate={closeDropdowns}
            />
          )}
        </div>

        <div
          className={styles.dropdownWrapper}
          ref={userRef}
        >
          <button
            type="button"
            className={`${styles.profileButton} ${
              userOpen
                ? styles.actionButtonActive
                : ""
            }`}
            onClick={openUserMenu}
            aria-label="Open user menu"
            aria-expanded={userOpen}
            aria-haspopup="menu"
          >
            <span className={styles.smallAvatar}>
              {getInitials(
                userName || userEmail
              )}
            </span>

            <span
              className={
                styles.profileButtonText
              }
            >
              <strong>{userName}</strong>
              <small>Owner</small>
            </span>

            <span
              className={
                styles.profileChevron
              }
              aria-hidden="true"
            >
              ⌄
            </span>
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

  const parts = cleanedValue
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

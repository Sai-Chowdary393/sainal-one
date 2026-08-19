"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import SettingsDropdown from "./SettingsDropdown";
import UserDropdown from "./UserDropdown";
import QuickActionsDropdown from "./QuickActionsDropdown";

import styles from "./layout.module.css";

const NOTIFICATION_POLL_INTERVAL =
  30000;

export default function Topbar({
  title,
  description,
  onOpenSidebar,
}) {
  const router =
    useRouter();

  // =======================================================
  // DROPDOWNS
  // =======================================================

  const [
    quickActionsOpen,
    setQuickActionsOpen,
  ] = useState(false);

  const [
    settingsOpen,
    setSettingsOpen,
  ] = useState(false);

  const [
    userOpen,
    setUserOpen,
  ] = useState(false);

  // =======================================================
  // NOTIFICATIONS
  // =======================================================

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] = useState(false);

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    notificationsLoading,
    setNotificationsLoading,
  ] = useState(false);

  const [
    notificationError,
    setNotificationError,
  ] = useState("");

  // =======================================================
  // SEARCH
  // =======================================================

  const [
    searchValue,
    setSearchValue,
  ] = useState("");

  // =======================================================
  // USER
  // =======================================================

  const [
    userName,
    setUserName,
  ] = useState(
    "SaiNal One User"
  );

  const [
    userEmail,
    setUserEmail,
  ] = useState("");

  const [
    userRole,
    setUserRole,
  ] = useState(
    "Employee"
  );

  // =======================================================
  // REFS
  // =======================================================

  const quickActionsRef =
    useRef(null);

  const notificationsRef =
    useRef(null);

  const settingsRef =
    useRef(null);

  const userRef =
    useRef(null);

  const searchInputRef =
    useRef(null);

  // =======================================================
  // LOAD USER
  // =======================================================

  useEffect(() => {
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      const response =
        await fetch(
          "/api/me",
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to load current user."
        );
      }

      setUserName(
        data.user
          ?.full_name ||
          "SaiNal One User"
      );

      setUserEmail(
        data.user
          ?.email ||
          ""
      );

      setUserRole(
        data.displayRole ||
          "Employee"
      );
    } catch (
      error
    ) {
      console.error(
        "Unable to load current user:",
        error
      );

      /*
       * Safe visual fallback.
       * This does not affect permissions.
       */
      setUserRole(
        "Employee"
      );
    }
  }

  // =======================================================
  // LOAD NOTIFICATIONS
  // =======================================================

  const loadNotifications =
    useCallback(
      async ({
        showLoading = false,
      } = {}) => {
        try {
          if (
            showLoading
          ) {
            setNotificationsLoading(
              true
            );
          }

          setNotificationError(
            ""
          );

          const response =
            await fetch(
              "/api/notifications",
              {
                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (
            !response.ok
          ) {
            throw new Error(
              data.error ||
                "Unable to load notifications."
            );
          }

          setNotifications(
            Array.isArray(
              data.notifications
            )
              ? data.notifications
              : []
          );

          setUnreadCount(
            Number(
              data.unreadCount ||
                0
            )
          );
        } catch (
          error
        ) {
          console.error(
            "Unable to load notifications:",
            error
          );

          setNotificationError(
            error.message ||
              "Unable to load notifications."
          );
        } finally {
          if (
            showLoading
          ) {
            setNotificationsLoading(
              false
            );
          }
        }
      },
      []
    );

  useEffect(() => {
    loadNotifications();

    const interval =
      window.setInterval(
        () => {
          loadNotifications();
        },
        NOTIFICATION_POLL_INTERVAL
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    loadNotifications,
  ]);

  // =======================================================
  // OUTSIDE CLICK + KEYBOARD
  // =======================================================

  useEffect(() => {
    function handleOutsideClick(
      event
    ) {
      if (
        quickActionsRef.current &&
        !quickActionsRef.current.contains(
          event.target
        )
      ) {
        setQuickActionsOpen(
          false
        );
      }

      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(
          event.target
        )
      ) {
        setNotificationsOpen(
          false
        );
      }

      if (
        settingsRef.current &&
        !settingsRef.current.contains(
          event.target
        )
      ) {
        setSettingsOpen(
          false
        );
      }

      if (
        userRef.current &&
        !userRef.current.contains(
          event.target
        )
      ) {
        setUserOpen(
          false
        );
      }
    }

    function handleKeyboardShortcut(
      event
    ) {
      const isSearchShortcut =
        (
          event.ctrlKey ||
          event.metaKey
        ) &&
        event.key
          .toLowerCase() ===
          "k";

      if (
        isSearchShortcut
      ) {
        event.preventDefault();

        searchInputRef.current?.focus();

        closeDropdowns();
      }

      if (
        event.key ===
        "Escape"
      ) {
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

  // =======================================================
  // DROPDOWN CONTROLS
  // =======================================================

  function closeDropdowns() {
    setQuickActionsOpen(
      false
    );

    setNotificationsOpen(
      false
    );

    setSettingsOpen(
      false
    );

    setUserOpen(
      false
    );
  }

  function openQuickActions() {
    setQuickActionsOpen(
      (
        currentValue
      ) =>
        !currentValue
    );

    setNotificationsOpen(
      false
    );

    setSettingsOpen(
      false
    );

    setUserOpen(
      false
    );
  }

  async function openNotifications() {
    const nextValue =
      !notificationsOpen;

    setNotificationsOpen(
      nextValue
    );

    setQuickActionsOpen(
      false
    );

    setSettingsOpen(
      false
    );

    setUserOpen(
      false
    );

    if (
      nextValue
    ) {
      await loadNotifications({
        showLoading:
          true,
      });
    }
  }

  function openSettings() {
    setSettingsOpen(
      (
        currentValue
      ) =>
        !currentValue
    );

    setQuickActionsOpen(
      false
    );

    setNotificationsOpen(
      false
    );

    setUserOpen(
      false
    );
  }

  function openUserMenu() {
    setUserOpen(
      (
        currentValue
      ) =>
        !currentValue
    );

    setQuickActionsOpen(
      false
    );

    setNotificationsOpen(
      false
    );

    setSettingsOpen(
      false
    );
  }

  // =======================================================
  // NOTIFICATION ACTIONS
  // =======================================================

  async function openNotification(
    notification
  ) {
    try {
      if (
        !notification.is_read
      ) {
        const response =
          await fetch(
            `/api/notifications/${notification.id}`,
            {
              method:
                "PATCH",
            }
          );

        if (
          response.ok
        ) {
          setNotifications(
            (
              currentNotifications
            ) =>
              currentNotifications.map(
                (
                  item
                ) =>
                  item.id ===
                  notification.id
                    ? {
                        ...item,
                        is_read:
                          true,
                      }
                    : item
              )
          );

          setUnreadCount(
            (
              current
            ) =>
              Math.max(
                0,
                current -
                  1
              )
          );
        }
      }

      setNotificationsOpen(
        false
      );

      const href =
        getNotificationHref(
          notification
        );

      if (
        href
      ) {
        router.push(
          href
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Unable to open notification:",
        error
      );
    }
  }

  async function markAllNotificationsRead() {
    try {
      const response =
        await fetch(
          "/api/notifications",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "mark_all_read",
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to mark notifications as read."
        );
      }

      setNotifications(
        (
          currentNotifications
        ) =>
          currentNotifications.map(
            (
              notification
            ) => ({
              ...notification,
              is_read:
                true,
            })
          )
      );

      setUnreadCount(
        0
      );
    } catch (
      error
    ) {
      console.error(
        "Unable to mark notifications as read:",
        error
      );

      setNotificationError(
        error.message
      );
    }
  }

  function viewAllNotifications() {
    setNotificationsOpen(
      false
    );

    router.push(
      "/notifications"
    );
  }

  // =======================================================
  // SEARCH
  // =======================================================

  function handleSearchChange(
    event
  ) {
    setSearchValue(
      event.target.value
    );
  }

  function handleSearchSubmit(
    event
  ) {
    event.preventDefault();

    const cleanSearchValue =
      searchValue.trim();

    if (
      !cleanSearchValue
    ) {
      return;
    }

    console.log(
      "SaiNal One search:",
      cleanSearchValue
    );
  }

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <header
      className={
        styles.topbar
      }
    >
      {/* LEFT */}

      <div
        className={
          styles.topbarTitleSection
        }
      >
        <button
          type="button"
          className={
            styles.mobileMenuButton
          }
          onClick={
            onOpenSidebar
          }
          aria-label="Open navigation"
        >
          ☰
        </button>

        <div>
          <h1>
            {title}
          </h1>

          {description && (
            <p>
              {description}
            </p>
          )}
        </div>
      </div>

      {/* RIGHT */}

      <div
        className={
          styles.topbarActions
        }
      >
        {/* SEARCH */}

        <form
          className={
            styles.searchContainer
          }
          onSubmit={
            handleSearchSubmit
          }
          role="search"
        >
          <span
            className={
              styles.searchIcon
            }
            aria-hidden="true"
          >
            ⌕
          </span>

          <input
            ref={
              searchInputRef
            }
            type="search"
            placeholder="Search SaiNal One..."
            value={
              searchValue
            }
            onChange={
              handleSearchChange
            }
            aria-label="Search SaiNal One"
          />

          <span
            className={
              styles.searchShortcut
            }
            aria-hidden="true"
          >
            ⌘ K
          </span>
        </form>

        {/* QUICK ACTIONS */}

        <div
          className={
            styles.dropdownWrapper
          }
          ref={
            quickActionsRef
          }
        >
          <button
            type="button"
            className={`${styles.quickActionButton} ${
              quickActionsOpen
                ? styles.actionButtonActive
                : ""
            }`}
            onClick={
              openQuickActions
            }
            title="Create new"
            aria-label="Create new"
            aria-expanded={
              quickActionsOpen
            }
            aria-haspopup="menu"
          >
            +
          </button>

          {quickActionsOpen && (
            <QuickActionsDropdown
              onNavigate={
                closeDropdowns
              }
            />
          )}
        </div>

        {/* NOTIFICATIONS */}

        <div
          className={
            styles.dropdownWrapper
          }
          ref={
            notificationsRef
          }
        >
          <button
            type="button"
            className={`${styles.iconButton} ${
              notificationsOpen
                ? styles.actionButtonActive
                : ""
            } ${
              styles.notificationButton
            }`}
            title="Notifications"
            aria-label={`Notifications${
              unreadCount >
              0
                ? `, ${unreadCount} unread`
                : ""
            }`}
            aria-expanded={
              notificationsOpen
            }
            aria-haspopup="menu"
            onClick={
              openNotifications
            }
          >
            <span
              aria-hidden="true"
            >
              ◌
            </span>

            {unreadCount >
              0 && (
              <span
                className={
                  styles.notificationCount
                }
                aria-hidden="true"
              >
                {unreadCount >
                99
                  ? "99+"
                  : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <section
              className={
                styles.notificationDropdown
              }
              role="menu"
              aria-label="Notifications"
            >
              <div
                className={
                  styles.notificationDropdownHeader
                }
              >
                <div>
                  <strong>
                    Notifications
                  </strong>

                  <span>
                    {unreadCount >
                    0
                      ? `${unreadCount} unread`
                      : "You're all caught up"}
                  </span>
                </div>

                {unreadCount >
                  0 && (
                  <button
                    type="button"
                    onClick={
                      markAllNotificationsRead
                    }
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div
                className={
                  styles.notificationDropdownBody
                }
              >
                {notificationsLoading ? (
                  <div
                    className={
                      styles.notificationDropdownState
                    }
                  >
                    Loading notifications...
                  </div>
                ) : notificationError ? (
                  <div
                    className={
                      styles.notificationDropdownError
                    }
                  >
                    <strong>
                      Unable to load notifications
                    </strong>

                    <span>
                      {
                        notificationError
                      }
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        loadNotifications({
                          showLoading:
                            true,
                        })
                      }
                    >
                      Try again
                    </button>
                  </div>
                ) : notifications.length ===
                  0 ? (
                  <div
                    className={
                      styles.notificationDropdownState
                    }
                  >
                    <span
                      className={
                        styles.notificationEmptyIcon
                      }
                    >
                      ✓
                    </span>

                    <strong>
                      No notifications
                    </strong>

                    <span>
                      New workflow activity will appear here.
                    </span>
                  </div>
                ) : (
                  notifications
                    .slice(
                      0,
                      6
                    )
                    .map(
                      (
                        notification
                      ) => (
                        <button
                          type="button"
                          key={
                            notification.id
                          }
                          className={`${styles.notificationDropdownItem} ${
                            !notification.is_read
                              ? styles.notificationDropdownItemUnread
                              : ""
                          }`}
                          onClick={() =>
                            openNotification(
                              notification
                            )
                          }
                          role="menuitem"
                        >
                          <span
                            className={
                              styles.notificationItemIcon
                            }
                            aria-hidden="true"
                          >
                            {getNotificationIcon(
                              notification.type
                            )}
                          </span>

                          <span
                            className={
                              styles.notificationItemContent
                            }
                          >
                            <strong>
                              {
                                notification.title
                              }
                            </strong>

                            <span>
                              {
                                notification.message
                              }
                            </span>

                            <small>
                              {formatNotificationTime(
                                notification.created_at
                              )}
                            </small>
                          </span>

                          {!notification.is_read && (
                            <span
                              className={
                                styles.notificationUnreadDot
                              }
                              aria-label="Unread"
                            />
                          )}
                        </button>
                      )
                    )
                )}
              </div>

              <div
                className={
                  styles.notificationDropdownFooter
                }
              >
                <button
                  type="button"
                  onClick={
                    viewAllNotifications
                  }
                >
                  View all notifications

                  <span>
                    →
                  </span>
                </button>
              </div>
            </section>
          )}
        </div>

        {/* SETTINGS */}

        <div
          className={
            styles.dropdownWrapper
          }
          ref={
            settingsRef
          }
        >
          <button
            type="button"
            className={`${styles.iconButton} ${
              settingsOpen
                ? styles.actionButtonActive
                : ""
            }`}
            onClick={
              openSettings
            }
            aria-label="Open settings"
            aria-expanded={
              settingsOpen
            }
            aria-haspopup="menu"
          >
            ⚙
          </button>

          {settingsOpen && (
            <SettingsDropdown
              onNavigate={
                closeDropdowns
              }
            />
          )}
        </div>

        {/* USER */}

        <div
          className={
            styles.dropdownWrapper
          }
          ref={
            userRef
          }
        >
          <button
            type="button"
            className={`${styles.profileButton} ${
              userOpen
                ? styles.actionButtonActive
                : ""
            }`}
            onClick={
              openUserMenu
            }
            aria-label="Open user menu"
            aria-expanded={
              userOpen
            }
            aria-haspopup="menu"
          >
            <span
              className={
                styles.smallAvatar
              }
            >
              {getInitials(
                userName ||
                  userEmail
              )}
            </span>

            <span
              className={
                styles.profileButtonText
              }
            >
              <strong>
                {userName}
              </strong>

              <small>
                {userRole}
              </small>
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
              userName={
                userName
              }
              userEmail={
                userEmail
              }
              userRole={
                userRole
              }
              onNavigate={
                closeDropdowns
              }
            />
          )}
        </div>
      </div>
    </header>
  );
}

// =========================================================
// HELPERS
// =========================================================

function getInitials(
  value = ""
) {
  const cleanedValue =
    String(
      value ||
        ""
    ).trim();

  if (
    !cleanedValue
  ) {
    return "SN";
  }

  const parts =
    cleanedValue
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length ===
    1
  ) {
    return parts[0]
      .slice(
        0,
        2
      )
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[
      parts.length -
        1
    ][0]
  }`.toUpperCase();
}

function getNotificationHref(
  notification
) {
  if (
    !notification.record_id
  ) {
    return null;
  }

  const type =
    String(
      notification.record_type ||
        ""
    ).toLowerCase();

  switch (
    type
  ) {
    case "quote":
    case "quotes":
      return `/quotes/${notification.record_id}`;

    case "lead":
    case "leads":
      return `/leads/${notification.record_id}`;

    case "customer":
    case "customers":
      return `/customers/${notification.record_id}`;

    case "project":
    case "projects":
      return `/projects/${notification.record_id}`;

    case "invoice":
    case "invoices":
      return `/invoices/${notification.record_id}`;

    case "proposal":
    case "proposals":
      return `/proposals/${notification.record_id}`;

    default:
      return null;
  }
}

function getNotificationIcon(
  type
) {
  switch (
    String(
      type ||
        ""
    ).toLowerCase()
  ) {
    case "success":
      return "✓";

    case "warning":
      return "!";

    case "error":
      return "×";

    default:
      return "◦";
  }
}

function formatNotificationTime(
  value
) {
  if (
    !value
  ) {
    return "";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const now =
    new Date();

  const difference =
    now.getTime() -
    date.getTime();

  const minutes =
    Math.floor(
      difference /
        60000
    );

  if (
    minutes <
    1
  ) {
    return "Just now";
  }

  if (
    minutes <
    60
  ) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes /
        60
    );

  if (
    hours <
    24
  ) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours /
        24
    );

  if (
    days <
    7
  ) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",
    }
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";

import styles from "./notifications.module.css";

export default function NotificationsPage() {
  const router =
    useRouter();

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const loadNotifications =
    useCallback(async () => {
      try {
        setLoading(true);
        setErrorMessage("");

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

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load notifications."
          );
        }

        setNotifications(
          data.notifications ||
            []
        );
      } catch (error) {
        setErrorMessage(
          error.message ||
            "Unable to load notifications."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function openNotification(
    notification
  ) {
    try {
      if (
        !notification.is_read
      ) {
        await fetch(
          `/api/notifications/${notification.id}`,
          {
            method:
              "PATCH",
          }
        );
      }
    } catch (error) {
      console.error(
        "Unable to mark notification as read:",
        error
      );
    }

    const href =
      getRecordHref(
        notification
      );

    if (href) {
      router.push(href);
    } else {
      await loadNotifications();
    }
  }

  async function markAllRead() {
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

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update notifications."
        );
      }

      await loadNotifications();
    } catch (error) {
      setErrorMessage(
        error.message
      );
    }
  }

  const unreadCount =
    notifications.filter(
      (item) =>
        !item.is_read
    ).length;

  return (
    <ProtectedRoute>
      <AppLayout
        title="Notifications"
        description="Review workflow updates and business activity requiring your attention."
      >
        <div
          className={
            styles.page
          }
        >
          <section
            className={
              styles.pageHeader
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                My Work
              </span>

              <h2>
                Notification Center
              </h2>

              <p>
                Keep track of
                approvals, workflow
                actions and important
                business events.
              </p>
            </div>

            {unreadCount >
              0 && (
              <button
                type="button"
                className={
                  styles.markAllButton
                }
                onClick={
                  markAllRead
                }
              >
                Mark all as read
              </button>
            )}
          </section>

          <section
            className={
              styles.summaryCard
            }
          >
            <span>
              Unread
            </span>

            <strong>
              {unreadCount}
            </strong>

            <small>
              {notifications.length} total notifications
            </small>
          </section>

          {errorMessage && (
            <div
              className={
                styles.error
              }
            >
              {errorMessage}
            </div>
          )}

          <section
            className={
              styles.notificationPanel
            }
          >
            <div
              className={
                styles.panelHeader
              }
            >
              <div>
                <h3>
                  Recent notifications
                </h3>

                <p>
                  Latest business
                  activity from SaiNal
                  One.
                </p>
              </div>
            </div>

            {loading ? (
              <div
                className={
                  styles.loading
                }
              >
                Loading notifications...
              </div>
            ) : notifications.length ===
              0 ? (
              <div
                className={
                  styles.emptyState
                }
              >
                <span>
                  ✓
                </span>

                <h3>
                  You're all caught up
                </h3>

                <p>
                  New workflow and
                  business
                  notifications will
                  appear here.
                </p>
              </div>
            ) : (
              <div
                className={
                  styles.list
                }
              >
                {notifications.map(
                  (
                    notification
                  ) => (
                    <button
                      type="button"
                      key={
                        notification.id
                      }
                      className={`${styles.notification} ${
                        !notification.is_read
                          ? styles.unread
                          : ""
                      }`}
                      onClick={() =>
                        openNotification(
                          notification
                        )
                      }
                    >
                      <span
                        className={
                          styles.icon
                        }
                      >
                        {getIcon(
                          notification.type
                        )}
                      </span>

                      <span
                        className={
                          styles.content
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
                          {formatDate(
                            notification.created_at
                          )}
                        </small>
                      </span>

                      {!notification.is_read && (
                        <span
                          className={
                            styles.unreadDot
                          }
                        />
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function getRecordHref(
  notification
) {
  if (
    !notification.record_id
  ) {
    return null;
  }

  switch (
    String(
      notification.record_type ||
        ""
    ).toLowerCase()
  ) {
    case "quote":
      return `/quotes/${notification.record_id}`;

    case "lead":
      return `/leads/${notification.record_id}`;

    case "customer":
      return `/customers/${notification.record_id}`;

    case "project":
      return `/projects/${notification.record_id}`;

    case "invoice":
      return `/invoices/${notification.record_id}`;

    case "proposal":
      return `/proposals/${notification.record_id}`;

    default:
      return null;
  }
}

function getIcon(type) {
  switch (
    String(type || "")
      .toLowerCase()
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

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

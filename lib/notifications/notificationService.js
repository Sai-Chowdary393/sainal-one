// =========================================================
// SAINAL ONE
// NOTIFICATION SERVICE
// =========================================================

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normaliseRecordType(value) {
  const type =
    cleanText(value)
      .toLowerCase();

  switch (type) {
    case "quotes":
      return "quote";

    case "leads":
      return "lead";

    case "customers":
      return "customer";

    case "projects":
      return "project";

    case "invoices":
      return "invoice";

    case "proposals":
      return "proposal";

    case "tasks":
      return "task";

    case "followups":
    case "follow-ups":
    case "follow_ups":
      return "followup";

    default:
      return type || null;
  }
}

// =========================================================
// CREATE
// =========================================================

export async function createNotification({
  supabase,
  organizationId,
  userId = null,
  title,
  message,
  type = "info",
  recordType = null,
  recordId = null,
}) {
  if (!organizationId) {
    throw new Error(
      "Organization ID is required to create a notification."
    );
  }

  const cleanTitle =
    cleanText(title) ||
    "SaiNal One";

  const cleanMessage =
    cleanText(message) ||
    "You have a new notification.";

  const normalisedRecordType =
    normaliseRecordType(
      recordType
    );

  const cleanRecordId =
    recordId
      ? String(recordId)
      : null;

  /*
   * IMPORTANT:
   *
   * user_id = null means an organisation-wide notification.
   *
   * Organisation-wide notifications may still be stored with
   * a related record, but loadNotifications() will deliberately
   * hide record-linked global notifications from ordinary users.
   *
   * Sensitive CRM notifications should therefore normally be
   * created with the target employee ID in userId.
   */

  const {
    data,
    error,
  } =
    await supabase
      .from("notifications")
      .insert([
        {
          organization_id:
            organizationId,

          user_id:
            userId ||
            null,

          title:
            cleanTitle,

          message:
            cleanMessage,

          type:
            cleanText(type) ||
            "info",

          record_type:
            normalisedRecordType,

          record_id:
            cleanRecordId,

          is_read:
            false,
        },
      ])
      .select()
      .single();

  if (error) {
    throw new Error(
      `Unable to create notification: ${error.message}`
    );
  }

  return data;
}

// =========================================================
// LOAD
// =========================================================

export async function loadNotifications({
  supabase,
  organizationId,
  employeeId,
  limit = 50,
}) {
  if (!organizationId) {
    throw new Error(
      "Organization ID is required to load notifications."
    );
  }

  if (!employeeId) {
    throw new Error(
      "Employee ID is required to load notifications."
    );
  }

  /*
   * SECURITY MODEL
   *
   * Personal:
   *   user_id = employeeId
   *
   * General organisation notification:
   *   user_id IS NULL
   *   AND record_type IS NULL
   *   AND record_id IS NULL
   *
   * We deliberately do NOT expose organisation-wide
   * record-linked notifications here.
   *
   * Example:
   *
   *   user_id = null
   *   record_type = "invoice"
   *   record_id = "..."
   *
   * would otherwise reveal invoice information to employees
   * with no Invoice permission.
   */

  const {
    data:
      personalNotifications,
    error:
      personalError,
  } =
    await supabase
      .from("notifications")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "user_id",
        employeeId
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      )
      .limit(limit);

  if (personalError) {
    throw new Error(
      `Unable to load personal notifications: ${personalError.message}`
    );
  }

  const {
    data:
      generalNotifications,
    error:
      generalError,
  } =
    await supabase
      .from("notifications")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .is(
        "user_id",
        null
      )
      .is(
        "record_type",
        null
      )
      .is(
        "record_id",
        null
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      )
      .limit(limit);

  if (generalError) {
    throw new Error(
      `Unable to load organisation notifications: ${generalError.message}`
    );
  }

  const combined = [
    ...(
      personalNotifications ||
      []
    ),

    ...(
      generalNotifications ||
      []
    ),
  ];

  /*
   * Remove duplicates defensively and sort everything
   * together because the records came from two queries.
   */

  const notificationMap =
    new Map();

  combined.forEach(
    (notification) => {
      if (
        notification?.id
      ) {
        notificationMap.set(
          notification.id,
          notification
        );
      }
    }
  );

  return [
    ...notificationMap.values(),
  ]
    .sort(
      (first, second) => {
        const firstTime =
          new Date(
            first.created_at ||
              0
          ).getTime();

        const secondTime =
          new Date(
            second.created_at ||
              0
          ).getTime();

        return (
          secondTime -
          firstTime
        );
      }
    )
    .slice(
      0,
      limit
    );
}

// =========================================================
// MARK ONE READ
// =========================================================

export async function markNotificationRead({
  supabase,
  organizationId,
  employeeId,
  notificationId,
}) {
  if (!organizationId) {
    throw new Error(
      "Organization ID is required."
    );
  }

  if (!employeeId) {
    throw new Error(
      "Employee ID is required."
    );
  }

  if (!notificationId) {
    throw new Error(
      "Notification ID is required."
    );
  }

  /*
   * First check whether this employee is allowed to interact
   * with the notification.
   */

  const {
    data:
      notification,
    error:
      lookupError,
  } =
    await supabase
      .from("notifications")
      .select("*")
      .eq(
        "id",
        notificationId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Unable to load notification: ${lookupError.message}`
    );
  }

  if (!notification) {
    return null;
  }

  const isPersonal =
    String(
      notification.user_id ||
        ""
    ) ===
    String(
      employeeId
    );

  const isSafeGeneral =
    !notification.user_id &&
    !notification.record_type &&
    !notification.record_id;

  if (
    !isPersonal &&
    !isSafeGeneral
  ) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabase
      .from("notifications")
      .update({
        is_read:
          true,
      })
      .eq(
        "id",
        notificationId
      )
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to mark notification as read: ${error.message}`
    );
  }

  return data || null;
}

// =========================================================
// MARK ALL READ
// =========================================================

export async function markAllNotificationsRead({
  supabase,
  organizationId,
  employeeId,
}) {
  if (!organizationId) {
    throw new Error(
      "Organization ID is required."
    );
  }

  if (!employeeId) {
    throw new Error(
      "Employee ID is required."
    );
  }

  /*
   * Personal unread notifications.
   */

  const {
    error:
      personalError,
  } =
    await supabase
      .from("notifications")
      .update({
        is_read:
          true,
      })
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "user_id",
        employeeId
      )
      .eq(
        "is_read",
        false
      );

  if (personalError) {
    throw new Error(
      `Unable to mark personal notifications as read: ${personalError.message}`
    );
  }

  /*
   * Safe organisation-wide notifications only.
   *
   * Record-linked global notifications remain untouched
   * because they are deliberately not visible to this user.
   */

  const {
    error:
      generalError,
  } =
    await supabase
      .from("notifications")
      .update({
        is_read:
          true,
      })
      .eq(
        "organization_id",
        organizationId
      )
      .is(
        "user_id",
        null
      )
      .is(
        "record_type",
        null
      )
      .is(
        "record_id",
        null
      )
      .eq(
        "is_read",
        false
      );

  if (generalError) {
    throw new Error(
      `Unable to mark organisation notifications as read: ${generalError.message}`
    );
  }

  return true;
}

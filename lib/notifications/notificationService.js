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
  const type = cleanText(value).toLowerCase();

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
    cleanText(title) || "SaiNal One";

  const cleanMessage =
    cleanText(message) || "You have a new notification.";

  const {
    data,
    error,
  } = await supabase
    .from("notifications")
    .insert([
      {
        organization_id:
          organizationId,

        user_id:
          userId || null,

        title:
          cleanTitle,

        message:
          cleanMessage,

        type:
          cleanText(type) || "info",

        record_type:
          normaliseRecordType(
            recordType
          ),

        record_id:
          recordId || null,

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
  let query =
    supabase
      .from("notifications")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(limit);

  /*
   * Personal notifications plus
   * organisation-wide notifications.
   */
  query =
    query.or(
      `user_id.eq.${employeeId},user_id.is.null`
    );

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw new Error(
      `Unable to load notifications: ${error.message}`
    );
  }

  return data || [];
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
  const {
    data,
    error,
  } = await supabase
    .from("notifications")
    .update({
      is_read: true,
    })
    .eq(
      "id",
      notificationId
    )
    .eq(
      "organization_id",
      organizationId
    )
    .or(
      `user_id.eq.${employeeId},user_id.is.null`
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
  const {
    error,
  } = await supabase
    .from("notifications")
    .update({
      is_read: true,
    })
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "is_read",
      false
    )
    .or(
      `user_id.eq.${employeeId},user_id.is.null`
    );

  if (error) {
    throw new Error(
      `Unable to mark notifications as read: ${error.message}`
    );
  }

  return true;
}

import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../lib/serverAccess";

import {
  loadNotifications,
  markAllNotificationsRead,
} from "../../../lib/notifications/notificationService";

export async function GET() {
  try {
    const access =
      await getServerAccess();

    if (!access.employee) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const notifications =
      await loadNotifications({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        employeeId:
          access.employee.id,
      });

    const unreadCount =
      notifications.filter(
        (notification) =>
          !notification.is_read
      ).length;

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error(
      "Notifications GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load notifications.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(
  request
) {
  try {
    const access =
      await getServerAccess();

    if (!access.employee) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const body =
      await request.json();

    if (
      body.action !==
      "mark_all_read"
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported notification action.",
        },
        {
          status: 400,
        }
      );
    }

    await markAllNotificationsRead({
      supabase:
        access.supabase,

      organizationId:
        access.employee
          .organization_id,

      employeeId:
        access.employee.id,
    });

    return NextResponse.json({
      message:
        "All notifications marked as read.",
    });
  } catch (error) {
    console.error(
      "Notifications PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to update notifications.",
      },
      {
        status: 500,
      }
    );
  }
}

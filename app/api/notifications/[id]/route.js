import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../lib/serverAccess";

import {
  markNotificationRead,
} from "../../../../lib/notifications/notificationService";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

export async function PATCH(
  request,
  context
) {
  try {
    const { id } =
      await context.params;

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid notification ID is required.",
        },
        {
          status: 400,
        }
      );
    }

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

    const notification =
      await markNotificationRead({
        supabase:
          access.supabase,

        organizationId:
          access.employee
            .organization_id,

        employeeId:
          access.employee.id,

        notificationId:
          id,
      });

    if (!notification) {
      return NextResponse.json(
        {
          error:
            "Notification not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      notification,

      message:
        "Notification marked as read.",
    });
  } catch (error) {
    console.error(
      "Notification PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to update notification.",
      },
      {
        status: 500,
      }
    );
  }
}

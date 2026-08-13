import { supabase } from "../../../../lib/supabase";
import { NextResponse } from "next/server";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

export async function PATCH(
  request,
  context
) {
  try {
    const body =
      await request.json();

    const { id } =
      await context.params;

    const updateValues = {
      ...body,
      updated_at:
        new Date().toISOString(),
    };

    const {
      data,
      error,
    } = await supabase
      .from("tasks")
      .update(updateValues)
      .eq("id", id)
      .eq(
        "organization_id",
        ORGANIZATION_ID
      )
      .select();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !data ||
      data.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Task not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      data
    );
  } catch (error) {
    console.error(
      "Task PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to update task.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  request,
  context
) {
  try {
    const { id } =
      await context.params;

    const {
      data,
      error,
    } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq(
        "organization_id",
        ORGANIZATION_ID
      )
      .select();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !data ||
      data.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Task not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      data
    );
  } catch (error) {
    console.error(
      "Task DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to delete task.",
      },
      {
        status: 500,
      }
    );
  }
}

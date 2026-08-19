import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../lib/supabaseAdmin";

// =========================================================
// HELPERS
// =========================================================

function cleanText(
  value
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function cleanNullableText(
  value
) {
  const cleaned =
    cleanText(
      value
    );

  return (
    cleaned ||
    null
  );
}

function forbidden(
  message
) {
  return NextResponse.json(
    {
      error:
        message,
    },
    {
      status:
        403,
    }
  );
}

function getCustomerPermissions(
  access
) {
  return {
    canViewAll:
      access.can(
        "customers.view_all"
      ) ||
      access.canModuleAction(
        "Customers",
        "view_all"
      ),

    canViewTeam:
      access.can(
        "customers.view_team"
      ) ||
      access.canModuleAction(
        "Customers",
        "view_team"
      ),

    canViewOwn:
      access.can(
        "customers.view_own"
      ) ||
      access.canModuleAction(
        "Customers",
        "view_own"
      ),

    canCreate:
      access.can(
        "customers.create"
      ) ||
      access.canModuleAction(
        "Customers",
        "create"
      ),

    canEdit:
      access.can(
        "customers.edit"
      ) ||
      access.canModuleAction(
        "Customers",
        "edit"
      ),

    canDelete:
      access.can(
        "customers.delete"
      ) ||
      access.canModuleAction(
        "Customers",
        "delete"
      ),

    canAssign:
      access.can(
        "customers.assign"
      ) ||
      access.canModuleAction(
        "Customers",
        "assign"
      ),
  };
}

// =========================================================
// OWNER ENRICHMENT
// =========================================================

async function attachOwners({
  adminSupabase,
  organizationId,
  customers,
}) {
  const ownerIds =
    [
      ...new Set(
        (
          customers ||
          []
        )
          .map(
            (
              customer
            ) =>
              customer
                .owner_employee_id
          )
          .filter(Boolean)
      ),
    ];

  if (
    ownerIds.length ===
    0
  ) {
    return (
      customers ||
      []
    ).map(
      (
        customer
      ) => ({
        ...customer,
        owner:
          null,
      })
    );
  }

  const {
    data:
      owners,
    error,
  } =
    await adminSupabase
      .from(
        "employees"
      )
      .select(
        `
          id,
          full_name,
          email,
          job_title,
          department_id,
          is_active
        `
      )
      .eq(
        "organization_id",
        organizationId
      )
      .in(
        "id",
        ownerIds
      );

  if (
    error
  ) {
    throw new Error(
      error.message
    );
  }

  const ownerMap =
    new Map(
      (
        owners ||
        []
      ).map(
        (
          owner
        ) => [
          owner.id,
          owner,
        ]
      )
    );

  return (
    customers ||
    []
  ).map(
    (
      customer
    ) => ({
      ...customer,

      owner:
        customer
          .owner_employee_id
          ? ownerMap.get(
              customer
                .owner_employee_id
            ) ||
            null
          : null,
    })
  );
}

// =========================================================
// GET
// =========================================================

export async function GET() {
  try {
    const access =
      await getServerAccess();

    if (
      !access.employee
    ) {
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

    const permissions =
      getCustomerPermissions(
        access
      );

    if (
      !permissions.canViewAll &&
      !permissions.canViewTeam &&
      !permissions.canViewOwn
    ) {
      return forbidden(
        "You do not have permission to view customers."
      );
    }

    const adminSupabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    let query =
      adminSupabase
        .from(
          "customers"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        );

    // =====================================================
    // TEAM
    // =====================================================

    if (
      !permissions.canViewAll &&
      permissions.canViewTeam
    ) {
      const departmentId =
        access.employee
          .department_id;

      let teamEmployeeIds = [
        access.employee.id,
      ];

      if (
        departmentId
      ) {
        const {
          data:
            teamEmployees,
          error:
            teamError,
        } =
          await adminSupabase
            .from(
              "employees"
            )
            .select("id")
            .eq(
              "organization_id",
              organizationId
            )
            .eq(
              "department_id",
              departmentId
            )
            .eq(
              "is_active",
              true
            );

        if (
          teamError
        ) {
          throw new Error(
            teamError.message
          );
        }

        teamEmployeeIds =
          (
            teamEmployees ||
            []
          ).map(
            (
              employee
            ) =>
              employee.id
          );

        if (
          teamEmployeeIds.length ===
          0
        ) {
          teamEmployeeIds = [
            access.employee.id,
          ];
        }
      }

      query =
        query.in(
          "owner_employee_id",
          teamEmployeeIds
        );
    } else if (
      !permissions.canViewAll &&
      permissions.canViewOwn
    ) {
      query =
        query.eq(
          "owner_employee_id",
          access.employee.id
        );
    }

    const {
      data:
        customerRows,
      error:
        customersError,
    } =
      await query.order(
        "created_at",
        {
          ascending:
            false,
        }
      );

    if (
      customersError
    ) {
      throw new Error(
        customersError.message
      );
    }

    const customers =
      await attachOwners({
        adminSupabase,
        organizationId,

        customers:
          customerRows ||
          [],
      });

    // =====================================================
    // ASSIGNMENT OPTIONS
    // =====================================================

    let employees = [];

    if (
      permissions.canAssign
    ) {
      const {
        data,
        error,
      } =
        await adminSupabase
          .from(
            "employees"
          )
          .select(
            `
              id,
              full_name,
              email,
              job_title,
              department_id
            `
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "is_active",
            true
          )
          .order(
            "full_name",
            {
              ascending:
                true,
            }
          );

      if (
        error
      ) {
        throw new Error(
          error.message
        );
      }

      employees =
        data ||
        [];
    }

    return NextResponse.json({
      customers,

      employees,

      currentEmployee:
        access.employee,

      access: {
        ...permissions,

        isOwner:
          access.isOwner,

        permissions:
          access.permissionKeys,

        roles:
          access.roles,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Customers GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load customers.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// POST
// =========================================================

export async function POST(
  request
) {
  try {
    const access =
      await getServerAccess();

    if (
      !access.employee
    ) {
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

    const permissions =
      getCustomerPermissions(
        access
      );

    if (
      !permissions.canCreate
    ) {
      return forbidden(
        "You do not have permission to create customers."
      );
    }

    const body =
      await request.json();

    const customerName =
      cleanText(
        body.customer_name
      );

    if (
      !customerName
    ) {
      return NextResponse.json(
        {
          error:
            "Customer name is required.",
        },
        {
          status:
            400,
        }
      );
    }

    const adminSupabase =
      createAdminSupabaseClient();

    const organizationId =
      access.employee
        .organization_id;

    let ownerEmployeeId =
      access.employee.id;

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        "owner_employee_id"
      ) &&
      body.owner_employee_id
    ) {
      if (
        !permissions.canAssign
      ) {
        return forbidden(
          "You do not have permission to assign customers."
        );
      }

      const {
        data:
          owner,
        error:
          ownerError,
      } =
        await adminSupabase
          .from(
            "employees"
          )
          .select("id")
          .eq(
            "id",
            body.owner_employee_id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle();

      if (
        ownerError
      ) {
        throw new Error(
          ownerError.message
        );
      }

      if (
        !owner
      ) {
        return NextResponse.json(
          {
            error:
              "The selected customer owner is not valid.",
          },
          {
            status:
              400,
          }
        );
      }

      ownerEmployeeId =
        owner.id;
    }

    const {
      data:
        customer,
      error:
        createError,
    } =
      await adminSupabase
        .from(
          "customers"
        )
        .insert([
          {
            customer_name:
              customerName,

            company:
              cleanNullableText(
                body.company
              ),

            email:
              cleanNullableText(
                body.email
              ),

            phone:
              cleanNullableText(
                body.phone
              ),

            status:
              cleanText(
                body.status
              ) ||
              "Active",

            organization_id:
              organizationId,

            owner_employee_id:
              ownerEmployeeId,
          },
        ])
        .select()
        .single();

    if (
      createError
    ) {
      throw new Error(
        createError.message
      );
    }

    const [
      formattedCustomer,
    ] =
      await attachOwners({
        adminSupabase,
        organizationId,

        customers: [
          customer,
        ],
      });

    return NextResponse.json(
      {
        customer:
          formattedCustomer,

        message:
          "Customer created successfully.",
      },
      {
        status:
          201,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Customers POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to create customer.",
      },
      {
        status:
          500,
      }
    );
  }
}

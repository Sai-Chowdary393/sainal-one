import { NextResponse } from "next/server";

import {
  getCurrentEmployeeAccess,
} from "../../../lib/accessControl";

import {
  createAdminSupabaseClient,
} from "../../../lib/supabaseAdmin";

// =========================================================
// HELPERS
// =========================================================

function cleanText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function unauthenticatedResponse(
  message = "You must be logged in."
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 401,
    }
  );
}

function forbiddenResponse(
  message =
    "You do not have permission to perform this action."
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 403,
    }
  );
}

// =========================================================
// GET
// VIEW COMPANY SETTINGS
// =========================================================

export async function GET() {
  try {
    // =====================================================
    // ACCESS CONTROL
    // =====================================================

    const access =
      await getCurrentEmployeeAccess();

    if (
      !access.authenticated
    ) {
      return unauthenticatedResponse(
        access.error
      );
    }

    if (
      !access.employee
    ) {
      return forbiddenResponse(
        access.error ||
          "Your login is not linked to an active employee record."
      );
    }

    /*
     * settings.manage automatically implies that
     * the employee may also view the settings.
     */
    const canViewSettings =
      access.can(
        "settings.view"
      ) ||
      access.can(
        "settings.manage"
      );

    if (
      !canViewSettings
    ) {
      return forbiddenResponse(
        "You do not have permission to view company settings."
      );
    }

    // =====================================================
    // ORGANISATION
    // =====================================================

    const organizationId =
      access.employee
        .organization_id;

    /*
     * The organisation comes from the authenticated
     * employee record.
     *
     * We no longer hard-code a SaiNal organisation UUID.
     */
    const adminSupabase =
      createAdminSupabaseClient();

    // =====================================================
    // LOAD SETTINGS
    // =====================================================

    const {
      data:
        settingsRows,
      error:
        settingsError,
    } =
      await adminSupabase
        .from(
          "company_settings"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .limit(1);

    if (
      settingsError
    ) {
      console.error(
        "Company settings lookup error:",
        settingsError
      );

      return NextResponse.json(
        {
          error:
            settingsError.message,
        },
        {
          status: 500,
        }
      );
    }

    const settings =
      Array.isArray(
        settingsRows
      ) &&
      settingsRows.length >
        0
        ? settingsRows[0]
        : {};

    // =====================================================
    // RESPONSE
    // =====================================================

    /*
     * Keep settings at the top level so the current
     * app/settings/page.js continues to work.
     *
     * We also include an access object which the updated
     * Settings UI will use in the next step.
     */
    return NextResponse.json({
      ...settings,

      access: {
        isOwner:
          access.isOwner,

        permissions:
          access.permissions,

        roles:
          access.roles,

        canViewSettings:
          true,

        canManageSettings:
          access.can(
            "settings.manage"
          ),
      },
    });
  } catch (error) {
    console.error(
      "Company settings GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to load company settings.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================================================
// POST
// CREATE OR UPDATE COMPANY SETTINGS
// =========================================================

export async function POST(
  request
) {
  try {
    // =====================================================
    // ACCESS CONTROL
    // =====================================================

    const access =
      await getCurrentEmployeeAccess();

    if (
      !access.authenticated
    ) {
      return unauthenticatedResponse(
        access.error
      );
    }

    if (
      !access.employee
    ) {
      return forbiddenResponse(
        access.error ||
          "Your login is not linked to an active employee record."
      );
    }

    if (
      !access.can(
        "settings.manage"
      )
    ) {
      return forbiddenResponse(
        "You do not have permission to update company settings."
      );
    }

    // =====================================================
    // REQUEST
    // =====================================================

    const body =
      await request.json();

    const organizationId =
      access.employee
        .organization_id;

    const companyName =
      cleanText(
        body.company_name
      );

    if (
      !companyName
    ) {
      return NextResponse.json(
        {
          error:
            "Company name is required.",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================================
    // PAYLOAD
    // =====================================================

    const settingsPayload = {
      company_name:
        companyName,

      company_email:
        cleanText(
          body.company_email
        ),

      company_phone:
        cleanText(
          body.company_phone
        ),

      website:
        cleanText(
          body.website
        ),

      address:
        cleanText(
          body.address
        ),

      company_registration_number:
        cleanText(
          body.company_registration_number
        ),

      vat_number:
        cleanText(
          body.vat_number
        ),

      default_currency:
        cleanText(
          body.default_currency
        ) ||
        "GBP",

      default_vat_rate:
        cleanText(
          body.default_vat_rate
        ) ||
        "20",

      invoice_prefix:
        cleanText(
          body.invoice_prefix
        ) ||
        "SNI",

      bank_name:
        cleanText(
          body.bank_name
        ),

      bank_account_name:
        cleanText(
          body.bank_account_name
        ),

      bank_sort_code:
        cleanText(
          body.bank_sort_code
        ),

      bank_account_number:
        cleanText(
          body.bank_account_number
        ),

      payment_terms:
        cleanText(
          body.payment_terms
        ) ||
        "Payment due within 14 days of invoice date.",

      industry:
        cleanText(
          body.industry
        ),

      business_type:
        cleanText(
          body.business_type
        ),

      services:
        cleanText(
          body.services
        ),

      target_customers:
        cleanText(
          body.target_customers
        ),

      ai_instructions:
        cleanText(
          body.ai_instructions
        ),

      organization_id:
        organizationId,

      updated_at:
        new Date()
          .toISOString(),
    };

    // =====================================================
    // SERVER ADMIN CLIENT
    // =====================================================

    /*
     * Authentication and authorisation have already
     * been verified above.
     *
     * The Admin client is used only on the server and
     * avoids company-setting writes depending on a user's
     * direct database RLS permissions.
     */
    const adminSupabase =
      createAdminSupabaseClient();

    // =====================================================
    // EXISTING SETTINGS
    // =====================================================

    const {
      data:
        existingRows,
      error:
        existingError,
    } =
      await adminSupabase
        .from(
          "company_settings"
        )
        .select(
          "id"
        )
        .eq(
          "organization_id",
          organizationId
        )
        .limit(1);

    if (
      existingError
    ) {
      console.error(
        "Company settings existing-record lookup error:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            existingError.message,
        },
        {
          status: 500,
        }
      );
    }

    const existing =
      Array.isArray(
        existingRows
      ) &&
      existingRows.length >
        0
        ? existingRows[0]
        : null;

    // =====================================================
    // UPDATE
    // =====================================================

    if (
      existing
    ) {
      const {
        data:
          updatedSettings,
        error:
          updateError,
      } =
        await adminSupabase
          .from(
            "company_settings"
          )
          .update(
            settingsPayload
          )
          .eq(
            "id",
            existing.id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .select()
          .single();

      if (
        updateError
      ) {
        console.error(
          "Company settings update error:",
          updateError
        );

        return NextResponse.json(
          {
            error:
              updateError.message,
          },
          {
            status: 500,
          }
        );
      }

      return NextResponse.json({
        ...updatedSettings,

        access: {
          isOwner:
            access.isOwner,

          permissions:
            access.permissions,

          roles:
            access.roles,

          canViewSettings:
            true,

          canManageSettings:
            true,
        },

        message:
          "Company settings updated successfully.",
      });
    }

    // =====================================================
    // INSERT
    // =====================================================

    const {
      data:
        createdSettings,
      error:
        insertError,
    } =
      await adminSupabase
        .from(
          "company_settings"
        )
        .insert([
          settingsPayload,
        ])
        .select()
        .single();

    if (
      insertError
    ) {
      console.error(
        "Company settings insert error:",
        insertError
      );

      return NextResponse.json(
        {
          error:
            insertError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        ...createdSettings,

        access: {
          isOwner:
            access.isOwner,

          permissions:
            access.permissions,

          roles:
            access.roles,

          canViewSettings:
            true,

          canManageSettings:
            true,
        },

        message:
          "Company settings created successfully.",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Company settings POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to save company settings.",
      },
      {
        status: 500,
      }
    );
  }
}

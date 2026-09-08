import {
  createAdminSupabaseClient,
} from "../supabaseAdmin";

import {
  todayDate,
} from "../utils/dates";

import {
  findMatchingRecord,
} from "../utils/matching";

// =========================================================
// LEAD -> CUSTOMER + PROJECT
// =========================================================

export async function convertLeadToCustomerAndProject({
  prompt,
  leads,
  customers = [],
  projects = [],
  organizationId,
  employeeId,
}) {
  if (!organizationId) {
    throw new Error(
      "Organisation is required to convert a lead."
    );
  }

  if (!employeeId) {
    throw new Error(
      "Employee ownership is required to convert a lead."
    );
  }

  const supabase =
    createAdminSupabaseClient();

  // =======================================================
  // FIND ACCESSIBLE LEAD
  // =======================================================

  const matchedLead =
    findMatchingRecord(
      prompt,
      leads,
      [
        "name",
        "company",
        "email",
      ]
    );

  if (!matchedLead) {
    return {
      notFound:
        true,
    };
  }

  // =======================================================
  // OWNERSHIP
  //
  // New AI-created Customer and Project records belong to
  // the employee performing the conversion.
  // =======================================================

  const ownerEmployeeId =
    employeeId;

  // =======================================================
  // EXISTING ACCESSIBLE CUSTOMER
  //
  // This makes conversion idempotent. If a previous attempt
  // already created the Customer before a later step failed,
  // rerunning the conversion reuses the existing Customer.
  // =======================================================

  let customer =
    customers?.find(
      (item) =>
        (
          matchedLead.email &&
          item.email &&
          String(
            item.email
          ).toLowerCase() ===
            String(
              matchedLead.email
            ).toLowerCase()
        ) ||
        String(
          item.lead_id ||
            ""
        ) ===
          String(
            matchedLead.id
          )
    );

  const customerAlreadyExists =
    Boolean(
      customer
    );

  /*
   * Database duplicate check is organisation-scoped.
   *
   * A hidden customer blocks duplicate creation, but its
   * details are not exposed to a caller who cannot see it.
   */
  if (!customer) {
    let existingCustomerQuery =
      supabase
        .from(
          "customers"
        )
        .select(
          "id"
        )
        .eq(
          "organization_id",
          organizationId
        );

    if (
      matchedLead.email
    ) {
      existingCustomerQuery =
        existingCustomerQuery.or(
          `lead_id.eq.${matchedLead.id},email.eq.${matchedLead.email}`
        );
    } else {
      existingCustomerQuery =
        existingCustomerQuery.eq(
          "lead_id",
          matchedLead.id
        );
    }

    const {
      data:
        existingCustomers,
      error:
        existingCustomerError,
    } =
      await existingCustomerQuery.limit(
        1
      );

    if (
      existingCustomerError
    ) {
      throw new Error(
        existingCustomerError.message
      );
    }

    if (
      existingCustomers?.length >
      0
    ) {
      return {
        notFound:
          false,

        blockedByExistingCustomer:
          true,

        customerAlreadyExists:
          true,

        projectAlreadyExists:
          false,

        lead:
          matchedLead,

        customer:
          null,

        project:
          null,
      };
    }
  }

  // =======================================================
  // CREATE CUSTOMER
  //
  // IMPORTANT:
  // The current customers table has no updated_at column.
  // =======================================================

  if (!customer) {
    const now =
      new Date()
        .toISOString();

    const {
      data:
        customerData,
      error:
        customerError,
    } =
      await supabase
        .from(
          "customers"
        )
        .insert([
          {
            organization_id:
              organizationId,

            owner_employee_id:
              ownerEmployeeId,

            lead_id:
              matchedLead.id,

            customer_name:
              matchedLead.name,

            company:
              matchedLead.company,

            email:
              matchedLead.email,

            phone:
              matchedLead.phone,

            status:
              "Active",

            created_at:
              now,
          },
        ])
        .select()
        .single();

    if (
      customerError
    ) {
      throw new Error(
        customerError.message
      );
    }

    customer =
      customerData;
  }

  // =======================================================
  // PROJECT
  //
  // Reuse an existing linked project when present so a
  // retry after a partial conversion cannot create a
  // duplicate project.
  // =======================================================

  const projectName =
    `${
      matchedLead.company ||
      matchedLead.name
    } - Project`;

  const existingProject =
    projects?.find(
      (project) =>
        String(
          project.customer_id ||
            ""
        ) ===
          String(
            customer.id
          ) &&
        String(
          project.project_name ||
            ""
        )
          .toLowerCase()
          .includes(
            String(
              matchedLead.company ||
                matchedLead.name ||
                ""
            ).toLowerCase()
          )
    );

  let project =
    existingProject;

  // =======================================================
  // CREATE PROJECT
  // =======================================================

  if (!project) {
    const {
      data:
        projectData,
      error:
        projectError,
    } =
      await supabase
        .from(
          "projects"
        )
        .insert([
          {
            organization_id:
              organizationId,

            owner_employee_id:
              ownerEmployeeId,

            customer_id:
              customer.id,

            quote_id:
              null,

            project_name:
              projectName,

            description:
              matchedLead.ai_summary ||
              (
                matchedLead.company
                  ? `Project created for ${matchedLead.company} from converted lead ${matchedLead.name || "customer"}.`
                  : `Project created from converted lead ${matchedLead.name || "customer"}.`
              ),

            status:
              "Planning",

            start_date:
              todayDate(),

            due_date:
              null,

            amount:
              matchedLead.value ||
              "",
          },
        ])
        .select()
        .single();

    if (
      projectError
    ) {
      /*
       * If this request created the Customer but Project
       * creation fails, remove that new Customer so the
       * conversion does not remain half-finished.
       *
       * Existing Customers are never deleted.
       */
      if (
        !customerAlreadyExists
      ) {
        const {
          error:
            cleanupError,
        } =
          await supabase
            .from(
              "customers"
            )
            .delete()
            .eq(
              "id",
              customer.id
            )
            .eq(
              "organization_id",
              organizationId
            );

        if (cleanupError) {
          console.error(
            "AI customer rollback failed:",
            cleanupError
          );
        }
      }

      throw new Error(
        projectError.message
      );
    }

    project =
      projectData;
  }

  // =======================================================
  // UPDATE LEAD
  //
  // IMPORTANT:
  // The current leads table has no updated_at column.
  //
  // If a previous conversion attempt already created the
  // Customer and Project, this step safely completes that
  // partial conversion without creating duplicates.
  // =======================================================

  const {
    data:
      updatedLead,
    error:
      leadUpdateError,
  } =
    await supabase
      .from(
        "leads"
      )
      .update({
        status:
          "Won",
      })
      .eq(
        "id",
        matchedLead.id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .select()
      .single();

  if (
    leadUpdateError
  ) {
    throw new Error(
      leadUpdateError.message
    );
  }

  return {
    notFound:
      false,

    blockedByExistingCustomer:
      false,

    customerAlreadyExists,

    projectAlreadyExists:
      Boolean(
        existingProject
      ),

    lead:
      updatedLead ||
      {
        ...matchedLead,
        status:
          "Won",
      },

    customer,

    project,
  };
}

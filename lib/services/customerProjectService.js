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
  projects,
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
      notFound: true,
    };
  }

  // =======================================================
  // OWNERSHIP
  //
  // Customer + Project should normally remain with the
  // employee who owned the original Lead.
  // =======================================================

  const ownerEmployeeId =
    matchedLead
      .owner_employee_id ||
    employeeId;

  // =======================================================
  // EXISTING CUSTOMER
  //
  // Start with the already RBAC-filtered customer records
  // supplied by the AI route.
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

  let customerAlreadyExists =
    Boolean(customer);

  /*
   * We also perform an organisation-scoped duplicate check
   * in the database. This protects against duplicate customer
   * creation if an older record was not present in the
   * caller's supplied list.
   *
   * We only use the result for duplicate prevention.
   */
  if (!customer) {
    let existingCustomerQuery =
      supabase
        .from(
          "customers"
        )
        .select("*")
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
      customer =
        existingCustomers[0];

      customerAlreadyExists =
        true;
    }
  }

  // =======================================================
  // CREATE CUSTOMER
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

            updated_at:
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
              customer
                ?.owner_employee_id ||
              ownerEmployeeId,

            customer_id:
              customer.id,

            quote_id:
              null,

            project_name:
              projectName,

            description:
              matchedLead.notes ||
              matchedLead.ai_summary ||
              "Project created from lead conversion.",

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
      throw new Error(
        projectError.message
      );
    }

    project =
      projectData;
  }

  // =======================================================
  // UPDATE LEAD
  // =======================================================

  const {
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

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        matchedLead.id
      )
      .eq(
        "organization_id",
        organizationId
      );

  if (
    leadUpdateError
  ) {
    throw new Error(
      leadUpdateError.message
    );
  }

  return {
    notFound: false,

    customerAlreadyExists,

    projectAlreadyExists:
      Boolean(
        existingProject
      ),

    lead:
      matchedLead,

    customer,

    project,
  };
}

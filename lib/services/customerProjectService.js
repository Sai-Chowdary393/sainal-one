import { supabase } from "../supabase";
import { todayDate } from "../utils/dates";
import { findMatchingRecord } from "../utils/matching";

export async function convertLeadToCustomerAndProject({
  prompt,
  leads,
  projects,
  organizationId,
}) {
  const matchedLead = findMatchingRecord(prompt, leads, [
    "name",
    "company",
    "email",
  ]);

  if (!matchedLead) {
    return {
      notFound: true,
    };
  }

  let existingCustomerQuery = supabase
    .from("customers")
    .select("*")
    .eq("organization_id", organizationId);

  if (matchedLead.email) {
    existingCustomerQuery = existingCustomerQuery.or(
      `lead_id.eq.${matchedLead.id},email.eq.${matchedLead.email}`
    );
  } else {
    existingCustomerQuery = existingCustomerQuery.eq(
      "lead_id",
      matchedLead.id
    );
  }

  const {
    data: existingCustomer,
    error: existingCustomerError,
  } = await existingCustomerQuery.limit(1);

  if (existingCustomerError) {
    throw new Error(existingCustomerError.message);
  }

  let customer = existingCustomer?.[0];

  if (!customer) {
    const {
      data: customerData,
      error: customerError,
    } = await supabase
      .from("customers")
      .insert([
        {
          organization_id: organizationId,
          lead_id: matchedLead.id,
          customer_name: matchedLead.name,
          company: matchedLead.company,
          email: matchedLead.email,
          phone: matchedLead.phone,
          status: "Active",
        },
      ])
      .select();

    if (customerError) {
      throw new Error(customerError.message);
    }

    customer = customerData?.[0];
  }

  const projectName = `${
    matchedLead.company || matchedLead.name
  } - Project`;

  const existingProject = projects?.find(
    (project) =>
      String(project.customer_id) === String(customer.id) &&
      String(project.project_name || "")
        .toLowerCase()
        .includes(
          String(
            matchedLead.company ||
              matchedLead.name ||
              ""
          ).toLowerCase()
        )
  );

  let project = existingProject;

  if (!project) {
    const {
      data: projectData,
      error: projectError,
    } = await supabase
      .from("projects")
      .insert([
        {
          organization_id: organizationId,
          customer_id: customer.id,
          quote_id: null,
          project_name: projectName,
          description:
            matchedLead.notes ||
            matchedLead.ai_summary ||
            "Project created from lead conversion.",
          status: "Planning",
          start_date: todayDate(),
          due_date: null,
          amount: matchedLead.value || "",
        },
      ])
      .select();

    if (projectError) {
      throw new Error(projectError.message);
    }

    project = projectData?.[0];
  }

  const { error: leadUpdateError } = await supabase
    .from("leads")
    .update({
      status: "Won",
    })
    .eq("id", matchedLead.id)
    .eq("organization_id", organizationId);

  if (leadUpdateError) {
    throw new Error(leadUpdateError.message);
  }

  return {
    notFound: false,
    customerAlreadyExists: Boolean(existingCustomer?.[0]),
    projectAlreadyExists: Boolean(existingProject),
    lead: matchedLead,
    customer,
    project,
  };
}

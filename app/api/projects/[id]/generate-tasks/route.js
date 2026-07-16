import { NextResponse } from "next/server";
import { supabase } from "../../../../../../lib/supabase";

const ORGANIZATION_ID =
  "9d5bbb05-866b-4c38-b2ac-3019e7cf88e5";

function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function formatDate(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date, numberOfDays) {
  const result = new Date(date);

  result.setDate(
    result.getDate() + numberOfDays
  );

  return result;
}

function getWebsiteTasks() {
  return [
    {
      task_name: "Project kick-off meeting",
      description:
        "Confirm objectives, stakeholders, scope and communication arrangements.",
    },
    {
      task_name: "Requirements gathering",
      description:
        "Collect detailed functional, design and content requirements.",
    },
    {
      task_name: "Content collection",
      description:
        "Collect approved text, images, branding and business information.",
    },
    {
      task_name: "Sitemap and structure",
      description:
        "Confirm pages, navigation and website structure.",
    },
    {
      task_name: "Design preparation",
      description:
        "Prepare the initial design direction and key page layouts.",
    },
    {
      task_name: "Development",
      description:
        "Build the approved website pages and core functionality.",
    },
    {
      task_name: "Forms and integrations",
      description:
        "Configure required forms, email notifications and integrations.",
    },
    {
      task_name: "Testing",
      description:
        "Test functionality, responsiveness, performance and common devices.",
    },
    {
      task_name: "Client review",
      description:
        "Share the completed work with the client and collect feedback.",
    },
    {
      task_name: "SEO and launch preparation",
      description:
        "Complete basic SEO configuration and final launch checks.",
    },
    {
      task_name: "Go live",
      description:
        "Deploy the approved website to the live environment.",
    },
    {
      task_name: "Project handover",
      description:
        "Complete handover, training and final documentation.",
    },
  ];
}

function getAutomationTasks() {
  return [
    {
      task_name: "Project kick-off meeting",
      description:
        "Confirm objectives, stakeholders, scope and communication arrangements.",
    },
    {
      task_name: "Requirements gathering",
      description:
        "Capture the business requirements, users, inputs, outputs and success criteria.",
    },
    {
      task_name: "Current process review",
      description:
        "Document the existing process, manual steps and current pain points.",
    },
    {
      task_name: "Solution design",
      description:
        "Design the proposed automation workflow, rules and integrations.",
    },
    {
      task_name: "Build and configuration",
      description:
        "Develop and configure the agreed automation solution.",
    },
    {
      task_name: "Internal testing",
      description:
        "Test workflow logic, data handling, errors and expected outcomes.",
    },
    {
      task_name: "Client review",
      description:
        "Demonstrate the solution and collect client feedback.",
    },
    {
      task_name: "User acceptance testing",
      description:
        "Support the client while they confirm the solution meets requirements.",
    },
    {
      task_name: "Deployment",
      description:
        "Release the approved automation to the live environment.",
    },
    {
      task_name: "Training and handover",
      description:
        "Provide user guidance, documentation and final handover.",
    },
  ];
}

function getDevOpsTasks() {
  return [
    {
      task_name: "Project kick-off meeting",
      description:
        "Confirm objectives, scope, environments, stakeholders and access requirements.",
    },
    {
      task_name: "Environment assessment",
      description:
        "Review the existing cloud, infrastructure and deployment environment.",
    },
    {
      task_name: "Access and permissions",
      description:
        "Confirm required accounts, permissions, repositories and credentials.",
    },
    {
      task_name: "Architecture and implementation plan",
      description:
        "Document the target setup, delivery stages and technical approach.",
    },
    {
      task_name: "Pipeline or infrastructure build",
      description:
        "Configure the agreed cloud, infrastructure or DevOps solution.",
    },
    {
      task_name: "Security and configuration review",
      description:
        "Review secrets, access controls, configuration and operational risks.",
    },
    {
      task_name: "Testing",
      description:
        "Test deployment, rollback, monitoring and expected operational behaviour.",
    },
    {
      task_name: "Client review",
      description:
        "Demonstrate the completed implementation and collect feedback.",
    },
    {
      task_name: "Production deployment",
      description:
        "Release the approved implementation to production.",
    },
    {
      task_name: "Documentation and handover",
      description:
        "Provide documentation, support guidance and final handover.",
    },
  ];
}

function getApplicationTasks() {
  return [
    {
      task_name: "Project kick-off meeting",
      description:
        "Confirm objectives, stakeholders, scope and communication arrangements.",
    },
    {
      task_name: "Requirements gathering",
      description:
        "Capture functional, technical and user requirements.",
    },
    {
      task_name: "Solution architecture",
      description:
        "Confirm the application structure, data model and integrations.",
    },
    {
      task_name: "User experience and interface design",
      description:
        "Prepare the application flow, screens and user experience.",
    },
    {
      task_name: "Development",
      description:
        "Build the agreed application features.",
    },
    {
      task_name: "Integration configuration",
      description:
        "Connect required external systems and services.",
    },
    {
      task_name: "Internal testing",
      description:
        "Test functionality, validation, security and error handling.",
    },
    {
      task_name: "Client review",
      description:
        "Demonstrate the application and collect feedback.",
    },
    {
      task_name: "User acceptance testing",
      description:
        "Support formal client testing and approval.",
    },
    {
      task_name: "Deployment",
      description:
        "Release the approved application to the live environment.",
    },
    {
      task_name: "Training and handover",
      description:
        "Provide documentation, user guidance and final handover.",
    },
  ];
}

function getGeneralServiceTasks() {
  return [
    {
      task_name: "Project kick-off meeting",
      description:
        "Confirm objectives, stakeholders, scope and communication arrangements.",
    },
    {
      task_name: "Requirements gathering",
      description:
        "Capture the detailed client requirements and expected outcomes.",
    },
    {
      task_name: "Scope confirmation",
      description:
        "Confirm deliverables, assumptions, responsibilities and exclusions.",
    },
    {
      task_name: "Delivery planning",
      description:
        "Prepare the delivery plan, schedule and key milestones.",
    },
    {
      task_name: "Work execution",
      description:
        "Complete the agreed project work and deliverables.",
    },
    {
      task_name: "Internal quality review",
      description:
        "Review the work for quality, completeness and accuracy.",
    },
    {
      task_name: "Client review",
      description:
        "Share the completed work with the client and collect feedback.",
    },
    {
      task_name: "Final revisions",
      description:
        "Complete agreed final changes following client review.",
    },
    {
      task_name: "Delivery",
      description:
        "Deliver the approved work to the client.",
    },
    {
      task_name: "Project handover and closure",
      description:
        "Complete documentation, handover and project closure.",
    },
  ];
}

function getTaskTemplate(project) {
  const projectText = normalise(
    `${project.project_name || ""} ${
      project.description || ""
    }`
  );

  if (
    projectText.includes("website") ||
    projectText.includes("web development") ||
    projectText.includes("ecommerce") ||
    projectText.includes("e-commerce")
  ) {
    return getWebsiteTasks();
  }

  if (
    projectText.includes("automation") ||
    projectText.includes("workflow") ||
    projectText.includes("process")
  ) {
    return getAutomationTasks();
  }

  if (
    projectText.includes("devops") ||
    projectText.includes("cloud") ||
    projectText.includes("infrastructure") ||
    projectText.includes("pipeline")
  ) {
    return getDevOpsTasks();
  }

  if (
    projectText.includes("application") ||
    projectText.includes("app development") ||
    projectText.includes("software") ||
    projectText.includes("custom app")
  ) {
    return getApplicationTasks();
  }

  return getGeneralServiceTasks();
}

export async function POST(request, context) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Project ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: project, error: projectError } =
      await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .eq(
          "organization_id",
          ORGANIZATION_ID
        )
        .single();

    if (projectError || !project) {
      return NextResponse.json(
        {
          error:
            projectError?.message ||
            "Project not found.",
        },
        {
          status: 404,
        }
      );
    }

    const {
      data: existingTasks,
      error: existingTasksError,
    } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", project.id)
      .eq(
        "organization_id",
        ORGANIZATION_ID
      );

    if (existingTasksError) {
      return NextResponse.json(
        {
          error:
            existingTasksError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      Array.isArray(existingTasks) &&
      existingTasks.length > 0
    ) {
      return NextResponse.json({
        message:
          "This project already has tasks. No duplicate default tasks were created.",
        alreadyExists: true,
        tasks: existingTasks,
      });
    }

    const taskTemplate =
      getTaskTemplate(project);

    const startingDate = project.start_date
      ? new Date(
          `${project.start_date}T12:00:00`
        )
      : new Date();

    const taskRows = taskTemplate.map(
      (task, index) => ({
        organization_id:
          ORGANIZATION_ID,

        project_id:
          project.id,

        task_name:
          task.task_name,

        description:
          task.description,

        status:
          "To Do",

        due_date:
          formatDate(
            addDays(
              startingDate,
              (index + 1) * 2
            )
          ),
      })
    );

    const {
      data: createdTasks,
      error: createTasksError,
    } = await supabase
      .from("tasks")
      .insert(taskRows)
      .select();

    if (createTasksError) {
      return NextResponse.json(
        {
          error:
            createTasksError.message,
        },
        {
          status: 500,
        }
      );
    }

    const {
      error: projectUpdateError,
    } = await supabase
      .from("projects")
      .update({
        status: "Planning",
      })
      .eq("id", project.id)
      .eq(
        "organization_id",
        ORGANIZATION_ID
      );

    if (projectUpdateError) {
      console.error(
        "Tasks created but project status update failed:",
        projectUpdateError
      );
    }

    return NextResponse.json({
      message: `${createdTasks.length} default tasks created successfully.`,
      alreadyExists: false,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error(
      "Generate default tasks error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Failed to generate default tasks.",
      },
      {
        status: 500,
      }
    );
  }
}

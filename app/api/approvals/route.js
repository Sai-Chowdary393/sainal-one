import {
  NextResponse,
} from "next/server";

import {
  canManageWorkflows,
  getServerAccess,
} from "../../../lib/serverAccess";

import {
  createAdminSupabaseClient,
} from "../../../lib/supabaseAdmin";

import {
  resumeApprovalStep,
} from "../../../lib/workflow-runtime/runner";

// =========================================================
// HELPERS
// =========================================================

function isUuid(
  value
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(
      value ||
        ""
    )
  );
}

// =========================================================
// GET APPROVALS
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

    const organizationId =
      access.employee
        .organization_id;

    const currentEmployeeId =
      access.employee.id;

    const canManage =
      canManageWorkflows(
        access
      );

    // =====================================================
    // STEP RUNS
    // =====================================================

    let query =
      access.supabase
        .from(
          "workflow_step_runs"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

    if (
      !canManage
    ) {
      query =
        query.eq(
          "assigned_employee_id",
          currentEmployeeId
        );
    }

    const {
      data:
        stepRuns,
      error:
        stepRunsError,
    } =
      await query;

    if (
      stepRunsError
    ) {
      throw new Error(
        `Unable to load approvals: ${stepRunsError.message}`
      );
    }

    const allStepRuns =
      stepRuns ||
      [];

    if (
      allStepRuns.length ===
      0
    ) {
      return NextResponse.json({
        approvals: [],
        employees: [],
        currentEmployee:
          access.employee,
        canManage,

        summary: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          changesRequested: 0,
        },
      });
    }

    // =====================================================
    // WORKFLOW STEPS
    // =====================================================

    const workflowStepIds =
      [
        ...new Set(
          allStepRuns
            .map(
              (
                item
              ) =>
                item.workflow_step_id
            )
            .filter(Boolean)
        ),
      ];

    const {
      data:
        workflowSteps,
      error:
        workflowStepsError,
    } =
      workflowStepIds.length >
      0
        ? await access.supabase
            .from(
              "workflow_steps"
            )
            .select("*")
            .eq(
              "organization_id",
              organizationId
            )
            .in(
              "id",
              workflowStepIds
            )
        : {
            data: [],
            error: null,
          };

    if (
      workflowStepsError
    ) {
      throw new Error(
        `Unable to load approval workflow steps: ${workflowStepsError.message}`
      );
    }

    const approvalStepIds =
      new Set(
        (
          workflowSteps ||
          []
        )
          .filter(
            (
              step
            ) =>
              step.step_type ===
              "Approval"
          )
          .map(
            (
              step
            ) =>
              step.id
          )
      );

    const approvalRuns =
      allStepRuns.filter(
        (
          item
        ) =>
          approvalStepIds.has(
            item.workflow_step_id
          )
      );

    if (
      approvalRuns.length ===
      0
    ) {
      return NextResponse.json({
        approvals: [],
        employees: [],
        currentEmployee:
          access.employee,
        canManage,

        summary: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          changesRequested: 0,
        },
      });
    }

    // =====================================================
    // WORKFLOW RUNS
    // =====================================================

    const workflowRunIds =
      [
        ...new Set(
          approvalRuns
            .map(
              (
                item
              ) =>
                item.workflow_run_id
            )
            .filter(Boolean)
        ),
      ];

    const {
      data:
        workflowRuns,
      error:
        workflowRunsError,
    } =
      await access.supabase
        .from(
          "workflow_runs"
        )
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .in(
          "id",
          workflowRunIds
        );

    if (
      workflowRunsError
    ) {
      throw new Error(
        `Unable to load approval workflow runs: ${workflowRunsError.message}`
      );
    }

    // =====================================================
    // WORKFLOW DEFINITIONS
    // =====================================================

    const workflowIds =
      [
        ...new Set(
          (
            workflowRuns ||
            []
          )
            .map(
              (
                item
              ) =>
                item.workflow_id
            )
            .filter(Boolean)
        ),
      ];

    const {
      data:
        workflows,
      error:
        workflowsError,
    } =
      workflowIds.length >
      0
        ? await access.supabase
            .from(
              "workflows"
            )
            .select(
              `
                id,
                name,
                code,
                module,
                trigger_event,
                status
              `
            )
            .eq(
              "organization_id",
              organizationId
            )
            .in(
              "id",
              workflowIds
            )
        : {
            data: [],
            error: null,
          };

    if (
      workflowsError
    ) {
      throw new Error(
        `Unable to load approval workflows: ${workflowsError.message}`
      );
    }

    // =====================================================
    // EMPLOYEES
    // =====================================================

    const {
      data:
        employees,
      error:
        employeesError,
    } =
      await access.supabase
        .from(
          "employees"
        )
        .select(
          `
            id,
            employee_number,
            full_name,
            email,
            job_title,
            employment_status,
            availability_status,
            is_active
          `
        )
        .eq(
          "organization_id",
          organizationId
        )
        .order(
          "full_name",
          {
            ascending:
              true,
          }
        );

    if (
      employeesError
    ) {
      throw new Error(
        `Unable to load approval employees: ${employeesError.message}`
      );
    }

    const employeeMap =
      new Map(
        (
          employees ||
          []
        ).map(
          (
            employee
          ) => [
            employee.id,
            employee,
          ]
        )
      );

    const stepMap =
      new Map(
        (
          workflowSteps ||
          []
        ).map(
          (
            step
          ) => [
            step.id,
            step,
          ]
        )
      );

    const runMap =
      new Map(
        (
          workflowRuns ||
          []
        ).map(
          (
            run
          ) => [
            run.id,
            run,
          ]
        )
      );

    const workflowMap =
      new Map(
        (
          workflows ||
          []
        ).map(
          (
            workflow
          ) => [
            workflow.id,
            workflow,
          ]
        )
      );

    const approvals =
      approvalRuns.map(
        (
          stepRun
        ) => {
          const step =
            stepMap.get(
              stepRun.workflow_step_id
            ) ||
            null;

          const run =
            runMap.get(
              stepRun.workflow_run_id
            ) ||
            null;

          const workflow =
            run
              ? workflowMap.get(
                  run.workflow_id
                ) ||
                null
              : null;

          const assignedEmployee =
            stepRun.assigned_employee_id
              ? employeeMap.get(
                  stepRun.assigned_employee_id
                ) ||
                null
              : null;

          return {
            ...stepRun,

            step,

            workflow_run:
              run,

            workflow,

            assigned_employee:
              assignedEmployee,

            decided_by_employee:
              stepRun.decided_by
                ? employeeMap.get(
                    stepRun.decided_by
                  ) ||
                  null
                : null,

            delegated_employee:
              stepRun.delegated_to
                ? employeeMap.get(
                    stepRun.delegated_to
                  ) ||
                  null
                : null,

            can_decide:
              Boolean(
                canManage ||
                (
                  stepRun.assigned_employee_id &&
                  String(
                    stepRun.assigned_employee_id
                  ) ===
                    String(
                      currentEmployeeId
                    )
                )
              ),
          };
        }
      );

    const pending =
      approvals.filter(
        (
          item
        ) =>
          item.status ===
            "Pending" ||
          item.status ===
            "Waiting"
      ).length;

    const approved =
      approvals.filter(
        (
          item
        ) =>
          item.decision ===
          "Approved"
      ).length;

    const rejected =
      approvals.filter(
        (
          item
        ) =>
          item.decision ===
          "Rejected"
      ).length;

    const changesRequested =
      approvals.filter(
        (
          item
        ) =>
          item.decision ===
          "RequestChanges"
      ).length;

    return NextResponse.json({
      approvals,

      employees:
        (
          employees ||
          []
        ).filter(
          (
            employee
          ) =>
            employee.is_active !==
              false &&
            employee.employment_status !==
              "Inactive"
        ),

      currentEmployee:
        access.employee,

      canManage,

      summary: {
        total:
          approvals.length,

        pending,

        approved,

        rejected,

        changesRequested,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Approvals GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load approvals.",
      },
      {
        status:
          500,
      }
    );
  }
}

// =========================================================
// PATCH APPROVAL DECISION
// =========================================================

export async function PATCH(
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

    const body =
      await request.json();

    const stepRunId =
      String(
        body.step_run_id ||
        ""
      ).trim();

    const decision =
      String(
        body.decision ||
        ""
      ).trim();

    if (
      !isUuid(
        stepRunId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid approval ID is required.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      ![
        "Approved",
        "Rejected",
      ].includes(
        decision
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Decision must be Approved or Rejected.",
        },
        {
          status:
            400,
        }
      );
    }

    const organizationId =
      access.employee
        .organization_id;

    const currentEmployeeId =
      access.employee.id;

    const canManage =
      canManageWorkflows(
        access
      );

    const supabase =
      createAdminSupabaseClient();

    // =====================================================
    // VERIFY STEP RUN
    // =====================================================

    const {
      data:
        stepRun,
      error:
        stepRunError,
    } =
      await supabase
        .from(
          "workflow_step_runs"
        )
        .select("*")
        .eq(
          "id",
          stepRunId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

    if (
      stepRunError
    ) {
      throw new Error(
        stepRunError.message
      );
    }

    if (!stepRun) {
      return NextResponse.json(
        {
          error:
            "Approval was not found.",
        },
        {
          status:
            404,
        }
      );
    }

    if (
      ![
        "Pending",
        "Waiting",
      ].includes(
        stepRun.status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "This approval has already been decided.",
        },
        {
          status:
            400,
        }
      );
    }

    // =====================================================
    // CONFIRM IT IS AN APPROVAL STEP
    // =====================================================

    const {
      data:
        workflowStep,
      error:
        workflowStepError,
    } =
      await supabase
        .from(
          "workflow_steps"
        )
        .select(
          "id, step_type, name"
        )
        .eq(
          "id",
          stepRun.workflow_step_id
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

    if (
      workflowStepError
    ) {
      throw new Error(
        workflowStepError.message
      );
    }

    if (
      !workflowStep ||
      workflowStep.step_type !==
        "Approval"
    ) {
      return NextResponse.json(
        {
          error:
            "The selected workflow step is not an approval.",
        },
        {
          status:
            400,
        }
      );
    }

    // =====================================================
    // AUTHORISATION
    // =====================================================
    //
    // Normal case:
    // Assigned manager approves.
    //
    // Owner / workflow manager:
    // Can manage a stuck/unassigned approval.
    //
    // =====================================================

    const isAssignedApprover =
      Boolean(
        stepRun.assigned_employee_id &&
        String(
          stepRun.assigned_employee_id
        ) ===
          String(
            currentEmployeeId
          )
      );

    if (
      !canManage &&
      !isAssignedApprover
    ) {
      return NextResponse.json(
        {
          error:
            "This approval is assigned to another employee.",
        },
        {
          status:
            403,
        }
      );
    }

    const result =
      await resumeApprovalStep({
        supabase,
        organizationId,

        stepRunId,

        decision,

        decidedByEmployeeId:
          currentEmployeeId,
      });

    return NextResponse.json({
      message:
        decision ===
          "Approved"
          ? "Approval completed successfully."
          : "Quote rejected successfully.",

      decision,

      result,
    });
  } catch (
    error
  ) {
    console.error(
      "Approval PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to process approval.",
      },
      {
        status:
          500,
      }
    );
  }
}

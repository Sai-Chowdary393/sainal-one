import {
  NextResponse,
} from "next/server";

import {
  getServerAccess,
} from "../../../../../lib/serverAccess";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

// =========================================================
// GET QUOTE WORKFLOW HISTORY
// =========================================================
//
// GET /api/quotes/:id/workflow-history
//
// Returns all workflow runs belonging to the selected quote,
// together with their workflow step execution history.
//
// =========================================================

export async function GET(
  request,
  context
) {
  try {
    const { id } =
      await context.params;

    // -----------------------------------------------------
    // VALIDATE QUOTE ID
    // -----------------------------------------------------

    if (!isUuid(id)) {
      return NextResponse.json(
        {
          error:
            "A valid quote ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------------------------------
    // ACCESS
    // -----------------------------------------------------

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

    const supabase =
      access.supabase;

    const organizationId =
      access.employee
        .organization_id;

    // -----------------------------------------------------
    // CONFIRM QUOTE BELONGS TO ORGANISATION
    // -----------------------------------------------------

    const {
      data: quote,
      error: quoteError,
    } = await supabase
      .from("quotes")
      .select(
        "id, quote_number, status"
      )
      .eq(
        "id",
        id
      )
      .eq(
        "organization_id",
        organizationId
      )
      .maybeSingle();

    if (quoteError) {
      throw new Error(
        `Unable to verify quote: ${quoteError.message}`
      );
    }

    if (!quote) {
      return NextResponse.json(
        {
          error:
            "Quote not found.",
        },
        {
          status: 404,
        }
      );
    }

    // -----------------------------------------------------
    // LOAD WORKFLOW RUNS FOR THIS QUOTE
    // -----------------------------------------------------

    const {
      data: workflowRuns,
      error: workflowRunsError,
    } = await supabase
      .from("workflow_runs")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "record_id",
        id
      )
      .eq(
        "record_type",
        "quote"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (workflowRunsError) {
      throw new Error(
        `Unable to load workflow runs: ${workflowRunsError.message}`
      );
    }

    const runs =
      workflowRuns || [];

    // No workflow has run for this quote yet.
    if (!runs.length) {
      return NextResponse.json({
        quote: {
          id:
            quote.id,

          quote_number:
            quote.quote_number,

          status:
            quote.status,
        },

        runs: [],

        total_runs: 0,
      });
    }

    // -----------------------------------------------------
    // LOAD WORKFLOW INFORMATION
    // -----------------------------------------------------

    const workflowIds = [
      ...new Set(
        runs
          .map(
            (run) =>
              run.workflow_id
          )
          .filter(Boolean)
      ),
    ];

    let workflows = [];

    if (workflowIds.length) {
      const {
        data,
        error,
      } = await supabase
        .from("workflows")
        .select(
          "id, name, description"
        )
        .eq(
          "organization_id",
          organizationId
        )
        .in(
          "id",
          workflowIds
        );

      if (error) {
        throw new Error(
          `Unable to load workflows: ${error.message}`
        );
      }

      workflows =
        data || [];
    }

    const workflowMap =
      new Map(
        workflows.map(
          (workflow) => [
            workflow.id,
            workflow,
          ]
        )
      );

    // -----------------------------------------------------
    // LOAD STEP RUNS
    // -----------------------------------------------------

    const workflowRunIds =
      runs.map(
        (run) => run.id
      );

    const {
      data: stepRuns,
      error: stepRunsError,
    } = await supabase
      .from(
        "workflow_step_runs"
      )
      .select("*")
      .in(
        "workflow_run_id",
        workflowRunIds
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (stepRunsError) {
      throw new Error(
        `Unable to load workflow step runs: ${stepRunsError.message}`
      );
    }

    const allStepRuns =
      stepRuns || [];

    // -----------------------------------------------------
    // LOAD STEP DEFINITIONS
    // -----------------------------------------------------

    const workflowStepIds = [
      ...new Set(
        allStepRuns
          .map(
            (stepRun) =>
              stepRun.workflow_step_id
          )
          .filter(Boolean)
      ),
    ];

    let workflowSteps = [];

    if (
      workflowStepIds.length
    ) {
      const {
        data,
        error,
      } = await supabase
        .from(
          "workflow_steps"
        )
        .select(
          "id, workflow_id, name, step_type, step_order"
        )
        .in(
          "id",
          workflowStepIds
        );

      if (error) {
        throw new Error(
          `Unable to load workflow steps: ${error.message}`
        );
      }

      workflowSteps =
        data || [];
    }

    const stepMap =
      new Map(
        workflowSteps.map(
          (step) => [
            step.id,
            step,
          ]
        )
      );

    // -----------------------------------------------------
    // BUILD CLEAN HISTORY RESPONSE
    // -----------------------------------------------------

    const history =
      runs.map(
        (run) => {
          const workflow =
            workflowMap.get(
              run.workflow_id
            );

          const runSteps =
            allStepRuns
              .filter(
                (stepRun) =>
                  stepRun.workflow_run_id ===
                  run.id
              )
              .map(
                (stepRun) => {
                  const definition =
                    stepMap.get(
                      stepRun.workflow_step_id
                    );

                  return {
                    id:
                      stepRun.id,

                    workflow_step_id:
                      stepRun.workflow_step_id,

                    name:
                      definition?.name ||
                      stepRun.step_name ||
                      "Workflow step",

                    step_type:
                      definition?.step_type ||
                      stepRun.step_type ||
                      "Action",

                    step_order:
                      definition?.step_order ??
                      stepRun.step_order ??
                      null,

                    status:
                      stepRun.status ||
                      "Unknown",

                    started_at:
                      stepRun.started_at ||
                      stepRun.created_at ||
                      null,

                    completed_at:
                      stepRun.completed_at ||
                      null,

                    error_message:
                      stepRun.error_message ||
                      stepRun.error ||
                      null,

                    result:
                      stepRun.result ||
                      stepRun.output ||
                      null,
                  };
                }
              )
              .sort(
                (a, b) =>
                  Number(
                    a.step_order ??
                      999
                  ) -
                  Number(
                    b.step_order ??
                      999
                  )
              );

          return {
            id:
              run.id,

            workflow_id:
              run.workflow_id,

            workflow_name:
              workflow?.name ||
              "Workflow",

            workflow_description:
              workflow?.description ||
              "",

            status:
              run.status ||
              "Unknown",

            started_at:
              run.started_at ||
              run.created_at ||
              null,

            completed_at:
              run.completed_at ||
              null,

            created_at:
              run.created_at ||
              null,

            steps:
              runSteps,

            step_count:
              runSteps.length,
          };
        }
      );

    // -----------------------------------------------------
    // RESPONSE
    // -----------------------------------------------------

    return NextResponse.json({
      quote: {
        id:
          quote.id,

        quote_number:
          quote.quote_number,

        status:
          quote.status,
      },

      runs:
        history,

      total_runs:
        history.length,
    });
  } catch (error) {
    console.error(
      "Quote workflow history GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Unable to load workflow history.",
      },
      {
        status: 500,
      }
    );
  }
}

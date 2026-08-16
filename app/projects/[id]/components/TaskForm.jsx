"use client";

import styles from "../project-details.module.css";

const TASK_STATUS_OPTIONS = [
  "To Do",
  "In Progress",
  "Completed",
  "Blocked",
];

export default function TaskForm({
  formData,
  employees = [],
  currentEmployeeId = null,
  saving = false,
  loadingEmployees = false,
  onChange,
  onSubmit,
  onCancel,
}) {
  const availableEmployees =
    Array.isArray(employees)
      ? employees.filter(
          (employee) =>
            employee?.id &&
            employee?.is_active !== false
        )
      : [];

  return (
    <section
      className={
        styles.taskFormPanel
      }
    >
      <div
        className={
          styles.taskFormHeader
        }
      >
        <h3>
          Add project task
        </h3>

        <p>
          Create a task, assign it
          to a team member and set
          its delivery status and
          due date.
        </p>
      </div>

      <form
        className={
          styles.taskForm
        }
        onSubmit={
          onSubmit
        }
      >
        <div
          className={
            styles.formGrid
          }
        >
          {/* TASK NAME */}

          <div
            className={`${styles.field} ${styles.fieldFull}`}
          >
            <label
              htmlFor="task-name"
            >
              Task name *
            </label>

            <input
              id="task-name"
              name="task_name"
              type="text"
              value={
                formData.task_name ||
                ""
              }
              onChange={
                onChange
              }
              placeholder="Example: Arrange project kickoff meeting"
              disabled={
                saving
              }
              required
            />
          </div>

          {/* DESCRIPTION */}

          <div
            className={`${styles.field} ${styles.fieldFull}`}
          >
            <label
              htmlFor="task-description"
            >
              Description
            </label>

            <textarea
              id="task-description"
              name="description"
              value={
                formData.description ||
                ""
              }
              onChange={
                onChange
              }
              placeholder="Add task instructions, requirements or expected outcome."
              rows={
                5
              }
              disabled={
                saving
              }
            />
          </div>

          {/* ASSIGNED TO */}

          <div
            className={
              styles.field
            }
          >
            <label
              htmlFor="task-assigned-employee"
            >
              Assigned to
            </label>

            <select
              id="task-assigned-employee"
              name="assigned_employee_id"
              value={
                formData.assigned_employee_id ||
                ""
              }
              onChange={
                onChange
              }
              disabled={
                saving ||
                loadingEmployees
              }
            >
              <option value="">
                {loadingEmployees
                  ? "Loading employees..."
                  : "Unassigned"}
              </option>

              {availableEmployees.map(
                (employee) => {
                  const employeeName =
                    employee.full_name ||
                    employee.email ||
                    employee.employee_number ||
                    "Employee";

                  const isCurrentEmployee =
                    currentEmployeeId &&
                    String(
                      employee.id
                    ) ===
                      String(
                        currentEmployeeId
                      );

                  return (
                    <option
                      key={
                        employee.id
                      }
                      value={
                        employee.id
                      }
                    >
                      {employeeName}
                      {employee.job_title
                        ? ` — ${employee.job_title}`
                        : ""}
                      {isCurrentEmployee
                        ? " (You)"
                        : ""}
                    </option>
                  );
                }
              )}
            </select>

            {!loadingEmployees &&
              availableEmployees.length ===
                0 && (
                <small>
                  No active employees
                  are available for
                  assignment.
                </small>
              )}
          </div>

          {/* STATUS */}

          <div
            className={
              styles.field
            }
          >
            <label
              htmlFor="task-status"
            >
              Status
            </label>

            <select
              id="task-status"
              name="status"
              value={
                formData.status ||
                "To Do"
              }
              onChange={
                onChange
              }
              disabled={
                saving
              }
            >
              {TASK_STATUS_OPTIONS.map(
                (status) => (
                  <option
                    key={
                      status
                    }
                    value={
                      status
                    }
                  >
                    {status}
                  </option>
                )
              )}
            </select>
          </div>

          {/* DUE DATE */}

          <div
            className={
              styles.field
            }
          >
            <label
              htmlFor="task-due-date"
            >
              Due date
            </label>

            <input
              id="task-due-date"
              name="due_date"
              type="date"
              value={
                formData.due_date ||
                ""
              }
              onChange={
                onChange
              }
              disabled={
                saving
              }
            />
          </div>
        </div>

        <div
          className={
            styles.formActions
          }
        >
          <button
            type="button"
            className={
              styles.secondaryButton
            }
            onClick={
              onCancel
            }
            disabled={
              saving
            }
          >
            Cancel
          </button>

          <button
            type="submit"
            className={
              styles.primaryButton
            }
            disabled={
              saving
            }
          >
            {saving
              ? "Saving task..."
              : "Save task"}
          </button>
        </div>
      </form>
    </section>
  );
}

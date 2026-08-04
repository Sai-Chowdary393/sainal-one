import Link from "next/link";

import StatusBadge from "../../../components/StatusBadge";

import {
  formatDate,
  formatProjectAmount,
} from "../project-utils";

import styles from "../projects.module.css";

export default function ProjectsTable({
  projects,
  loading,
  errorMessage,
  filtersActive,
  onRetry,
  onClearFilters,
  onCreateProject,
}) {
  if (loading) {
    return <LoadingState />;
  }

  if (errorMessage) {
    return (
      <section
        className={
          styles.errorPanel
        }
      >
        <div>
          <strong>
            Unable to load projects
          </strong>

          <p>{errorMessage}</p>
        </div>

        <button
          type="button"
          className={
            styles.secondaryButton
          }
          onClick={onRetry}
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section
      className={
        styles.tablePanel
      }
    >
      <div
        className={
          styles.tableHeading
        }
      >
        <div>
          <h3>
            Project records
          </h3>

          <p>
            Open a project workspace
            to manage tasks, progress,
            invoicing and delivery risk.
          </p>
        </div>

        <span
          className={
            styles.resultCount
          }
        >
          {projects.length} result
          {projects.length === 1
            ? ""
            : "s"}
        </span>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          hasFilters={
            filtersActive
          }
          onClearFilters={
            onClearFilters
          }
          onCreateProject={
            onCreateProject
          }
        />
      ) : (
        <div
          className={
            styles.tableWrapper
          }
        >
          <table
            className={
              styles.projectTable
            }
          >
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Progress</th>
                <th>Start date</th>
                <th>Due date</th>
                <th>Created</th>
                <th
                  aria-label="Actions"
                />
              </tr>
            </thead>

            <tbody>
              {projects.map(
                (project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                  />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProjectRow({
  project,
}) {
  const delayed =
    project.metrics.delayed;

  return (
    <tr>
      <td>
        <div
          className={
            styles.projectIdentity
          }
        >
          <span
            className={
              styles.projectIcon
            }
          >
            ▰
          </span>

          <div
            className={
              styles.projectIdentityCopy
            }
          >
            <Link
              href={`/projects/${project.id}`}
              className={
                styles.projectLink
              }
            >
              {project.project_name ||
                "Unnamed project"}
            </Link>

            <small>
              {project.description ||
                "Open delivery workspace"}
            </small>
          </div>
        </div>
      </td>

      <td>
        <StatusBadge
          status={
            project.status ||
            "Planning"
          }
        />
      </td>

      <td>
        <strong
          className={
            styles.amountText
          }
        >
          {formatProjectAmount(
            project.amount
          )}
        </strong>
      </td>

      <td>
        <ProjectProgress
          progress={
            project.metrics.progress
          }
          completed={
            project.metrics
              .completedTasks
          }
          total={
            project.metrics.totalTasks
          }
        />
      </td>

      <td>
        <span
          className={
            styles.dateText
          }
        >
          {formatDate(
            project.start_date
          )}
        </span>
      </td>

      <td>
        <span
          className={`${styles.dateText} ${
            delayed
              ? styles.dateTextOverdue
              : ""
          }`}
        >
          {formatDate(
            project.due_date
          )}
        </span>

        {delayed && (
          <span
            className={
              styles.overdueLabel
            }
          >
            Delayed
          </span>
        )}
      </td>

      <td>
        <span
          className={
            styles.createdDate
          }
        >
          {formatDate(
            project.created_at
          )}
        </span>
      </td>

      <td>
        <Link
          href={`/projects/${project.id}`}
          className={
            styles.openButton
          }
        >
          Open
          <span>→</span>
        </Link>
      </td>
    </tr>
  );
}

function ProjectProgress({
  progress,
  completed,
  total,
}) {
  const safeProgress = Math.max(
    0,
    Math.min(100, progress)
  );

  return (
    <div
      className={
        styles.progressCell
      }
    >
      <div
        className={
          styles.progressTrack
        }
      >
        <div
          className={
            styles.progressFill
          }
          style={{
            width: `${safeProgress}%`,
          }}
        />
      </div>

      <div
        className={
          styles.progressMeta
        }
      >
        <span>
          {completed}/{total} tasks
        </span>

        <strong>
          {safeProgress}%
        </strong>
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClearFilters,
  onCreateProject,
}) {
  return (
    <div
      className={
        styles.emptyState
      }
    >
      <span
        className={
          styles.emptyIcon
        }
      >
        ▰
      </span>

      <h3>
        {hasFilters
          ? "No matching projects"
          : "No projects yet"}
      </h3>

      <p>
        {hasFilters
          ? "Try changing or clearing the current search and status filter."
          : "Create your first project to begin managing delivery, tasks and invoicing."}
      </p>

      <button
        type="button"
        className={
          styles.primaryButton
        }
        onClick={
          hasFilters
            ? onClearFilters
            : onCreateProject
        }
      >
        {hasFilters
          ? "Clear filters"
          : "Create project"}
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <section
      className={
        styles.loadingPanel
      }
    >
      {Array.from({
        length: 5,
      }).map((_, index) => (
        <div
          key={index}
          className={
            styles.loadingRow
          }
        />
      ))}
    </section>
  );
}

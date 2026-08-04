export const COMPLETED_STATUSES = [
  "completed",
  "complete",
  "done",
];

export function buildProjectRecords(
  projects,
  tasks
) {
  return projects.map((project) => {
    const projectTasks = tasks.filter(
      (task) =>
        String(task.project_id) ===
        String(project.id)
    );

    const completedTasks =
      projectTasks.filter((task) =>
        COMPLETED_STATUSES.includes(
          normaliseStatus(
            task.status
          )
        )
      ).length;

    const overdueTasks =
      projectTasks.filter(
        (task) =>
          isDateOverdue(
            task.due_date
          ) &&
          !COMPLETED_STATUSES.includes(
            normaliseStatus(
              task.status
            )
          )
      ).length;

    const progress =
      projectTasks.length === 0
        ? 0
        : Math.round(
            (completedTasks /
              projectTasks.length) *
              100
          );

    const completed =
      COMPLETED_STATUSES.includes(
        normaliseStatus(
          project.status
        )
      );

    const delayed =
      !completed &&
      (isDateOverdue(
        project.due_date
      ) ||
        overdueTasks > 0);

    return {
      ...project,

      metrics: {
        totalTasks:
          projectTasks.length,

        completedTasks,

        overdueTasks,

        progress,

        delayed,
      },
    };
  });
}

export function normaliseStatus(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function getMoneyValue(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const cleanedValue = String(
    value
  )
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsedValue =
    Number.parseFloat(
      cleanedValue
    );

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : 0;
}

export function formatCurrency(
  value
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  ).format(value || 0);
}

export function formatProjectAmount(
  value
) {
  if (!value) {
    return "Not set";
  }

  return formatCurrency(
    getMoneyValue(value)
  );
}

export function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = String(
    value
  ).includes("T")
    ? new Date(value)
    : new Date(
        `${value}T12:00:00`
      );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

export function isDateOverdue(
  value
) {
  if (!value) {
    return false;
  }

  const date = String(
    value
  ).includes("T")
    ? new Date(value)
    : new Date(
        `${value}T23:59:59`
      );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  return date < new Date();
}

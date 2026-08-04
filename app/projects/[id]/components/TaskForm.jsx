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
  saving = false,
  onChange,
  onSubmit,
  onCancel,
}) {
  return (
    <section className={styles.taskFormPanel}>
      <div className={styles.taskFormHeader}>
        <h3>Add project task</h3>

        <p>
          Create a new task with a description, status and due date.
        </p>
      </div>

      <form
        className={styles.taskForm}
        onSubmit={onSubmit}
      >
        <div className={styles.formGrid}>
          <div
            className={`${styles.field} ${styles.fieldFull}`}
          >
            <label htmlFor="task-name">
              Task name *
            </label>

            <input
              id="task-name"
              name="task_name"
              type="text"
              value={formData.task_name}
              onChange={onChange}
              placeholder="Example: Arrange project kickoff meeting"
              disabled={saving}
              required
            />
          </div>

          <div
            className={`${styles.field} ${styles.fieldFull}`}
          >
            <label htmlFor="task-description">
              Description
            </label>

            <textarea
              id="task-description"
              name="description"
              value={formData.description}
              onChange={onChange}
              placeholder="Add task instructions, requirements or expected outcome."
              rows={5}
              disabled={saving}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="task-status">
              Status
            </label>

            <select
              id="task-status"
              name="status"
              value={formData.status}
              onChange={onChange}
              disabled={saving}
            >
              {TASK_STATUS_OPTIONS.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                )
              )}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="task-due-date">
              Due date
            </label>

            <input
              id="task-due-date"
              name="due_date"
              type="date"
              value={formData.due_date}
              onChange={onChange}
              disabled={saving}
            />
          </div>
        </div>

        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={saving}
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

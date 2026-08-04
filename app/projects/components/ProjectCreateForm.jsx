"use client";

import styles from "../projects.module.css";

export default function ProjectCreateForm({
  formData,
  saving,
  statusOptions,
  onChange,
  onSubmit,
  onCancel,
}) {
  return (
    <section
      className={styles.formPanel}
    >
      <div
        className={
          styles.formHeading
        }
      >
        <div>
          <h3>
            Create a new project
          </h3>

          <p>
            Add delivery dates,
            commercial value and a
            starting status.
          </p>
        </div>
      </div>

      <form
        className={
          styles.projectForm
        }
        onSubmit={onSubmit}
      >
        <div
          className={
            styles.formGrid
          }
        >
          <FormField
            label="Project name"
            name="project_name"
            value={
              formData.project_name
            }
            onChange={onChange}
            placeholder="Example: Customer Portal Implementation"
            required
          />

          <FormField
            label="Amount"
            name="amount"
            value={
              formData.amount
            }
            onChange={onChange}
            placeholder="Example: £12,000"
          />

          <FormField
            label="Start date"
            name="start_date"
            type="date"
            value={
              formData.start_date
            }
            onChange={onChange}
          />

          <FormField
            label="Due date"
            name="due_date"
            type="date"
            value={
              formData.due_date
            }
            onChange={onChange}
          />

          <div
            className={
              styles.field
            }
          >
            <label
              htmlFor="project-status"
            >
              Status
            </label>

            <select
              id="project-status"
              name="status"
              value={
                formData.status
              }
              onChange={onChange}
            >
              {statusOptions.map(
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

          <div
            className={`${styles.field} ${styles.fieldFull}`}
          >
            <label
              htmlFor="project-description"
            >
              Description
            </label>

            <textarea
              id="project-description"
              name="description"
              value={
                formData.description
              }
              onChange={onChange}
              rows={5}
              placeholder="Describe the project scope and delivery objective."
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
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="submit"
            className={
              styles.primaryButton
            }
            disabled={saving}
          >
            {saving
              ? "Saving project..."
              : "Save project"}
          </button>
        </div>
      </form>
    </section>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}) {
  return (
    <div
      className={styles.field}
    >
      <label
        htmlFor={`project-${name}`}
      >
        {label}
        {required ? " *" : ""}
      </label>

      <input
        id={`project-${name}`}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

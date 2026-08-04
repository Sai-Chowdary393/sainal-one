"use client";

import styles from "../projects.module.css";

export default function ProjectToolbar({
  searchValue,
  statusFilter,
  statusOptions,
  filtersActive,
  onSearchChange,
  onStatusChange,
  onClearFilters,
}) {
  return (
    <section
      className={
        styles.toolbarPanel
      }
    >
      <label
        className={
          styles.searchBox
        }
      >
        <span aria-hidden="true">
          ⌕
        </span>

        <input
          type="search"
          placeholder="Search project name, description or status..."
          value={searchValue}
          onChange={(event) =>
            onSearchChange(
              event.target.value
            )
          }
          aria-label="Search projects"
        />
      </label>

      <div
        className={
          styles.filters
        }
      >
        <select
          className={
            styles.filterSelect
          }
          value={statusFilter}
          onChange={(event) =>
            onStatusChange(
              event.target.value
            )
          }
          aria-label="Filter projects by status"
        >
          <option value="All">
            All statuses
          </option>

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

        {filtersActive && (
          <button
            type="button"
            className={
              styles.clearButton
            }
            onClick={
              onClearFilters
            }
          >
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}

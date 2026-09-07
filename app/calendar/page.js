"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";
import StatusBadge from "../../components/StatusBadge";

import styles from "./calendar.module.css";

// =========================================================
// CONSTANTS
// =========================================================

const VIEW_OPTIONS = [
  "Month",
  "Week",
  "Day",
];

const CLOSED_STATUSES =
  new Set([
    "completed",
    "cancelled",
    "no answer",
  ]);

const ACTIVITY_TYPES = [
  "Follow-up",
  "Call",
  "Meeting",
  "Demo",
  "Email",
];

const RELATED_TYPES = [
  "General",
  "Lead",
  "Customer",
  "Project",
];

const SCHEDULED_ACTIVITY_TYPES =
  new Set([
    "Call",
    "Meeting",
    "Demo",
  ]);

const EMPTY_ACCESS = {
  isOwner:
    false,

  canCreate:
    false,

  canAssign:
    false,
};

function buildEmptyCreateForm(
  date
) {
  const dateValue =
    formatDateForQuery(
      date
    );

  return {
    activity_type:
      "Follow-up",

    title:
      "",

    note:
      "",

    due_date:
      dateValue,

    scheduled_at:
      "",

    status:
      "Pending",

    related_type:
      "General",

    related_id:
      "",

    assigned_employee_id:
      "",
  };
}

// =========================================================
// PAGE
// =========================================================

export default function CalendarPage() {
  const [
    activities,
    setActivities,
  ] =
    useState([]);

  const [
    employees,
    setEmployees,
  ] =
    useState([]);

  const [
    currentEmployee,
    setCurrentEmployee,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    view,
    setView,
  ] =
    useState("Month");

  const [
    currentDate,
    setCurrentDate,
  ] =
    useState(
      startOfDay(
        new Date()
      )
    );

  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState(
      startOfDay(
        new Date()
      )
    );

  const [
    employeeFilter,
    setEmployeeFilter,
  ] =
    useState("All");

  const [
    activityFilter,
    setActivityFilter,
  ] =
    useState("All");

  const [
    access,
    setAccess,
  ] =
    useState(
      EMPTY_ACCESS
    );

  const [
    leads,
    setLeads,
  ] =
    useState([]);

  const [
    customers,
    setCustomers,
  ] =
    useState([]);

  const [
    projects,
    setProjects,
  ] =
    useState([]);

  const [
    showCreateModal,
    setShowCreateModal,
  ] =
    useState(false);

  const [
    savingActivity,
    setSavingActivity,
  ] =
    useState(false);

  const [
    createForm,
    setCreateForm,
  ] =
    useState(
      buildEmptyCreateForm(
        new Date()
      )
    );

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    loadCalendar();
  }, []);

  async function loadCalendar() {
    try {
      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      const [
        followUpResponse,
        leadsResponse,
        customersResponse,
        projectsResponse,
      ] =
        await Promise.all([
          fetch(
            "/api/follow-ups",
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            "/api/leads",
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            "/api/customers",
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            "/api/projects",
            {
              cache:
                "no-store",
            }
          ),
        ]);

      const [
        followUpData,
        leadsData,
        customersData,
        projectsData,
      ] =
        await Promise.all([
          safeJson(
            followUpResponse
          ),
          safeJson(
            leadsResponse
          ),
          safeJson(
            customersResponse
          ),
          safeJson(
            projectsResponse
          ),
        ]);

      if (
        !followUpResponse.ok
      ) {
        throw new Error(
          followUpData.error ||
            "Unable to load calendar activities."
        );
      }

      setActivities(
        Array.isArray(
          followUpData.followUps
        )
          ? followUpData.followUps
          : []
      );

      setEmployees(
        Array.isArray(
          followUpData.employees
        )
          ? followUpData.employees
          : []
      );

      setCurrentEmployee(
        followUpData.currentEmployee ||
          null
      );

      setAccess({
        isOwner:
          Boolean(
            followUpData.access
              ?.isOwner
          ),

        canCreate:
          Boolean(
            followUpData.access
              ?.canCreate
          ),

        canAssign:
          Boolean(
            followUpData.access
              ?.canAssign
          ),
      });

      setLeads(
        leadsResponse.ok &&
          Array.isArray(
            leadsData.leads
          )
          ? leadsData.leads
          : []
      );

      setCustomers(
        customersResponse.ok &&
          Array.isArray(
            customersData.customers
          )
          ? customersData.customers
          : []
      );

      setProjects(
        projectsResponse.ok &&
          Array.isArray(
            projectsData.projects
          )
          ? projectsData.projects
          : []
      );
    } catch (error) {
      console.error(
        "Calendar loading error:",
        error
      );

      setActivities(
        []
      );

      setEmployees(
        []
      );

      setLeads(
        []
      );

      setCustomers(
        []
      );

      setProjects(
        []
      );

      setErrorMessage(
        error.message ||
          "Unable to load calendar."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  // =======================================================
  // CREATE ACTIVITY
  // =======================================================

  function openCreateActivity(
    date =
      selectedDate
  ) {
    if (
      !access.canCreate
    ) {
      return;
    }

    setSelectedDate(
      startOfDay(
        date
      )
    );

    setCreateForm({
      ...buildEmptyCreateForm(
        date
      ),

      assigned_employee_id:
        access.canAssign
          ? currentEmployee?.id ||
            ""
          : "",
    });

    setShowCreateModal(
      true
    );
  }

  function closeCreateActivity() {
    if (
      savingActivity
    ) {
      return;
    }

    setShowCreateModal(
      false
    );
  }

  function handleCreateChange(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setCreateForm(
      (
        current
      ) => {
        const next = {
          ...current,

          [name]:
            value,
        };

        if (
          name ===
          "activity_type"
        ) {
          const scheduled =
            SCHEDULED_ACTIVITY_TYPES.has(
              value
            );

          next.status =
            scheduled
              ? "Scheduled"
              : "Pending";

          if (
            scheduled
          ) {
            const date =
              current.due_date ||
              String(
                current.scheduled_at ||
                  ""
              ).slice(
                0,
                10
              ) ||
              formatDateForQuery(
                selectedDate
              );

            next.scheduled_at =
              current.scheduled_at ||
              `${date}T09:00`;

            next.due_date =
              "";
          } else {
            const date =
              current.due_date ||
              String(
                current.scheduled_at ||
                  ""
              ).slice(
                0,
                10
              ) ||
              formatDateForQuery(
                selectedDate
              );

            next.due_date =
              date;

            next.scheduled_at =
              "";
          }

          if (
            value ===
              "Call" &&
            current.related_type ===
              "General"
          ) {
            next.related_type =
              "Lead";

            next.related_id =
              "";
          }
        }

        if (
          name ===
          "related_type"
        ) {
          next.related_id =
            "";
        }

        return next;
      }
    );
  }

  async function createActivity(
    event
  ) {
    event.preventDefault();

    if (
      !createForm.title.trim()
    ) {
      alert(
        "Activity title is required."
      );

      return;
    }

    if (
      createForm.related_type !==
        "General" &&
      !createForm.related_id
    ) {
      alert(
        `Please select a ${createForm.related_type.toLowerCase()}.`
      );

      return;
    }

    const scheduled =
      SCHEDULED_ACTIVITY_TYPES.has(
        createForm.activity_type
      );

    if (
      scheduled &&
      !createForm.scheduled_at
    ) {
      alert(
        `${createForm.activity_type} date and time are required.`
      );

      return;
    }

    if (
      !scheduled &&
      !createForm.due_date
    ) {
      alert(
        "Due date is required."
      );

      return;
    }

    try {
      setSavingActivity(
        true
      );

      const payload = {
        activity_type:
          createForm.activity_type,

        title:
          createForm.title.trim(),

        note:
          createForm.note.trim(),

        due_date:
          scheduled
            ? null
            : createForm.due_date,

        scheduled_at:
          scheduled
            ? toIsoDateTime(
                createForm.scheduled_at
              )
            : null,

        status:
          scheduled
            ? "Scheduled"
            : "Pending",

        related_type:
          createForm.related_type,

        related_id:
          createForm.related_id ||
          null,

        outcome:
          null,
      };

      if (
        access.canAssign &&
        createForm.assigned_employee_id
      ) {
        payload.assigned_employee_id =
          createForm.assigned_employee_id;
      }

      const response =
        await fetch(
          "/api/follow-ups",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await safeJson(
          response
        );

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Unable to create activity."
        );
      }

      setShowCreateModal(
        false
      );

      await loadCalendar();
    } catch (error) {
      alert(
        error.message ||
          "Unable to create activity."
      );
    } finally {
      setSavingActivity(
        false
      );
    }
  }

  // =======================================================
  // FILTERED DATA
  // =======================================================

  const calendarActivities =
    useMemo(
      () => {
        return activities.filter(
          (
            activity
          ) => {
            const date =
              getActivityDate(
                activity
              );

            if (
              !date
            ) {
              return false;
            }

            const matchesEmployee =
              employeeFilter ===
                "All" ||
              String(
                activity.assigned_employee_id ||
                  ""
              ) ===
                String(
                  employeeFilter
                );

            const matchesType =
              activityFilter ===
                "All" ||
              normalise(
                activity.activity_type ||
                  "Follow-up"
              ) ===
                normalise(
                  activityFilter
                );

            return (
              matchesEmployee &&
              matchesType
            );
          }
        );
      },
      [
        activities,
        employeeFilter,
        activityFilter,
      ]
    );

  const selectedDayActivities =
    useMemo(
      () =>
        calendarActivities
          .filter(
            (
              activity
            ) =>
              isSameDay(
                getActivityDate(
                  activity
                ),
                selectedDate
              )
          )
          .sort(
            compareActivityDates
          ),
      [
        calendarActivities,
        selectedDate,
      ]
    );

  const todayActivities =
    calendarActivities.filter(
      (
        activity
      ) =>
        isSameDay(
          getActivityDate(
            activity
          ),
          new Date()
        )
    );

  const upcomingActivities =
    calendarActivities
      .filter(
        (
          activity
        ) => {
          const date =
            getActivityDate(
              activity
            );

          return (
            date &&
            date >=
              new Date() &&
            !CLOSED_STATUSES.has(
              normalise(
                activity.status
              )
            )
          );
        }
      )
      .sort(
        compareActivityDates
      );

  const overdueActivities =
    calendarActivities.filter(
      isActivityOverdue
    );

  // =======================================================
  // NAVIGATION
  // =======================================================

  function goPrevious() {
    if (
      view ===
      "Month"
    ) {
      setCurrentDate(
        new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() -
            1,
          1
        )
      );

      return;
    }

    if (
      view ===
      "Week"
    ) {
      setCurrentDate(
        addDays(
          currentDate,
          -7
        )
      );

      return;
    }

    setCurrentDate(
      addDays(
        currentDate,
        -1
      )
    );

    setSelectedDate(
      addDays(
        currentDate,
        -1
      )
    );
  }

  function goNext() {
    if (
      view ===
      "Month"
    ) {
      setCurrentDate(
        new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() +
            1,
          1
        )
      );

      return;
    }

    if (
      view ===
      "Week"
    ) {
      setCurrentDate(
        addDays(
          currentDate,
          7
        )
      );

      return;
    }

    setCurrentDate(
      addDays(
        currentDate,
        1
      )
    );

    setSelectedDate(
      addDays(
        currentDate,
        1
      )
    );
  }

  function goToday() {
    const today =
      startOfDay(
        new Date()
      );

    setCurrentDate(
      today
    );

    setSelectedDate(
      today
    );
  }

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title="Calendar"
        description="View calls, meetings, demos and follow-up activity across your schedule."
      >
        <div
          className={
            styles.page
          }
        >
          {/* =================================================
              HEADER
          ================================================= */}

          <section
            className={
              styles.pageHeader
            }
          >
            <div>
              <span
                className={
                  styles.eyebrow
                }
              >
                Activity workspace
              </span>

              <h2>
                Calendar
              </h2>

              <p>
                Plan customer calls, meetings, demos and reminders in one place.
              </p>
            </div>

            <div
              className={
                styles.headerActions
              }
            >
              <Link
                href="/follow-ups"
                className={
                  styles.secondaryButton
                }
              >
                Open Activity Centre
              </Link>

              {access.canCreate && (
                <button
                  type="button"
                  className={
                    styles.primaryButton
                  }
                  onClick={() =>
                    openCreateActivity(
                      selectedDate
                    )
                  }
                >
                  + Add activity
                </button>
              )}
            </div>
          </section>

          {/* =================================================
              SUMMARY
          ================================================= */}

          <section
            className={
              styles.summaryGrid
            }
          >
            <SummaryCard
              label="Today"
              value={
                todayActivities.length
              }
              icon="◷"
              tone="gold"
            />

            <SummaryCard
              label="Upcoming"
              value={
                upcomingActivities.length
              }
              icon="↗"
              tone="blue"
            />

            <SummaryCard
              label="Overdue"
              value={
                overdueActivities.length
              }
              icon="!"
              tone="red"
            />

            <SummaryCard
              label="Visible activities"
              value={
                calendarActivities.length
              }
              icon="◎"
              tone="green"
            />
          </section>

          {/* =================================================
              TOOLBAR
          ================================================= */}

          <section
            className={
              styles.toolbar
            }
          >
            <div
              className={
                styles.calendarNavigation
              }
            >
              <button
                type="button"
                onClick={
                  goToday
                }
                className={
                  styles.todayButton
                }
              >
                Today
              </button>

              <button
                type="button"
                onClick={
                  goPrevious
                }
                className={
                  styles.navButton
                }
                aria-label="Previous"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={
                  goNext
                }
                className={
                  styles.navButton
                }
                aria-label="Next"
              >
                ›
              </button>

              <strong
                className={
                  styles.periodTitle
                }
              >
                {formatPeriodTitle(
                  currentDate,
                  view
                )}
              </strong>
            </div>

            <div
              className={
                styles.toolbarRight
              }
            >
              <select
                value={
                  employeeFilter
                }
                onChange={(
                  event
                ) =>
                  setEmployeeFilter(
                    event.target.value
                  )
                }
                className={
                  styles.filterSelect
                }
              >
                <option value="All">
                  All assignees
                </option>

                {currentEmployee?.id && (
                  <option
                    value={
                      currentEmployee.id
                    }
                  >
                    My activities
                  </option>
                )}

                {employees
                  .filter(
                    (
                      employee
                    ) =>
                      String(
                        employee.id
                      ) !==
                      String(
                        currentEmployee?.id
                      )
                  )
                  .map(
                    (
                      employee
                    ) => (
                      <option
                        key={
                          employee.id
                        }
                        value={
                          employee.id
                        }
                      >
                        {
                          employee.full_name
                        }
                      </option>
                    )
                  )}
              </select>

              <select
                value={
                  activityFilter
                }
                onChange={(
                  event
                ) =>
                  setActivityFilter(
                    event.target.value
                  )
                }
                className={
                  styles.filterSelect
                }
              >
                <option value="All">
                  All activity types
                </option>

                <option value="Call">
                  Calls
                </option>

                <option value="Meeting">
                  Meetings
                </option>

                <option value="Demo">
                  Demos
                </option>

                <option value="Follow-up">
                  Follow-ups
                </option>

                <option value="Email">
                  Emails
                </option>
              </select>

              <div
                className={
                  styles.viewSwitcher
                }
              >
                {VIEW_OPTIONS.map(
                  (
                    option
                  ) => (
                    <button
                      type="button"
                      key={
                        option
                      }
                      onClick={() => {
                        setView(
                          option
                        );

                        setSelectedDate(
                          currentDate
                        );
                      }}
                      className={
                        view ===
                        option
                          ? styles.viewButtonActive
                          : styles.viewButton
                      }
                    >
                      {option}
                    </button>
                  )
                )}
              </div>
            </div>
          </section>

          {/* =================================================
              CONTENT
          ================================================= */}

          {loading ? (
            <LoadingCalendar />
          ) : errorMessage ? (
            <section
              className={
                styles.errorPanel
              }
            >
              <div>
                <strong>
                  Unable to load calendar
                </strong>

                <p>
                  {
                    errorMessage
                  }
                </p>
              </div>

              <button
                type="button"
                onClick={
                  loadCalendar
                }
                className={
                  styles.secondaryButton
                }
              >
                Try again
              </button>
            </section>
          ) : (
            <section
              className={
                styles.calendarLayout
              }
            >
              <section
                className={
                  styles.calendarPanel
                }
              >
                {view ===
                "Month" ? (
                  <MonthView
                    currentDate={
                      currentDate
                    }
                    selectedDate={
                      selectedDate
                    }
                    activities={
                      calendarActivities
                    }
                    onSelectDate={(
                      date
                    ) =>
                      setSelectedDate(
                        date
                      )
                    }
                  />
                ) : view ===
                  "Week" ? (
                  <WeekView
                    currentDate={
                      currentDate
                    }
                    selectedDate={
                      selectedDate
                    }
                    activities={
                      calendarActivities
                    }
                    onSelectDate={(
                      date
                    ) =>
                      setSelectedDate(
                        date
                      )
                    }
                  />
                ) : (
                  <DayView
                    currentDate={
                      currentDate
                    }
                    activities={
                      calendarActivities
                    }
                  />
                )}
              </section>

              <aside
                className={
                  styles.agendaPanel
                }
              >
                <div
                  className={
                    styles.agendaHeader
                  }
                >
                  <div>
                    <span
                      className={
                        styles.eyebrow
                      }
                    >
                      Daily agenda
                    </span>

                    <h3>
                      {formatSelectedDate(
                        selectedDate
                      )}
                    </h3>
                  </div>

                  <span
                    className={
                      styles.agendaCount
                    }
                  >
                    {
                      selectedDayActivities.length
                    }
                  </span>
                </div>

                {selectedDayActivities.length ===
                0 ? (
                  <div
                    className={
                      styles.emptyAgenda
                    }
                  >
                    <span>
                      ◷
                    </span>

                    <strong>
                      No activity scheduled
                    </strong>

                    <p>
                      There are no visible activities for this date.
                    </p>

                    {access.canCreate && (
                      <button
                        type="button"
                        className={
                          styles.emptyAgendaAction
                        }
                        onClick={() =>
                          openCreateActivity(
                            selectedDate
                          )
                        }
                      >
                        Add activity →
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className={
                      styles.agendaList
                    }
                  >
                    {selectedDayActivities.map(
                      (
                        activity
                      ) => (
                        <AgendaItem
                          key={
                            activity.id
                          }
                          activity={
                            activity
                          }
                        />
                      )
                    )}
                  </div>
                )}

                <section
                  className={
                    styles.upcomingSection
                  }
                >
                  <div
                    className={
                      styles.upcomingHeader
                    }
                  >
                    <strong>
                      Next activities
                    </strong>

                    <Link
                      href="/follow-ups?view=upcoming"
                    >
                      View all
                    </Link>
                  </div>

                  <div
                    className={
                      styles.upcomingList
                    }
                  >
                    {upcomingActivities
                      .slice(
                        0,
                        4
                      )
                      .map(
                        (
                          activity
                        ) => (
                          <UpcomingItem
                            key={`upcoming-${activity.id}`}
                            activity={
                              activity
                            }
                          />
                        )
                      )}

                    {upcomingActivities.length ===
                      0 && (
                      <p
                        className={
                          styles.noUpcoming
                        }
                      >
                        Nothing upcoming.
                      </p>
                    )}
                  </div>
                </section>
              </aside>
            </section>
          )}

          {showCreateModal &&
            access.canCreate && (
              <CreateActivityModal
                form={
                  createForm
                }
                selectedDate={
                  selectedDate
                }
                employees={
                  employees
                }
                leads={
                  leads
                }
                customers={
                  customers
                }
                projects={
                  projects
                }
                canAssign={
                  access.canAssign
                }
                saving={
                  savingActivity
                }
                onChange={
                  handleCreateChange
                }
                onClose={
                  closeCreateActivity
                }
                onSubmit={
                  createActivity
                }
              />
            )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// CREATE ACTIVITY MODAL
// =========================================================

function CreateActivityModal({
  form,
  selectedDate,
  employees,
  leads,
  customers,
  projects,
  canAssign,
  saving,
  onChange,
  onClose,
  onSubmit,
}) {
  const scheduled =
    SCHEDULED_ACTIVITY_TYPES.has(
      form.activity_type
    );

  const relatedRecords =
    getRelatedRecords({
      relatedType:
        form.related_type,

      leads,

      customers,

      projects,
    });

  return (
    <div
      className={
        styles.modalOverlay
      }
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className={
          styles.modalPanel
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-create-title"
      >
        <div
          className={
            styles.modalHeader
          }
        >
          <div>
            <span
              className={
                styles.eyebrow
              }
            >
              New activity
            </span>

            <h3
              id="calendar-create-title"
            >
              Add to{" "}
              {formatSelectedDate(
                selectedDate
              )}
            </h3>

            <p>
              Create a call, meeting, demo or follow-up without leaving Calendar.
            </p>
          </div>

          <button
            type="button"
            className={
              styles.modalClose
            }
            onClick={
              onClose
            }
            disabled={
              saving
            }
            aria-label="Close activity form"
          >
            ×
          </button>
        </div>

        <form
          className={
            styles.modalForm
          }
          onSubmit={
            onSubmit
          }
        >
          <div
            className={
              styles.modalGrid
            }
          >
            <label
              className={
                styles.modalField
              }
            >
              <span>
                Activity type
              </span>

              <select
                name="activity_type"
                value={
                  form.activity_type
                }
                onChange={
                  onChange
                }
                disabled={
                  saving
                }
              >
                {ACTIVITY_TYPES.map(
                  (
                    type
                  ) => (
                    <option
                      key={
                        type
                      }
                      value={
                        type
                      }
                    >
                      {type}
                    </option>
                  )
                )}
              </select>
            </label>

            <label
              className={
                styles.modalField
              }
            >
              <span>
                Title
              </span>

              <input
                name="title"
                value={
                  form.title
                }
                onChange={
                  onChange
                }
                disabled={
                  saving
                }
                placeholder={
                  activityTitlePlaceholder(
                    form.activity_type
                  )
                }
              />
            </label>

            <label
              className={
                styles.modalField
              }
            >
              <span>
                Related to
              </span>

              <select
                name="related_type"
                value={
                  form.related_type
                }
                onChange={
                  onChange
                }
                disabled={
                  saving
                }
              >
                {RELATED_TYPES.map(
                  (
                    type
                  ) => (
                    <option
                      key={
                        type
                      }
                      value={
                        type
                      }
                    >
                      {type}
                    </option>
                  )
                )}
              </select>
            </label>

            {form.related_type ===
            "General" ? (
              <div
                className={
                  styles.modalContext
                }
              >
                <strong>
                  General activity
                </strong>

                <span>
                  This activity will not be linked to a CRM record.
                </span>
              </div>
            ) : (
              <label
                className={
                  styles.modalField
                }
              >
                <span>
                  {
                    form.related_type
                  }
                </span>

                <select
                  name="related_id"
                  value={
                    form.related_id
                  }
                  onChange={
                    onChange
                  }
                  disabled={
                    saving
                  }
                >
                  <option value="">
                    Select{" "}
                    {form.related_type.toLowerCase()}
                  </option>

                  {relatedRecords.map(
                    (
                      record
                    ) => (
                      <option
                        key={
                          record.id
                        }
                        value={
                          record.id
                        }
                      >
                        {
                          record.label
                        }
                      </option>
                    )
                  )}
                </select>
              </label>
            )}

            {scheduled ? (
              <label
                className={
                  styles.modalField
                }
              >
                <span>
                  Scheduled date & time
                </span>

                <input
                  type="datetime-local"
                  name="scheduled_at"
                  value={
                    form.scheduled_at
                  }
                  onChange={
                    onChange
                  }
                  disabled={
                    saving
                  }
                />
              </label>
            ) : (
              <label
                className={
                  styles.modalField
                }
              >
                <span>
                  Due date
                </span>

                <input
                  type="date"
                  name="due_date"
                  value={
                    form.due_date
                  }
                  onChange={
                    onChange
                  }
                  disabled={
                    saving
                  }
                />
              </label>
            )}

            {canAssign && (
              <label
                className={
                  styles.modalField
                }
              >
                <span>
                  Assigned employee
                </span>

                <select
                  name="assigned_employee_id"
                  value={
                    form.assigned_employee_id
                  }
                  onChange={
                    onChange
                  }
                  disabled={
                    saving
                  }
                >
                  <option value="">
                    Unassigned
                  </option>

                  {employees.map(
                    (
                      employee
                    ) => (
                      <option
                        key={
                          employee.id
                        }
                        value={
                          employee.id
                        }
                      >
                        {
                          employee.full_name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>
            )}

            <label
              className={`${styles.modalField} ${styles.modalFieldFull}`}
            >
              <span>
                Notes
              </span>

              <textarea
                name="note"
                rows={4}
                value={
                  form.note
                }
                onChange={
                  onChange
                }
                disabled={
                  saving
                }
                placeholder="Add context, agenda or next steps..."
              />
            </label>
          </div>

          <div
            className={
              styles.modalActions
            }
          >
            <button
              type="button"
              className={
                styles.secondaryButton
              }
              onClick={
                onClose
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
                ? "Saving..."
                : scheduled
                  ? `Schedule ${form.activity_type.toLowerCase()}`
                  : "Save activity"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// =========================================================
// MONTH VIEW
// =========================================================

function MonthView({
  currentDate,
  selectedDate,
  activities,
  onSelectDate,
}) {
  const days =
    buildMonthGrid(
      currentDate
    );

  return (
    <div
      className={
        styles.monthCalendar
      }
    >
      <div
        className={
          styles.weekdayHeader
        }
      >
        {[
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
          "Sun",
        ].map(
          (
            day
          ) => (
            <div
              key={
                day
              }
            >
              {day}
            </div>
          )
        )}
      </div>

      <div
        className={
          styles.monthGrid
        }
      >
        {days.map(
          (
            date
          ) => {
            const dayActivities =
              activities
                .filter(
                  (
                    activity
                  ) =>
                    isSameDay(
                      getActivityDate(
                        activity
                      ),
                      date
                    )
                )
                .sort(
                  compareActivityDates
                );

            const outsideMonth =
              date.getMonth() !==
              currentDate.getMonth();

            const selected =
              isSameDay(
                date,
                selectedDate
              );

            const today =
              isSameDay(
                date,
                new Date()
              );

            return (
              <button
                type="button"
                key={
                  date.toISOString()
                }
                onClick={() =>
                  onSelectDate(
                    date
                  )
                }
                className={`${styles.dayCell} ${
                  outsideMonth
                    ? styles.dayCellOutside
                    : ""
                } ${
                  selected
                    ? styles.dayCellSelected
                    : ""
                }`}
              >
                <div
                  className={
                    styles.dayCellHeader
                  }
                >
                  <span
                    className={
                      today
                        ? styles.todayNumber
                        : styles.dayNumber
                    }
                  >
                    {date.getDate()}
                  </span>

                  {dayActivities.length >
                    0 && (
                    <small>
                      {
                        dayActivities.length
                      }
                    </small>
                  )}
                </div>

                <div
                  className={
                    styles.dayEvents
                  }
                >
                  {dayActivities
                    .slice(
                      0,
                      3
                    )
                    .map(
                      (
                        activity
                      ) => (
                        <CalendarEvent
                          key={
                            activity.id
                          }
                          activity={
                            activity
                          }
                        />
                      )
                    )}

                  {dayActivities.length >
                    3 && (
                    <span
                      className={
                        styles.moreEvents
                      }
                    >
                      +
                      {dayActivities.length -
                        3}{" "}
                      more
                    </span>
                  )}
                </div>
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}

// =========================================================
// WEEK VIEW
// =========================================================

function WeekView({
  currentDate,
  selectedDate,
  activities,
  onSelectDate,
}) {
  const start =
    startOfWeek(
      currentDate
    );

  const days =
    Array.from({
      length:
        7,
    }).map(
      (
        _,
        index
      ) =>
        addDays(
          start,
          index
        )
    );

  return (
    <div
      className={
        styles.weekView
      }
    >
      {days.map(
        (
          date
        ) => {
          const dayActivities =
            activities
              .filter(
                (
                  activity
                ) =>
                  isSameDay(
                    getActivityDate(
                      activity
                    ),
                    date
                  )
              )
              .sort(
                compareActivityDates
              );

          const selected =
            isSameDay(
              date,
              selectedDate
            );

          return (
            <section
              key={
                date.toISOString()
              }
              className={`${styles.weekColumn} ${
                selected
                  ? styles.weekColumnSelected
                  : ""
              }`}
            >
              <button
                type="button"
                className={
                  styles.weekDayHeader
                }
                onClick={() =>
                  onSelectDate(
                    date
                  )
                }
              >
                <span>
                  {date.toLocaleDateString(
                    "en-GB",
                    {
                      weekday:
                        "short",
                    }
                  )}
                </span>

                <strong>
                  {date.getDate()}
                </strong>
              </button>

              <div
                className={
                  styles.weekEvents
                }
              >
                {dayActivities.map(
                  (
                    activity
                  ) => (
                    <WeekEvent
                      key={
                        activity.id
                      }
                      activity={
                        activity
                      }
                    />
                  )
                )}

                {dayActivities.length ===
                  0 && (
                  <span
                    className={
                      styles.noWeekEvents
                    }
                  >
                    No activity
                  </span>
                )}
              </div>
            </section>
          );
        }
      )}
    </div>
  );
}

// =========================================================
// DAY VIEW
// =========================================================

function DayView({
  currentDate,
  activities,
}) {
  const dayActivities =
    activities
      .filter(
        (
          activity
        ) =>
          isSameDay(
            getActivityDate(
              activity
            ),
            currentDate
          )
      )
      .sort(
        compareActivityDates
      );

  const hours =
    Array.from({
      length:
        12,
    }).map(
      (
        _,
        index
      ) =>
        index +
        8
    );

  return (
    <div
      className={
        styles.dayView
      }
    >
      {hours.map(
        (
          hour
        ) => {
          const hourActivities =
            dayActivities.filter(
              (
                activity
              ) => {
                const date =
                  getActivityDate(
                    activity
                  );

                return (
                  date &&
                  date.getHours() ===
                    hour
                );
              }
            );

          return (
            <div
              key={
                hour
              }
              className={
                styles.hourRow
              }
            >
              <span
                className={
                  styles.hourLabel
                }
              >
                {String(
                  hour
                ).padStart(
                  2,
                  "0"
                )}
                :00
              </span>

              <div
                className={
                  styles.hourContent
                }
              >
                {hourActivities.map(
                  (
                    activity
                  ) => (
                    <WeekEvent
                      key={
                        activity.id
                      }
                      activity={
                        activity
                      }
                    />
                  )
                )}
              </div>
            </div>
          );
        }
      )}

      {dayActivities.filter(
        (
          activity
        ) =>
          !activity.scheduled_at
      ).length >
        0 && (
        <section
          className={
            styles.allDaySection
          }
        >
          <strong>
            Due today
          </strong>

          {dayActivities
            .filter(
              (
                activity
              ) =>
                !activity.scheduled_at
            )
            .map(
              (
                activity
              ) => (
                <WeekEvent
                  key={
                    activity.id
                  }
                  activity={
                    activity
                  }
                />
              )
            )}
        </section>
      )}
    </div>
  );
}

// =========================================================
// EVENT
// =========================================================

function CalendarEvent({
  activity,
}) {
  const type =
    activity.activity_type ||
    "Follow-up";

  return (
    <span
      className={`${styles.calendarEvent} ${getEventToneClass(
        type
      )}`}
      title={
        activity.title
      }
    >
      <span>
        {activityIcon(
          type
        )}
      </span>

      {activity.scheduled_at && (
        <small>
          {formatTime(
            activity.scheduled_at
          )}
        </small>
      )}

      <strong>
        {activity.title ||
          "Activity"}
      </strong>
    </span>
  );
}

function WeekEvent({
  activity,
}) {
  const href =
    getActivityHref(
      activity
    );

  return (
    <Link
      href={
        href
      }
      className={`${styles.weekEvent} ${getEventToneClass(
        activity.activity_type
      )}`}
    >
      <span
        className={
          styles.weekEventIcon
        }
      >
        {activityIcon(
          activity.activity_type
        )}
      </span>

      <div>
        <strong>
          {activity.title ||
            "Activity"}
        </strong>

        <small>
          {activity.scheduled_at
            ? formatTime(
                activity.scheduled_at
              )
            : "Due"}

          {activity.assigned_employee
            ?.full_name
            ? ` · ${activity.assigned_employee.full_name}`
            : ""}
        </small>
      </div>
    </Link>
  );
}

// =========================================================
// AGENDA
// =========================================================

function AgendaItem({
  activity,
}) {
  const type =
    activity.activity_type ||
    "Follow-up";

  const href =
    getActivityHref(
      activity
    );

  return (
    <Link
      href={
        href
      }
      className={
        styles.agendaItem
      }
    >
      <span
        className={`${styles.agendaIcon} ${getEventToneClass(
          type
        )}`}
      >
        {activityIcon(
          type
        )}
      </span>

      <div
        className={
          styles.agendaCopy
        }
      >
        <div
          className={
            styles.agendaTitle
          }
        >
          <strong>
            {activity.title ||
              "Activity"}
          </strong>

          <StatusBadge
            status={
              activity.status ||
              "Pending"
            }
          />
        </div>

        <p>
          {activity.scheduled_at
            ? formatTime(
                activity.scheduled_at
              )
            : "Due today"}

          {activity.assigned_employee
            ?.full_name
            ? ` · ${activity.assigned_employee.full_name}`
            : ""}
        </p>

        {activity.related_type && (
          <small>
            Related to{" "}
            {activity.related_type}
          </small>
        )}
      </div>
    </Link>
  );
}

function UpcomingItem({
  activity,
}) {
  return (
    <Link
      href={
        getActivityHref(
          activity
        )
      }
      className={
        styles.upcomingItem
      }
    >
      <span>
        {activityIcon(
          activity.activity_type
        )}
      </span>

      <div>
        <strong>
          {activity.title ||
            "Activity"}
        </strong>

        <small>
          {formatShortDateTime(
            getActivityDate(
              activity
            )
          )}
        </small>
      </div>
    </Link>
  );
}

// =========================================================
// SUMMARY
// =========================================================

function SummaryCard({
  label,
  value,
  icon,
  tone,
}) {
  const toneClass =
    tone ===
    "blue"
      ? styles.summaryBlue
      : tone ===
          "red"
        ? styles.summaryRed
        : tone ===
            "green"
          ? styles.summaryGreen
          : styles.summaryGold;

  return (
    <article
      className={`${styles.summaryCard} ${toneClass}`}
    >
      <span
        className={
          styles.summaryIcon
        }
      >
        {icon}
      </span>

      <div>
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>
      </div>
    </article>
  );
}

// =========================================================
// LOADING
// =========================================================

function LoadingCalendar() {
  return (
    <div
      className={
        styles.loadingLayout
      }
    >
      <div
        className={
          styles.loadingCalendar
        }
      />

      <div
        className={
          styles.loadingAgenda
        }
      />
    </div>
  );
}

// =========================================================
// HELPERS
// =========================================================

async function safeJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function normalise(
  value
) {
  return String(
    value ||
      ""
  )
    .trim()
    .toLowerCase();
}

function getActivityDate(
  activity
) {
  const value =
    activity?.scheduled_at ||
    activity?.due_date;

  if (
    !value
  ) {
    return null;
  }

  const date =
    new Date(
      String(
        value
      ).includes(
        "T"
      )
        ? value
        : `${value}T12:00:00`
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function isActivityOverdue(
  activity
) {
  if (
    CLOSED_STATUSES.has(
      normalise(
        activity?.status
      )
    )
  ) {
    return false;
  }

  const date =
    getActivityDate(
      activity
    );

  return (
    date &&
    date <
      new Date()
  );
}

function compareActivityDates(
  first,
  second
) {
  return (
    getActivityDate(
      first
    )?.getTime() -
    getActivityDate(
      second
    )?.getTime()
  );
}

function startOfDay(
  date
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function startOfWeek(
  date
) {
  const current =
    startOfDay(
      date
    );

  const day =
    current.getDay();

  const offset =
    day ===
    0
      ? -6
      : 1 -
        day;

  return addDays(
    current,
    offset
  );
}

function addDays(
  date,
  amount
) {
  const result =
    new Date(
      date
    );

  result.setDate(
    result.getDate() +
      amount
  );

  return result;
}

function isSameDay(
  first,
  second
) {
  if (
    !first ||
    !second
  ) {
    return false;
  }

  return (
    first.getFullYear() ===
      second.getFullYear() &&
    first.getMonth() ===
      second.getMonth() &&
    first.getDate() ===
      second.getDate()
  );
}

function buildMonthGrid(
  currentDate
) {
  const firstDay =
    new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );

  const gridStart =
    startOfWeek(
      firstDay
    );

  return Array.from({
    length:
      42,
  }).map(
    (
      _,
      index
    ) =>
      addDays(
        gridStart,
        index
      )
  );
}

function formatDateForQuery(
  date
) {
  const pad = (
    value
  ) =>
    String(
      value
    ).padStart(
      2,
      "0"
    );

  return `${date.getFullYear()}-${pad(
    date.getMonth() +
      1
  )}-${pad(
    date.getDate()
  )}`;
}

function toIsoDateTime(
  value
) {
  if (
    !value
  ) {
    return null;
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date.toISOString();
}

function getRelatedRecords({
  relatedType,
  leads,
  customers,
  projects,
}) {
  if (
    relatedType ===
    "Lead"
  ) {
    return leads.map(
      (
        lead
      ) => ({
        id:
          lead.id,

        label:
          [
            lead.name ||
              "Unnamed lead",

            lead.company,
          ]
            .filter(
              Boolean
            )
            .join(
              " — "
            ),
      })
    );
  }

  if (
    relatedType ===
    "Customer"
  ) {
    return customers.map(
      (
        customer
      ) => ({
        id:
          customer.id,

        label:
          customer.customer_name ||
          customer.name ||
          customer.company ||
          "Unnamed customer",
      })
    );
  }

  if (
    relatedType ===
    "Project"
  ) {
    return projects.map(
      (
        project
      ) => ({
        id:
          project.id,

        label:
          project.project_name ||
          project.name ||
          project.title ||
          "Unnamed project",
      })
    );
  }

  return [];
}

function activityTitlePlaceholder(
  type
) {
  switch (
    normalise(
      type
    )
  ) {
    case "call":
      return "e.g. Discovery call";

    case "meeting":
      return "e.g. Customer review meeting";

    case "demo":
      return "e.g. Product demo";

    case "email":
      return "e.g. Send proposal follow-up";

    default:
      return "e.g. Follow up on proposal";
  }
}

function formatPeriodTitle(
  date,
  view
) {
  if (
    view ===
    "Month"
  ) {
    return date.toLocaleDateString(
      "en-GB",
      {
        month:
          "long",
        year:
          "numeric",
      }
    );
  }

  if (
    view ===
    "Week"
  ) {
    const start =
      startOfWeek(
        date
      );

    const end =
      addDays(
        start,
        6
      );

    return `${start.toLocaleDateString(
      "en-GB",
      {
        day:
          "2-digit",
        month:
          "short",
      }
    )} – ${end.toLocaleDateString(
      "en-GB",
      {
        day:
          "2-digit",
        month:
          "short",
        year:
          "numeric",
      }
    )}`;
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      weekday:
        "long",
      day:
        "2-digit",
      month:
        "long",
      year:
        "numeric",
    }
  );
}

function formatSelectedDate(
  date
) {
  return date.toLocaleDateString(
    "en-GB",
    {
      weekday:
        "long",
      day:
        "2-digit",
      month:
        "long",
    }
  );
}

function formatTime(
  value
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    "en-GB",
    {
      hour:
        "2-digit",
      minute:
        "2-digit",
    }
  );
}

function formatShortDateTime(
  date
) {
  if (
    !date
  ) {
    return "Not scheduled";
  }

  return date.toLocaleString(
    "en-GB",
    {
      day:
        "2-digit",
      month:
        "short",
      hour:
        "2-digit",
      minute:
        "2-digit",
    }
  );
}

function activityIcon(
  type
) {
  switch (
    normalise(
      type
    )
  ) {
    case "call":
      return "☎";

    case "meeting":
      return "◫";

    case "demo":
      return "▶";

    case "email":
      return "✉";

    default:
      return "✓";
  }
}

function getEventToneClass(
  type
) {
  switch (
    normalise(
      type
    )
  ) {
    case "call":
      return styles.eventCall;

    case "meeting":
      return styles.eventMeeting;

    case "demo":
      return styles.eventDemo;

    case "email":
      return styles.eventEmail;

    default:
      return styles.eventFollowUp;
  }
}

function getActivityHref(
  activity
) {
  if (
    normalise(
      activity?.related_type
    ) ===
      "lead" &&
    activity?.related_id
  ) {
    return `/leads/${activity.related_id}`;
  }

  if (
    normalise(
      activity?.related_type
    ) ===
      "project" &&
    activity?.related_id
  ) {
    return `/projects/${activity.related_id}`;
  }

  return "/follow-ups";
}

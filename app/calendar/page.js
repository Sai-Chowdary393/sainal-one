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

      const response =
        await fetch(
          "/api/follow-ups",
          {
            cache:
              "no-store",
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
            "Unable to load calendar activities."
        );
      }

      setActivities(
        Array.isArray(
          data.followUps
        )
          ? data.followUps
          : []
      );

      setEmployees(
        Array.isArray(
          data.employees
        )
          ? data.employees
          : []
      );

      setCurrentEmployee(
        data.currentEmployee ||
          null
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

              <Link
                href="/follow-ups"
                className={
                  styles.primaryButton
                }
              >
                + Add activity
              </Link>
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

                    <Link
                      href="/follow-ups"
                    >
                      Add activity →
                    </Link>
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
        </div>
      </AppLayout>
    </ProtectedRoute>
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

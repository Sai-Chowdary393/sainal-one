"use client";

import {
  useEffect,
  useState,
} from "react";

function getEventIcon(eventType) {
  const type = String(
    eventType || ""
  ).toLowerCase();

  if (
    type.includes("customer")
  ) {
    return "👤";
  }

  if (
    type.includes("quote")
  ) {
    return "📄";
  }

  if (
    type.includes("proposal")
  ) {
    return "📨";
  }

  if (
    type.includes("project")
  ) {
    return "📁";
  }

  if (
    type.includes("task")
  ) {
    return "✅";
  }

  if (
    type.includes("invoice")
  ) {
    return "🧾";
  }

  if (
    type.includes("payment") ||
    type.includes("paid")
  ) {
    return "💷";
  }

  if (
    type.includes("email")
  ) {
    return "📧";
  }

  if (
    type.includes("note")
  ) {
    return "📝";
  }

  return "●";
}

function formatTimelineDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(
    value
  ).toLocaleString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

export default function CustomerTimeline({
  customerId,
  refreshKey = 0,
}) {
  const [events, setEvents] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!customerId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    fetchTimeline();
  }, [customerId, refreshKey]);

  async function fetchTimeline() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/timeline/${customerId}`,
        {
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Failed to load timeline."
        );

        setEvents([]);
        return;
      }

      setEvents(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (requestError) {
      console.error(
        requestError
      );

      setError(
        "Error loading customer timeline."
      );

      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <h3>
          Customer Timeline
        </h3>

        <p>
          Loading timeline...
        </p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div>
          <h3
            style={{
              marginBottom: "4px",
            }}
          >
            Customer Timeline
          </h3>

          <p
            className="helperText"
            style={{
              margin: 0,
            }}
          >
            Complete customer activity
            history.
          </p>
        </div>

        <button
          type="button"
          className="primaryBtn"
          onClick={fetchTimeline}
        >
          Refresh
        </button>
      </div>

      {error && (
        <p
          style={{
            marginBottom: "16px",
          }}
        >
          {error}
        </p>
      )}

      {!error &&
        events.length === 0 && (
          <p className="helperText">
            No timeline activity
            recorded yet.
          </p>
        )}

      {events.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0",
          }}
        >
          {events.map(
            (event, index) => (
              <div
                key={event.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "42px 1fr",
                  gap: "14px",
                  position:
                    "relative",
                  paddingBottom:
                    index ===
                    events.length - 1
                      ? "0"
                      : "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection:
                      "column",
                    alignItems:
                      "center",
                  }}
                >
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius:
                        "50%",
                      display: "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      border:
                        "1px solid #d9dde5",
                      background:
                        "#ffffff",
                      zIndex: 1,
                      fontSize:
                        "17px",
                    }}
                  >
                    {getEventIcon(
                      event.event_type
                    )}
                  </div>

                  {index !==
                    events.length -
                      1 && (
                    <div
                      style={{
                        width: "2px",
                        flex: 1,
                        minHeight:
                          "38px",
                        background:
                          "#e5e7eb",
                      }}
                    />
                  )}
                </div>

                <div
                  style={{
                    paddingTop: "2px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems:
                        "flex-start",
                      justifyContent:
                        "space-between",
                      gap: "16px",
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <strong>
                        {event.title}
                      </strong>

                      <p
                        className="helperText"
                        style={{
                          margin:
                            "4px 0 0",
                        }}
                      >
                        {formatTimelineDate(
                          event.created_at
                        )}
                      </p>
                    </div>

                    <span
                      style={{
                        fontSize:
                          "12px",
                        padding:
                          "5px 9px",
                        borderRadius:
                          "999px",
                        background:
                          "#f3f4f6",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {event.event_type ||
                        "Activity"}
                    </span>
                  </div>

                  {event.description && (
                    <p
                      style={{
                        margin:
                          "10px 0 0",
                        lineHeight:
                          "1.6",
                      }}
                    >
                      {
                        event.description
                      }
                    </p>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

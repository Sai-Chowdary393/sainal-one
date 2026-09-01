"use client";

import {
  useEffect,
  useState,
} from "react";

// =========================================================
// SEND RECORD EMAIL
// =========================================================

export default function SendRecordEmail({
  endpoint,
  defaultEmail = "",
  defaultSubject = "",
  recordLabel = "document",
  onSent,
}) {
  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    recipient,
    setRecipient,
  ] = useState(
    defaultEmail
  );

  const [
    subject,
    setSubject,
  ] = useState(
    defaultSubject
  );

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    sending,
    setSending,
  ] = useState(false);

  // =======================================================
  // SYNCHRONISE VALUES
  // =======================================================

  useEffect(() => {
    setRecipient(
      defaultEmail ||
        ""
    );
  }, [
    defaultEmail,
  ]);

  useEffect(() => {
    setSubject(
      defaultSubject ||
        ""
    );
  }, [
    defaultSubject,
  ]);

  // =======================================================
  // BODY SCROLL
  // =======================================================

  useEffect(() => {
    if (
      !showForm
    ) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    showForm,
  ]);

  // =======================================================
  // OPEN / CLOSE
  // =======================================================

  function openForm() {
    if (
      sending
    ) {
      return;
    }

    setShowForm(
      true
    );
  }

  function closeForm() {
    if (
      sending
    ) {
      return;
    }

    setShowForm(
      false
    );
  }

  // =======================================================
  // SEND
  // =======================================================

  async function sendEmail(
    event
  ) {
    event.preventDefault();

    const cleanRecipient =
      recipient.trim();

    const cleanSubject =
      subject.trim();

    const cleanMessage =
      message.trim();

    if (
      !endpoint
    ) {
      alert(
        "The email endpoint is not configured."
      );

      return;
    }

    if (
      !cleanRecipient
    ) {
      alert(
        "Please enter the recipient email address."
      );

      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanRecipient
      )
    ) {
      alert(
        "Please enter a valid recipient email address."
      );

      return;
    }

    if (
      !cleanSubject
    ) {
      alert(
        "Please enter an email subject."
      );

      return;
    }

    setSending(
      true
    );

    try {
      const response =
        await fetch(
          endpoint,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                to:
                  cleanRecipient,

                subject:
                  cleanSubject,

                message:
                  cleanMessage,
              }),
          }
        );

      const data =
        await readJsonResponse(
          response
        );

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            `Failed to send ${recordLabel}.`
        );
      }

      const recipientAddress =
        data.recipient ||
        cleanRecipient;

      alert(
        `${capitalise(
          recordLabel
        )} sent successfully to ${recipientAddress}.`
      );

      setMessage("");

      setShowForm(
        false
      );

      if (
        typeof onSent ===
        "function"
      ) {
        onSent(
          data
        );
      }
    } catch (error) {
      console.error(
        `${recordLabel} email error:`,
        error
      );

      alert(
        error.message ||
          `Error sending ${recordLabel}.`
      );
    } finally {
      setSending(
        false
      );
    }
  }

  // =======================================================
  // UI
  // =======================================================

  return (
    <>
      {/* OPEN BUTTON */}

      <button
        type="button"
        className="primaryBtn"
        onClick={
          openForm
        }
        disabled={
          sending
        }
      >
        Send{" "}
        {recordLabel}
      </button>

      {/* DRAWER */}

      {showForm && (
        <div
          style={
            styles.overlay
          }
        >
          {/* BACKDROP */}

          <button
            type="button"
            aria-label="Close email form"
            onClick={
              closeForm
            }
            disabled={
              sending
            }
            style={
              styles.backdrop
            }
          />

          {/* PANEL */}

          <aside
            style={
              styles.drawer
            }
          >
            <form
              onSubmit={
                sendEmail
              }
              style={
                styles.form
              }
            >
              {/* HEADER */}

              <div
                style={
                  styles.header
                }
              >
                <div
                  style={
                    styles.headerCopy
                  }
                >
                  <span
                    style={
                      styles.eyebrow
                    }
                  >
                    Customer communication
                  </span>

                  <h2
                    style={
                      styles.title
                    }
                  >
                    Send{" "}
                    {
                      recordLabel
                    }
                  </h2>

                  <p
                    style={
                      styles.description
                    }
                  >
                    Review the
                    recipient,
                    subject and
                    message before
                    sending.
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Close"
                  onClick={
                    closeForm
                  }
                  disabled={
                    sending
                  }
                  style={
                    styles.closeButton
                  }
                >
                  ×
                </button>
              </div>

              {/* CONTENT */}

              <div
                style={
                  styles.content
                }
              >
                {/* RECIPIENT */}

                <div
                  style={
                    styles.field
                  }
                >
                  <label
                    htmlFor="record-email-recipient"
                    style={
                      styles.label
                    }
                  >
                    Recipient
                    email
                  </label>

                  <input
                    id="record-email-recipient"
                    type="email"
                    value={
                      recipient
                    }
                    onChange={(
                      event
                    ) =>
                      setRecipient(
                        event.target
                          .value
                      )
                    }
                    placeholder="client@example.com"
                    required
                    disabled={
                      sending
                    }
                    style={
                      styles.input
                    }
                  />

                  <p
                    style={
                      styles.helper
                    }
                  >
                    This is
                    automatically
                    populated from
                    the linked
                    customer when
                    available.
                  </p>
                </div>

                {/* SUBJECT */}

                <div
                  style={
                    styles.field
                  }
                >
                  <label
                    htmlFor="record-email-subject"
                    style={
                      styles.label
                    }
                  >
                    Subject
                  </label>

                  <input
                    id="record-email-subject"
                    value={
                      subject
                    }
                    onChange={(
                      event
                    ) =>
                      setSubject(
                        event.target
                          .value
                      )
                    }
                    placeholder="Email subject"
                    required
                    disabled={
                      sending
                    }
                    style={
                      styles.input
                    }
                  />
                </div>

                {/* MESSAGE */}

                <div
                  style={
                    styles.field
                  }
                >
                  <div
                    style={
                      styles.messageHeader
                    }
                  >
                    <label
                      htmlFor="record-email-message"
                      style={
                        styles.label
                      }
                    >
                      Message
                    </label>

                    <span
                      style={
                        styles.optional
                      }
                    >
                      Optional
                    </span>
                  </div>

                  <textarea
                    id="record-email-message"
                    rows={8}
                    value={
                      message
                    }
                    onChange={(
                      event
                    ) =>
                      setMessage(
                        event.target
                          .value
                      )
                    }
                    placeholder={`Add a short message for the customer about this ${recordLabel}...`}
                    disabled={
                      sending
                    }
                    style={
                      styles.textarea
                    }
                  />
                </div>

                {/* SUMMARY */}

                <div
                  style={
                    styles.summary
                  }
                >
                  <span
                    style={
                      styles.summaryIcon
                    }
                  >
                    ✉
                  </span>

                  <div>
                    <strong
                      style={
                        styles.summaryTitle
                      }
                    >
                      Ready to
                      send
                    </strong>

                    <p
                      style={
                        styles.summaryText
                      }
                    >
                      The{" "}
                      {
                        recordLabel
                      }{" "}
                      will only be
                      marked as sent
                      after the email
                      service confirms
                      successful
                      delivery.
                    </p>
                  </div>
                </div>
              </div>

              {/* FOOTER */}

              <div
                style={
                  styles.footer
                }
              >
                <button
                  type="button"
                  className="secondaryBtn"
                  onClick={
                    closeForm
                  }
                  disabled={
                    sending
                  }
                  style={
                    styles.footerButton
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primaryBtn"
                  disabled={
                    sending
                  }
                  style={
                    styles.sendButton
                  }
                >
                  {sending
                    ? "Sending..."
                    : `Send ${recordLabel}`}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}

// =========================================================
// HELPERS
// =========================================================

function capitalise(
  value
) {
  const text =
    String(
      value ||
        "document"
    );

  return `${text
    .charAt(0)
    .toUpperCase()}${text.slice(
    1
  )}`;
}

async function readJsonResponse(
  response
) {
  const responseText =
    await response.text();

  if (
    !responseText
  ) {
    return {};
  }

  try {
    return JSON.parse(
      responseText
    );
  } catch {
    return {
      error:
        "The server returned an invalid response.",
    };
  }
}

// =========================================================
// STYLES
// =========================================================

const styles = {
  overlay: {
    position:
      "fixed",

    inset:
      0,

    zIndex:
      9999,

    display:
      "flex",

    justifyContent:
      "flex-end",
  },

  backdrop: {
    position:
      "absolute",

    inset:
      0,

    width:
      "100%",

    height:
      "100%",

    padding:
      0,

    border:
      0,

    background:
      "rgba(28, 26, 20, 0.28)",

    backdropFilter:
      "blur(2px)",

    cursor:
      "default",
  },

  drawer: {
    position:
      "relative",

    zIndex:
      2,

    width:
      "min(480px, 100vw)",

    height:
      "100vh",

    overflow:
      "hidden",

    borderLeft:
      "1px solid #ddd8cb",

    background:
      "#ffffff",

    boxShadow:
      "-20px 0 55px rgba(32, 28, 18, 0.15)",
  },

  form: {
    height:
      "100%",

    display:
      "grid",

    gridTemplateRows:
      "auto minmax(0, 1fr) auto",
  },

  header: {
    display:
      "flex",

    alignItems:
      "flex-start",

    justifyContent:
      "space-between",

    gap:
      "20px",

    padding:
      "24px",

    borderBottom:
      "1px solid #ebe7de",

    background:
      "#fffdf8",
  },

  headerCopy: {
    minWidth:
      0,
  },

  eyebrow: {
    display:
      "block",

    marginBottom:
      "6px",

    color:
      "#987000",

    fontSize:
      "10px",

    fontWeight:
      850,

    letterSpacing:
      "0.9px",

    textTransform:
      "uppercase",
  },

  title: {
    margin:
      0,

    color:
      "#28251f",

    fontSize:
      "22px",

    fontWeight:
      800,

    letterSpacing:
      "-0.35px",
  },

  description: {
    margin:
      "6px 0 0",

    color:
      "#7b776d",

    fontSize:
      "12px",

    lineHeight:
      1.55,
  },

  closeButton: {
    width:
      "36px",

    height:
      "36px",

    flex:
      "0 0 36px",

    display:
      "grid",

    placeItems:
      "center",

    padding:
      0,

    border:
      "1px solid #ded9ce",

    borderRadius:
      "10px",

    color:
      "#575248",

    background:
      "#ffffff",

    fontSize:
      "23px",

    lineHeight:
      1,

    cursor:
      "pointer",
  },

  content: {
    overflowY:
      "auto",

    padding:
      "24px",

    display:
      "grid",

    alignContent:
      "start",

    gap:
      "22px",
  },

  field: {
    display:
      "grid",

    gap:
      "8px",
  },

  label: {
    color:
      "#36322b",

    fontSize:
      "12px",

    fontWeight:
      800,
  },

  input: {
    width:
      "100%",

    height:
      "46px",

    boxSizing:
      "border-box",

    padding:
      "0 13px",

    border:
      "1px solid #dad6cc",

    borderRadius:
      "10px",

    outline:
      "none",

    color:
      "#28251f",

    background:
      "#ffffff",

    fontFamily:
      "inherit",

    fontSize:
      "13px",
  },

  textarea: {
    width:
      "100%",

    minHeight:
      "180px",

    boxSizing:
      "border-box",

    padding:
      "13px",

    border:
      "1px solid #dad6cc",

    borderRadius:
      "10px",

    outline:
      "none",

    color:
      "#28251f",

    background:
      "#ffffff",

    resize:
      "vertical",

    fontFamily:
      "inherit",

    fontSize:
      "13px",

    lineHeight:
      1.6,
  },

  helper: {
    margin:
      0,

    color:
      "#969083",

    fontSize:
      "10px",

    lineHeight:
      1.5,
  },

  messageHeader: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "space-between",

    gap:
      "10px",
  },

  optional: {
    color:
      "#928c80",

    fontSize:
      "10px",

    fontWeight:
      700,
  },

  summary: {
    display:
      "grid",

    gridTemplateColumns:
      "40px minmax(0, 1fr)",

    gap:
      "12px",

    padding:
      "15px",

    border:
      "1px solid #eadfbd",

    borderRadius:
      "12px",

    background:
      "#fbf7e9",
  },

  summaryIcon: {
    width:
      "40px",

    height:
      "40px",

    display:
      "grid",

    placeItems:
      "center",

    borderRadius:
      "10px",

    color:
      "#9a7300",

    background:
      "#f2e5b6",

    fontSize:
      "17px",
  },

  summaryTitle: {
    color:
      "#332f26",

    fontSize:
      "12px",

    fontWeight:
      800,
  },

  summaryText: {
    margin:
      "4px 0 0",

    color:
      "#797368",

    fontSize:
      "11px",

    lineHeight:
      1.55,
  },

  footer: {
    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "flex-end",

    gap:
      "10px",

    padding:
      "17px 24px",

    borderTop:
      "1px solid #e8e3d8",

    background:
      "#ffffff",

    boxShadow:
      "0 -6px 18px rgba(34, 30, 20, 0.04)",
  },

  footerButton: {
    minWidth:
      "90px",
  },

  sendButton: {
    minWidth:
      "135px",
  },
};

"use client";

import { useEffect, useState } from "react";

export default function SendRecordEmail({
  endpoint,
  defaultEmail = "",
  defaultSubject = "",
  recordLabel = "document",
  onSent,
}) {
  const [showForm, setShowForm] =
    useState(false);

  const [recipient, setRecipient] =
    useState(defaultEmail);

  const [subject, setSubject] =
    useState(defaultSubject);

  const [message, setMessage] =
    useState("");

  const [sending, setSending] =
    useState(false);

  /*
   * Keep the form values synchronised when a
   * different proposal or invoice is loaded.
   */
  useEffect(() => {
    setRecipient(defaultEmail || "");
  }, [defaultEmail]);

  useEffect(() => {
    setSubject(defaultSubject || "");
  }, [defaultSubject]);

  function toggleForm() {
    if (sending) {
      return;
    }

    setShowForm((currentValue) => !currentValue);
  }

  function closeForm() {
    if (sending) {
      return;
    }

    setShowForm(false);
  }

  async function sendEmail(event) {
    event.preventDefault();

    const cleanRecipient =
      recipient.trim();

    const cleanSubject =
      subject.trim();

    const cleanMessage =
      message.trim();

    if (!endpoint) {
      alert(
        "The email endpoint is not configured."
      );
      return;
    }

    if (!cleanRecipient) {
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

    if (!cleanSubject) {
      alert("Please enter an email subject.");
      return;
    }

    setSending(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          to: cleanRecipient,
          subject: cleanSubject,
          message: cleanMessage,
        }),
      });

      const data =
        await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Failed to send ${recordLabel}.`
        );
      }

      const recipientAddress =
        data.recipient || cleanRecipient;

      alert(
        `${capitalise(recordLabel)} sent successfully to ${recipientAddress}.`
      );

      setMessage("");
      setShowForm(false);

      if (typeof onSent === "function") {
        onSent(data);
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
      setSending(false);
    }
  }

  return (
    <div className="noPrint">
      <button
        type="button"
        className="primaryBtn"
        onClick={toggleForm}
        disabled={sending}
      >
        {showForm
          ? "Cancel Email"
          : `Send ${recordLabel}`}
      </button>

      {showForm && (
        <form
          onSubmit={sendEmail}
          className="panel"
          style={{
            position: "absolute",
            zIndex: 30,
            width: "min(420px, calc(100vw - 40px))",
            marginTop: "12px",
            padding: "20px",
            boxShadow:
              "0 20px 55px rgba(31, 27, 16, 0.18)",
          }}
        >
          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <h3
              style={{
                margin: 0,
              }}
            >
              Send {recordLabel}
            </h3>

            <p
              className="helperText"
              style={{
                margin:
                  "5px 0 0",
              }}
            >
              Confirm the recipient and message
              before sending.
            </p>
          </div>

          <label
            style={{
              display: "grid",
              gap: "7px",
              marginBottom: "14px",
              fontWeight: 700,
            }}
          >
            Recipient Email

            <input
              type="email"
              value={recipient}
              onChange={(event) =>
                setRecipient(
                  event.target.value
                )
              }
              placeholder="client@example.com"
              required
              disabled={sending}
              style={{
                width: "100%",
                height: "44px",
                padding: "0 12px",
                border:
                  "1px solid #dcd9d0",
                borderRadius: "10px",
              }}
            />
          </label>

          <label
            style={{
              display: "grid",
              gap: "7px",
              marginBottom: "14px",
              fontWeight: 700,
            }}
          >
            Subject

            <input
              value={subject}
              onChange={(event) =>
                setSubject(
                  event.target.value
                )
              }
              placeholder="Email subject"
              required
              disabled={sending}
              style={{
                width: "100%",
                height: "44px",
                padding: "0 12px",
                border:
                  "1px solid #dcd9d0",
                borderRadius: "10px",
              }}
            />
          </label>

          <label
            style={{
              display: "grid",
              gap: "7px",
              marginBottom: "17px",
              fontWeight: 700,
            }}
          >
            Message

            <textarea
              rows={6}
              value={message}
              onChange={(event) =>
                setMessage(
                  event.target.value
                )
              }
              placeholder="Optional message to the client"
              disabled={sending}
              style={{
                width: "100%",
                padding: "12px",
                border:
                  "1px solid #dcd9d0",
                borderRadius: "10px",
                resize: "vertical",
                lineHeight: 1.55,
              }}
            />
          </label>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}
          >
            <button
              type="button"
              className="secondaryBtn"
              onClick={closeForm}
              disabled={sending}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primaryBtn"
              disabled={sending}
            >
              {sending
                ? "Sending..."
                : `Send ${recordLabel}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function capitalise(value) {
  const text = String(
    value || "document"
  );

  return `${text
    .charAt(0)
    .toUpperCase()}${text.slice(1)}`;
}

async function readJsonResponse(response) {
  const responseText =
    await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return {
      error:
        "The server returned an invalid response.",
    };
  }
}

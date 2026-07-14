"use client";

import { useState } from "react";

export default function SendRecordEmail({
  endpoint,
  defaultEmail = "",
  defaultSubject = "",
  recordLabel = "document",
  onSent,
}) {
  const [showForm, setShowForm] = useState(false);
  const [recipient, setRecipient] =
    useState(defaultEmail);
  const [subject, setSubject] =
    useState(defaultSubject);
  const [message, setMessage] =
    useState("");
  const [sending, setSending] =
    useState(false);

  async function sendEmail(event) {
    event.preventDefault();

    if (!recipient.trim()) {
      alert("Please enter the recipient email address.");
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
          to: recipient.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            `Failed to send ${recordLabel}.`
        );
        return;
      }

      alert(
        `${recordLabel
          .charAt(0)
          .toUpperCase()}${recordLabel.slice(
          1
        )} sent successfully to ${data.recipient}.`
      );

      setShowForm(false);

      if (typeof onSent === "function") {
        onSent(data);
      }
    } catch (error) {
      console.error(error);

      alert(
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
        onClick={() => setShowForm(!showForm)}
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
            marginTop: "16px",
            minWidth: "340px",
          }}
        >
          <h3>
            Send {recordLabel}
          </h3>

          <label
            style={{
              display: "block",
              marginBottom: "14px",
            }}
          >
            Recipient Email

            <input
              type="email"
              value={recipient}
              onChange={(event) =>
                setRecipient(event.target.value)
              }
              placeholder="client@example.com"
              required
              style={{
                width: "100%",
                marginTop: "6px",
              }}
            />
          </label>

          <label
            style={{
              display: "block",
              marginBottom: "14px",
            }}
          >
            Subject

            <input
              value={subject}
              onChange={(event) =>
                setSubject(event.target.value)
              }
              placeholder="Email subject"
              style={{
                width: "100%",
                marginTop: "6px",
              }}
            />
          </label>

          <label
            style={{
              display: "block",
              marginBottom: "14px",
            }}
          >
            Message

            <textarea
              rows={6}
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              placeholder="Optional message to the client"
              style={{
                width: "100%",
                marginTop: "6px",
              }}
            />
          </label>

          <button
            type="submit"
            className="primaryBtn"
            disabled={sending}
          >
            {sending
              ? "Sending..."
              : `Send ${recordLabel}`}
          </button>
        </form>
      )}
    </div>
  );
}

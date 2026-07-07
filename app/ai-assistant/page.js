"use client";

import { useState } from "react";
import Sidebar from "../../components/Sidebar";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function AIAssistant() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  async function askAI() {
    if (!prompt) {
      alert("Please enter your question.");
      return;
    }

    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "AI request failed.");
        return;
      }

      setResponse(data.answer);
    } catch (error) {
      console.error(error);
      alert("Error contacting AI assistant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute>
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <div className="topBar">
            <div>
              <h1>AI Assistant</h1>
              <p className="helperText">
                Generate emails, quotes, project plans and business insights.
              </p>
            </div>
          </div>

          <div className="chatBox">
            <p className="aiMessage">
              Hello, I can help you write follow-up emails, generate quotes,
              create project tasks and analyse your business workflow.
            </p>

            <textarea
              className="emailDraftBox"
              rows={5}
              placeholder="Example: Write a follow-up email for a client who received a quote but has not replied."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <button
              className="primaryBtn"
              onClick={askAI}
              style={{ marginTop: "16px" }}
            >
              {loading ? "Generating..." : "Ask AI"}
            </button>

            {response && (
              <div className="panel" style={{ marginTop: "24px" }}>
                <h3>AI Response</h3>
                <pre className="quotePreview">{response}</pre>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

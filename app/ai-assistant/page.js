"use client";

import { useState } from "react";
import Sidebar from "../../components/Sidebar";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function AIAssistant() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const examples = [
    "Show me hot leads that need follow-up.",
    "Show unpaid invoices and pending payments.",
    "Which projects need attention?",
    "Write a follow-up email for Patric.",
    "Summarise my sales pipeline.",
    "What should I focus on today?",
  ];

  async function askAI(customPrompt) {
    const finalPrompt = customPrompt || prompt;

    if (!finalPrompt) {
      alert("Please enter your question.");
      return;
    }

    setPrompt(finalPrompt);
    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: finalPrompt }),
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
              <h1>AI Operations Manager</h1>
              <p className="helperText">
                Ask questions about leads, quotes, customers, projects,
                invoices and follow-ups.
              </p>
            </div>
          </div>

          <section className="panel">
            <h3>What can I help with?</h3>

            <div className="activityGrid">
              {examples.map((item) => (
                <button
                  key={item}
                  className="primaryBtn"
                  onClick={() => askAI(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          <div className="chatBox" style={{ marginTop: "24px" }}>
            <p className="aiMessage">
              I can analyse your business data and help you decide what to do
              next.
            </p>

            <textarea
              className="emailDraftBox"
              rows={5}
              placeholder="Example: What should I focus on today?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <button
              className="primaryBtn"
              onClick={() => askAI()}
              style={{ marginTop: "16px" }}
            >
              {loading ? "Thinking..." : "Ask AI Operations Manager"}
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

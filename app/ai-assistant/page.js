"use client";

import { useMemo, useRef, useState } from "react";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";

import styles from "./ai-assistant.module.css";

const QUICK_ACTIONS = [
  { icon: "◎", title: "Review hot leads", description: "Identify high-priority leads that need immediate action.", prompt: "Show me the hot leads that need follow-up and tell me what action I should take for each one." },
  { icon: "◷", title: "Schedule a call", description: "Create a CRM-linked call directly from natural language.", prompt: "Schedule a call with Daniel Reed tomorrow at 11:00." },
  { icon: "▰", title: "Check project risks", description: "Find delayed, blocked or overdue project work.", prompt: "Which projects need attention? Include delayed projects, overdue tasks and recommended next actions." },
  { icon: "✉", title: "Send follow-up email", description: "Prepare and send a CRM-linked follow-up email with confirmation.", prompt: "Send Daniel Reed a professional follow-up email asking whether he has any questions and what the next step should be." },
  { icon: "◇", title: "Convert a lead", description: "Convert a qualified lead into a customer and project.", prompt: "Convert Daniel Reed to a customer and create the related project." },
  { icon: "✦", title: "Today's priorities", description: "Get a management summary of what needs attention.", prompt: "What should I focus on today? Prioritise leads, projects, invoices, follow-ups and recent communication." },
];

const CAPABILITIES = [
  {
    icon: "◎",
    title: "Sales intelligence",
    description:
      "Analyse leads, quotes, proposals and conversion opportunities.",
  },
  {
    icon: "£",
    title: "Finance intelligence",
    description:
      "Review invoices, payment risk and outstanding revenue.",
  },
  {
    icon: "▰",
    title: "Delivery intelligence",
    description:
      "Identify delayed projects, blocked tasks and delivery risks.",
  },
  {
    icon: "◷",
    title: "Action intelligence",
    description:
      "Review follow-ups, overdue actions and next priorities.",
  },
];

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "I can analyse your SaiNal One business data and help you decide what to do next. Ask about leads, quotes, customers, projects, invoices, follow-ups or overall business priorities.",
  createdAt: new Date().toISOString(),
};

export default function AIAssistantPage() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([
    WELCOME_MESSAGE,
  ]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [executingPlan, setExecutingPlan] =
    useState(false);

  const textareaRef = useRef(null);

  const latestAssistantMessage = useMemo(() => {
    return [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          message.id !== "welcome"
      );
  }, [messages]);

  async function askAI(customPrompt) {
    const finalPrompt = String(customPrompt || prompt).trim();
    if (!finalPrompt || loading || executingPlan) {
      if (!finalPrompt) alert("Please enter your question.");
      return;
    }

    const userMessage = {
      id: createMessageId(),
      role: "user",
      content: finalPrompt,
      createdAt: new Date().toISOString(),
    };

    const conversation = messages
      .filter((message) =>
        (message.role === "user" || message.role === "assistant") &&
        message.id !== "welcome"
      )
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content }));

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setPrompt("");
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          conversation,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });

      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || "The AI request could not be completed.");

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createMessageId(),
          role: "assistant",
          content: data.answer || "The AI completed the request but returned no response.",
          createdAt: new Date().toISOString(),
          plan: data.requires_confirmation ? data.plan : null,
          planDisplay: data.requires_confirmation ? data.plan_display : null,
          confirmationReason: data.confirmation_reason || "",
          planStatus: data.requires_confirmation ? "pending" : null,
        },
      ]);
    } catch (error) {
      console.error("AI Assistant request error:", error);
      setErrorMessage(error.message || "Unable to contact the AI Assistant.");
      setMessages((currentMessages) => [
        ...currentMessages,
        { id: createMessageId(), role: "error", content: error.message || "Unable to contact the AI Assistant.", createdAt: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
      window.setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }

  async function confirmPlan(message) {
    if (!message?.plan || executingPlan || loading) return;
    try {
      setExecutingPlan(true);
      setErrorMessage("");
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, planStatus: "running" } : item));

      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "execute_plan",
          plan: message.plan,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });

      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || "The AI Agent could not complete the actions.");

      setMessages((current) => current
        .map((item) => item.id === message.id ? { ...item, planStatus: data.success ? "completed" : "failed" } : item)
        .concat({ id: createMessageId(), role: "assistant", content: data.answer || "AI Agent execution completed.", createdAt: new Date().toISOString() }));
    } catch (error) {
      setErrorMessage(error.message || "Unable to execute the AI Agent actions.");
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, planStatus: "failed" } : item));
    } finally {
      setExecutingPlan(false);
    }
  }

  function cancelPlan(message) {
    if (!message?.plan) return;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, planStatus: "cancelled" } : item));
  }

  function handlePromptChange(event) {
    setPrompt(event.target.value);
  }

  function handlePromptKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      askAI();
    }
  }

  function clearConversation() {
    if (
      messages.length === 1 &&
      messages[0].id === "welcome"
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Clear the current AI conversation?"
    );

    if (!confirmed) {
      return;
    }

    setMessages([WELCOME_MESSAGE]);
    setPrompt("");
    setErrorMessage("");
  }

  async function copyResponse(content) {
    if (!content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        content
      );

      alert("AI response copied.");
    } catch (error) {
      console.error(
        "Unable to copy AI response:",
        error
      );

      alert(
        "Unable to copy the AI response."
      );
    }
  }

  function reusePrompt(content) {
    setPrompt(content);

    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  return (
    <ProtectedRoute>
      <AppLayout
        title="AI Assistant"
        description="Analyse business data, identify risks and decide what to do next."
      >
        <div className={styles.page}>
          <section
            className={styles.heroSection}
          >
            <div
              className={styles.heroCopy}
            >
              <span
                className={styles.eyebrow}
              >
                AI operations workspace
              </span>

              <h2>
                Your AI business operations
                manager
              </h2>

              <p>
                Ask questions across sales,
                customers, finance, projects
                and follow-ups. SaiNal One can
                analyse your current business
                data, recommend the next action
                and perform permitted CRM work
                for you.
              </p>
            </div>

            <div
              className={
                styles.heroStatusCard
              }
            >
              <span
                className={styles.aiOrb}
              >
                ✦
              </span>

              <div>
                <small>
                  AI OPERATIONS MANAGER
                </small>

                <strong>
                  Ready to assist
                </strong>

                <p>
                  Connected to SaiNal One
                  business operations
                </p>
              </div>
            </div>
          </section>

          <section
            className={
              styles.quickActionsSection
            }
          >
            <div
              className={styles.sectionHeader}
            >
              <div>
                <span
                  className={
                    styles.sectionEyebrow
                  }
                >
                  Quick actions
                </span>

                <h3>
                  What can I help with?
                </h3>

                <p>
                  Select a common business
                  question or ask your own.
                </p>
              </div>
            </div>

            <div
              className={
                styles.quickActionsGrid
              }
            >
              {QUICK_ACTIONS.map(
                (action) => (
                  <button
                    key={action.title}
                    type="button"
                    className={
                      styles.quickActionCard
                    }
                    disabled={loading || executingPlan}
                    onClick={() =>
                      askAI(action.prompt)
                    }
                  >
                    <span
                      className={
                        styles.quickActionIcon
                      }
                    >
                      {action.icon}
                    </span>

                    <span
                      className={
                        styles.quickActionCopy
                      }
                    >
                      <strong>
                        {action.title}
                      </strong>

                      <small>
                        {action.description}
                      </small>
                    </span>

                    <span
                      className={
                        styles.quickActionArrow
                      }
                    >
                      →
                    </span>
                  </button>
                )
              )}
            </div>
          </section>

          <section
            className={
              styles.workspaceGrid
            }
          >
            <section
              className={
                styles.conversationPanel
              }
            >
              <div
                className={
                  styles.conversationHeader
                }
              >
                <div>
                  <span
                    className={
                      styles.sectionEyebrow
                    }
                  >
                    Conversation
                  </span>

                  <h3>
                    Ask SaiNal One
                  </h3>

                  <p>
                    Ask naturally and continue
                    with follow-up questions in
                    the same conversation.
                  </p>
                </div>

                <button
                  type="button"
                  className={
                    styles.clearConversationButton
                  }
                  onClick={
                    clearConversation
                  }
                  disabled={
                    loading ||
                    messages.length === 1
                  }
                >
                  Clear conversation
                </button>
              </div>

              <div
                className={
                  styles.messageList
                }
              >
                {messages.map(
                  (message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onCopy={
                        copyResponse
                      }
                      onReusePrompt={reusePrompt}
                      onConfirmPlan={confirmPlan}
                      onCancelPlan={cancelPlan}
                      executingPlan={executingPlan}
                    />
                  )
                )}

                {loading && (
                  <ThinkingMessage />
                )}
              </div>

              {errorMessage && (
                <div
                  className={
                    styles.errorBanner
                  }
                >
                  <span>!</span>

                  <div>
                    <strong>
                      AI request failed
                    </strong>

                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}

              <div
                className={
                  styles.composerSection
                }
              >
                <label
                  className={
                    styles.promptComposer
                  }
                >
                  <textarea
                    ref={textareaRef}
                    rows={4}
                    value={prompt}
                    onChange={
                      handlePromptChange
                    }
                    onKeyDown={
                      handlePromptKeyDown
                    }
                    placeholder="Ask about leads, quotes, customers, projects, invoices or follow-ups..."
                    disabled={loading}
                    aria-label="Ask the AI Operations Manager"
                  />

                  <div
                    className={
                      styles.composerFooter
                    }
                  >
                    <span>
                      Press Enter to send ·
                      Shift + Enter for a new
                      line
                    </span>

                    <button
                      type="button"
                      className={
                        styles.sendButton
                      }
                      disabled={
                        loading ||
                        executingPlan ||
                        !prompt.trim()
                      }
                      onClick={() => askAI()}
                    >
                      <span>✦</span>

                      {loading
                        ? "Thinking..."
                        : "Ask AI"}
                    </button>
                  </div>
                </label>

                <div
                  className={
                    styles.suggestedPrompts
                  }
                >
                  <span>
                    Suggested:
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setPrompt(
                        "What should I focus on today?"
                      )
                    }
                  >
                    Today's priorities
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPrompt(
                        "Which projects need attention?"
                      )
                    }
                  >
                    Project risks
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPrompt(
                        "Summarise my sales pipeline."
                      )
                    }
                  >
                    Sales pipeline
                  </button>
                </div>
              </div>
            </section>

            <aside
              className={
                styles.capabilitiesPanel
              }
            >
              <div
                className={
                  styles.capabilitiesHeader
                }
              >
                <span
                  className={
                    styles.capabilitiesIcon
                  }
                >
                  ✦
                </span>

                <div>
                  <span>
                    AI capabilities
                  </span>

                  <h3>
                    Business intelligence
                  </h3>
                </div>
              </div>

              <div
                className={
                  styles.capabilitiesList
                }
              >
                {CAPABILITIES.map(
                  (capability) => (
                    <div
                      key={capability.title}
                      className={
                        styles.capabilityItem
                      }
                    >
                      <span
                        className={
                          styles.capabilityIcon
                        }
                      >
                        {capability.icon}
                      </span>

                      <div>
                        <strong>
                          {capability.title}
                        </strong>

                        <p>
                          {
                            capability.description
                          }
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div
                className={
                  styles.aiGuidance
                }
              >
                <span>
                  Best results
                </span>

                <p>
                  Mention the business area,
                  record name or result you
                  need. For example:
                </p>

                <strong>
                  “Which invoices are overdue
                  and what should I do next?”
                </strong>
              </div>

              {latestAssistantMessage && (
                <div
                  className={
                    styles.latestInsight
                  }
                >
                  <span>
                    Latest AI response
                  </span>

                  <p>
                    {truncateText(
                      latestAssistantMessage.content,
                      180
                    )}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      copyResponse(
                        latestAssistantMessage.content
                      )
                    }
                  >
                    Copy response
                  </button>
                </div>
              )}
            </aside>
          </section>

          <section
            className={
              styles.disclaimerPanel
            }
          >
            <span>i</span>

            <p>
              AI recommendations are based on
              the business data available in
              SaiNal One. Review important
              financial, customer and delivery
              decisions before taking action.
            </p>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

function MessageBubble({
  message,
  onCopy,
  onReusePrompt,
  onConfirmPlan,
  onCancelPlan,
  executingPlan,
}) {
  const isUser =
    message.role === "user";

  const isError =
    message.role === "error";

  return (
    <article
      className={`${styles.messageRow} ${
        isUser
          ? styles.messageRowUser
          : ""
      }`}
    >
      <span
        className={`${styles.messageAvatar} ${
          isUser
            ? styles.userAvatar
            : isError
              ? styles.errorAvatar
              : styles.aiAvatar
        }`}
      >
        {isUser
          ? "YO"
          : isError
            ? "!"
            : "✦"}
      </span>

      <div
        className={`${styles.messageBubble} ${
          isUser
            ? styles.userBubble
            : isError
              ? styles.errorBubble
              : styles.aiBubble
        }`}
      >
        <div
          className={
            styles.messageMeta
          }
        >
          <strong>
            {isUser
              ? "You"
              : isError
                ? "SaiNal One"
                : "AI Operations Manager"}
          </strong>

          <time>
            {formatMessageTime(
              message.createdAt
            )}
          </time>
        </div>

        <div
          className={
            styles.messageContent
          }
        >
          {formatMessageContent(
            message.content
          )}
        </div>

        {message.planDisplay && (
          <ActionPlanCard
            message={message}
            onConfirm={onConfirmPlan}
            onCancel={onCancelPlan}
            disabled={executingPlan}
          />
        )}

        {!isError && (
          <div
            className={
              styles.messageActions
            }
          >
            {!isUser && (
              <button
                type="button"
                onClick={() =>
                  onCopy(
                    message.content
                  )
                }
              >
                Copy
              </button>
            )}

            {isUser && (
              <button
                type="button"
                onClick={() =>
                  onReusePrompt(
                    message.content
                  )
                }
              >
                Ask again
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function ActionPlanCard({ message, onConfirm, onCancel, disabled }) {
  const status = message.planStatus || "pending";
  return (
    <div className={styles.actionPlan}>
      <div className={styles.actionPlanHeader}>
        <div>
          <span>AI AGENT PLAN</span>
          <strong>{message.planDisplay?.summary || "Review actions"}</strong>
        </div>
        <span className={`${styles.actionPlanStatus} ${styles[`actionPlanStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`] || ""}`}>
          {status === "pending" ? "Needs confirmation" : status === "running" ? "Running" : status === "completed" ? "Completed" : status === "cancelled" ? "Cancelled" : "Failed"}
        </span>
      </div>

      <div className={styles.actionPlanList}>
        {(message.planDisplay?.actions || []).map((action) => (
          <div key={`${message.id}-${action.index}`} className={styles.actionPlanItem}>
            <span>{action.index}</span>
            <div>
              <strong>{action.label}</strong>
              {action.reason && <p>{action.reason}</p>}
            </div>
          </div>
        ))}
      </div>

      {message.confirmationReason && <p className={styles.actionPlanReason}>{message.confirmationReason}</p>}

      {status === "pending" && (
        <div className={styles.actionPlanActions}>
          <button type="button" className={styles.actionPlanCancel} disabled={disabled} onClick={() => onCancel(message)}>Cancel</button>
          <button type="button" className={styles.actionPlanConfirm} disabled={disabled} onClick={() => onConfirm(message)}>✦ Confirm & Run</button>
        </div>
      )}
    </div>
  );
}

function ThinkingMessage() {
  return (
    <article
      className={
        styles.messageRow
      }
    >
      <span
        className={`${styles.messageAvatar} ${styles.aiAvatar}`}
      >
        ✦
      </span>

      <div
        className={`${styles.messageBubble} ${styles.aiBubble}`}
      >
        <div
          className={
            styles.messageMeta
          }
        >
          <strong>
            AI Operations Manager
          </strong>
        </div>

        <div
          className={
            styles.thinkingContent
          }
        >
          <span />
          <span />
          <span />

          <p>
            Analysing your business data...
          </p>
        </div>
      </div>
    </article>
  );
}

function formatMessageContent(content) {
  const lines = String(
    content || ""
  ).split("\n");

  return lines.map((line, index) => {
    const cleanLine = line.trim();

    if (!cleanLine) {
      return (
        <br
          key={`space-${index}`}
        />
      );
    }

    const isBullet =
      cleanLine.startsWith("- ") ||
      cleanLine.startsWith("• ") ||
      /^\d+\.\s/.test(cleanLine);

    if (isBullet) {
      return (
        <p
          key={`line-${index}`}
          className={
            styles.messageBullet
          }
        >
          {cleanLine}
        </p>
      );
    }

    return (
      <p key={`line-${index}`}>
        {cleanLine}
      </p>
    );
  });
}

async function safeJson(response) {
  try { return await response.json(); } catch { return {}; }
}

function createMessageId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function formatMessageTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function truncateText(
  value,
  maximumLength
) {
  const text = String(value || "");

  if (
    text.length <= maximumLength
  ) {
    return text;
  }

  return `${text.slice(
    0,
    maximumLength
  )}...`;
}

"use client";

import { useMemo, useRef, useState } from "react";

import AppLayout from "../../components/layout/AppLayout";
import ProtectedRoute from "../../components/ProtectedRoute";

import styles from "./ai-assistant.module.css";

const QUICK_ACTIONS = [
  {
    icon: "◎",
    title: "Review hot leads",
    description:
      "Identify high-priority leads that need immediate action.",
    prompt:
      "Show me the hot leads that need follow-up and tell me what action I should take for each one.",
  },
  {
    icon: "£",
    title: "Review unpaid invoices",
    description:
      "Find unpaid invoices and potential payment risks.",
    prompt:
      "Show me unpaid invoices, pending payments and any payment risks that need attention.",
  },
  {
    icon: "▰",
    title: "Check project risks",
    description:
      "Find delayed, blocked or overdue project work.",
    prompt:
      "Which projects need attention? Include delayed projects, overdue tasks and recommended next actions.",
  },
  {
    icon: "✉",
    title: "Draft follow-up email",
    description:
      "Create a professional customer follow-up email.",
    prompt:
      "Write a professional follow-up email for Patric about the ecommerce website requirements and project timeline.",
  },
  {
    icon: "◇",
    title: "Summarise sales pipeline",
    description:
      "Review leads, quotes and sales opportunities.",
    prompt:
      "Summarise my sales pipeline, including hot leads, quote values and the most important sales actions.",
  },
  {
    icon: "✦",
    title: "Today's priorities",
    description:
      "Get a management summary of what needs attention.",
    prompt:
      "What should I focus on today? Prioritise leads, projects, invoices and follow-ups.",
  },
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
    const finalPrompt = String(
      customPrompt || prompt
    ).trim();

    if (!finalPrompt || loading) {
      if (!finalPrompt) {
        alert("Please enter your question.");
      }

      return;
    }

    const userMessage = {
      id: createMessageId(),
      role: "user",
      content: finalPrompt,
      createdAt: new Date().toISOString(),
    };

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
    ]);

    setPrompt("");
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/ai-assistant",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            prompt: finalPrompt,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "The AI request could not be completed."
        );
      }

      const answer =
        data.answer ||
        "The AI completed the request but returned no response.";

      const assistantMessage = {
        id: createMessageId(),
        role: "assistant",
        content: answer,
        createdAt: new Date().toISOString(),
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        assistantMessage,
      ]);
    } catch (error) {
      console.error(
        "AI Assistant request error:",
        error
      );

      setErrorMessage(
        error.message ||
          "Unable to contact the AI Assistant."
      );

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createMessageId(),
          role: "error",
          content:
            error.message ||
            "Unable to contact the AI Assistant.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);

      window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
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
                data and recommend the next
                best action.
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
                  business data
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
                    disabled={loading}
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
                    Ask one question at a time
                    for the clearest business
                    recommendation.
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
                      onReusePrompt={
                        reusePrompt
                      }
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

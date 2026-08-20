"use client";

import {
  use,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import AppLayout from "../../../components/layout/AppLayout";
import ProtectedRoute from "../../../components/ProtectedRoute";
import SendRecordEmail from "../../../components/SendRecordEmail";
import StatusBadge from "../../../components/StatusBadge";

import styles from "./proposal-details.module.css";

// =========================================================
// CONSTANTS
// =========================================================

const STATUSES = [
  "Draft",
  "Sent",
  "Accepted",
  "Rejected",
];

// =========================================================
// PAGE
// =========================================================

export default function ProposalDetailsPage({
  params,
}) {
  const {
    id,
  } =
    use(
      params
    );

  const router =
    useRouter();

  const [
    proposal,
    setProposal,
  ] = useState(null);

  const [
    draft,
    setDraft,
  ] = useState(null);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    access,
    setAccess,
  ] = useState({
    isOwner: false,
    canEdit: false,
    canDelete: false,
    canAssign: false,
    canSend: false,
    permissions: [],
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  // =======================================================
  // LOAD
  // =======================================================

  useEffect(() => {
    if (
      id
    ) {
      load();
    }
  }, [
    id,
  ]);

  async function load() {
    try {
      setLoading(
        true
      );

      setError(
        ""
      );

      const response =
        await fetch(
          `/api/proposals/${id}`,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to load proposal."
        );
      }

      setProposal(
        data.proposal ||
          null
      );

      setDraft(
        data.proposal ||
          null
      );

      setEmployees(
        Array.isArray(
          data.employees
        )
          ? data.employees
          : []
      );

      setAccess({
        isOwner:
          Boolean(
            data.access
              ?.isOwner
          ),

        canEdit:
          Boolean(
            data.access
              ?.canEdit
          ),

        canDelete:
          Boolean(
            data.access
              ?.canDelete
          ),

        canAssign:
          Boolean(
            data.access
              ?.canAssign
          ),

        canSend:
          Boolean(
            data.access
              ?.canSend
          ),

        permissions:
          Array.isArray(
            data.access
              ?.permissions
          )
            ? data.access
                .permissions
            : [],
      });
    } catch (error) {
      console.error(
        "Proposal loading error:",
        error
      );

      setProposal(
        null
      );

      setDraft(
        null
      );

      setError(
        error.message ||
          "Unable to load proposal."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  // =======================================================
  // EDIT
  // =======================================================

  function change(
    event
  ) {
    const {
      name,
      value,
    } =
      event.target;

    setDraft(
      (
        current
      ) => ({
        ...current,

        [name]:
          value,
      })
    );
  }

  function startEdit() {
    if (
      !access.canEdit &&
      !access.canAssign
    ) {
      return;
    }

    setDraft({
      ...proposal,
    });

    setEditing(
      true
    );
  }

  function cancelEdit() {
    setDraft({
      ...proposal,
    });

    setEditing(
      false
    );
  }

  // =======================================================
  // PATCH
  // =======================================================

  async function patch(
    body
  ) {
    const response =
      await fetch(
        `/api/proposals/${id}`,
        {
          method:
            "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              body
            ),
        }
      );

    const data =
      await response.json();

    if (
      !response.ok
    ) {
      throw new Error(
        data.error ||
          "Failed to update proposal."
      );
    }

    return (
      data.proposal ||
      null
    );
  }

  // =======================================================
  // SAVE
  // =======================================================

  async function save() {
    if (
      !draft
    ) {
      return;
    }

    if (
      access.canEdit &&
      (
        !draft.title?.trim() ||
        !draft.client?.trim() ||
        !draft.service?.trim() ||
        !draft.proposal_text?.trim()
      )
    ) {
      alert(
        "Title, client, service and proposal content are required."
      );

      return;
    }

    try {
      setSaving(
        true
      );

      const payload = {};

      if (
        access.canEdit
      ) {
        payload.title =
          draft.title.trim();

        payload.client =
          draft.client.trim();

        payload.contact =
          String(
            draft.contact ||
              ""
          ).trim();

        payload.email =
          String(
            draft.email ||
              ""
          ).trim();

        payload.service =
          draft.service.trim();

        payload.amount =
          String(
            draft.amount ||
              ""
          ).trim();

        payload.status =
          draft.status ||
          "Draft";

        payload.proposal_text =
          draft.proposal_text.trim();
      }

      if (
        access.canAssign
      ) {
        payload.owner_employee_id =
          draft.owner_employee_id ||
          "";
      }

      const updated =
        await patch(
          payload
        );

      if (
        updated
      ) {
        setProposal(
          updated
        );

        setDraft(
          updated
        );
      } else {
        await load();
      }

      setEditing(
        false
      );

      alert(
        "Proposal updated successfully."
      );
    } catch (error) {
      console.error(
        "Proposal update error:",
        error
      );

      alert(
        error.message ||
          "Error updating proposal."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  // =======================================================
  // STATUS
  // =======================================================

  async function changeStatus(
    nextStatus
  ) {
    if (
      !access.canEdit
    ) {
      return;
    }

    try {
      setSaving(
        true
      );

      const updated =
        await patch({
          status:
            nextStatus,
        });

      if (
        updated
      ) {
        setProposal(
          updated
        );

        setDraft(
          updated
        );
      }
    } catch (error) {
      console.error(
        "Proposal status update error:",
        error
      );

      alert(
        error.message ||
          "Unable to update proposal status."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  // =======================================================
  // DELETE
  // =======================================================

  async function deleteProposal() {
    if (
      !access.canDelete ||
      !proposal
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${
          proposal.proposal_number ||
          proposal.title ||
          "this proposal"
        }? This action cannot be undone.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    try {
      setDeleting(
        true
      );

      const response =
        await fetch(
          `/api/proposals/${id}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to delete proposal."
        );
      }

      alert(
        data.message ||
          "Proposal deleted successfully."
      );

      router.push(
        "/proposals"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "Proposal deletion error:",
        error
      );

      alert(
        error.message ||
          "Unable to delete proposal."
      );
    } finally {
      setDeleting(
        false
      );
    }
  }

  // =======================================================
  // COPY
  // =======================================================

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        proposal?.proposal_text ||
          ""
      );

      alert(
        "Proposal copied successfully."
      );
    } catch {
      alert(
        "Unable to copy proposal."
      );
    }
  }

  // =======================================================
  // STATES
  // =======================================================

  if (
    loading
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Proposal Studio"
          description="Loading proposal information."
        >
          <Loading />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (
    error
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Proposal Studio"
          description="Review and manage a customer proposal."
        >
          <section
            className={
              styles.error
            }
          >
            <div>
              <strong>
                Unable to load proposal
              </strong>

              <p>
                {error}
              </p>
            </div>

            <button
              type="button"
              className={
                styles.secondary
              }
              onClick={
                load
              }
            >
              Try again
            </button>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (
    !proposal ||
    !draft
  ) {
    return (
      <ProtectedRoute>
        <AppLayout
          title="Proposal Studio"
          description="Review and manage a customer proposal."
        >
          <section
            className={
              styles.notFound
            }
          >
            <b>
              ▤
            </b>

            <h2>
              Proposal not found
            </h2>

            <p>
              This proposal may have been
              deleted or you may not have
              access to it.
            </p>

            <Link
              className={
                styles.primary
              }
              href="/proposals"
            >
              Return to proposals
            </Link>
          </section>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  // =======================================================
  // DERIVED
  // =======================================================

  const visible =
    editing
      ? draft
      : proposal;

  const sections =
    parseSections(
      visible.proposal_text ||
        ""
    );

  const recommendations =
    buildRecommendations(
      proposal,
      sections
    );

  const canSend =
    Boolean(
      access.isOwner ||
      access.canSend
    );

  // =======================================================
  // PAGE
  // =======================================================

  return (
    <ProtectedRoute>
      <AppLayout
        title={
          visible.title ||
          "Proposal Studio"
        }
        description="Proposal document, customer information, pricing and response tracking."
      >
        <div
          className={
            styles.page
          }
        >
          {/* ===============================================
              HEADER
          =============================================== */}

          <section
            className={
              styles.header
            }
          >
            <div>
              <Link
                href="/proposals"
                className={
                  styles.back
                }
              >
                ← Back to proposals
              </Link>

              <span
                className={
                  styles.eyebrow
                }
              >
                Proposal workspace
              </span>

              <h2>
                {visible.title ||
                  "Proposal"}
              </h2>

              <p>
                {visible.proposal_number ||
                  "Proposal record"}
              </p>
            </div>

            <div
              className={
                styles.actions
              }
            >
              {!editing &&
                canSend && (
                  <SendRecordEmail
                    endpoint={`/api/proposals/${proposal.id}/send`}
                    defaultEmail={
                      proposal.email ||
                      ""
                    }
                    defaultSubject={`${proposal.title || "Proposal"} – ${
                      proposal.proposal_number ||
                      ""
                    }`}
                    recordLabel="proposal"
                    onSent={(
                      data
                    ) => {
                      if (
                        data.proposal
                      ) {
                        setProposal(
                          data.proposal
                        );

                        setDraft(
                          data.proposal
                        );
                      } else {
                        load();
                      }
                    }}
                  />
                )}

              {!editing &&
                (
                  access.canEdit ||
                  access.canAssign
                ) && (
                  <button
                    type="button"
                    className={
                      styles.secondary
                    }
                    onClick={
                      startEdit
                    }
                  >
                    Edit proposal
                  </button>
                )}

              {editing && (
                <>
                  <button
                    type="button"
                    className={
                      styles.primary
                    }
                    onClick={
                      save
                    }
                    disabled={
                      saving
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save changes"}
                  </button>

                  <button
                    type="button"
                    className={
                      styles.secondary
                    }
                    onClick={
                      cancelEdit
                    }
                    disabled={
                      saving
                    }
                  >
                    Cancel
                  </button>
                </>
              )}

              {!editing &&
                access.canDelete && (
                  <button
                    type="button"
                    className={
                      styles.secondary
                    }
                    onClick={
                      deleteProposal
                    }
                    disabled={
                      deleting
                    }
                  >
                    {deleting
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                )}
            </div>
          </section>

          {/* ===============================================
              HERO
          =============================================== */}

          <section
            className={
              styles.hero
            }
          >
            <div
              className={
                styles.identity
              }
            >
              <span>
                ▤
              </span>

              <div>
                <small>
                  Proposal
                </small>

                <h3>
                  {visible.proposal_number ||
                    "Proposal"}
                </h3>

                <p>
                  {visible.client ||
                    "No client"}
                </p>

                <div
                  className={
                    styles.meta
                  }
                >
                  <StatusBadge
                    status={
                      visible.status ||
                      "Draft"
                    }
                  />

                  <b>
                    Owner:{" "}
                    {proposal.owner
                      ?.full_name ||
                      "Unassigned"}
                  </b>

                  <b>
                    {formatDate(
                      proposal.created_at
                    )}
                  </b>
                </div>
              </div>
            </div>

            <div
              className={
                styles.value
              }
            >
              <span>
                Proposal value
              </span>

              <strong>
                {formatAmount(
                  visible.amount
                )}
              </strong>

              <small>
                {
                  visible.status ||
                  "Draft"
                }
              </small>
            </div>
          </section>

          {/* ===============================================
              EDITOR
          =============================================== */}

          {editing && (
            <section
              className={
                styles.editor
              }
            >
              <div
                className={
                  styles.panelHead
                }
              >
                <h3>
                  Edit proposal
                </h3>

                <p>
                  Update document details,
                  status and ownership.
                </p>
              </div>

              <div
                className={
                  styles.grid
                }
              >
                <div
                  className={
                    styles.panel
                  }
                >
                  {access.canEdit && (
                    <>
                      <EditField
                        label="Title"
                        name="title"
                        value={
                          visible.title
                        }
                        onChange={
                          change
                        }
                      />

                      <EditField
                        label="Client"
                        name="client"
                        value={
                          visible.client
                        }
                        onChange={
                          change
                        }
                      />

                      <EditField
                        label="Contact"
                        name="contact"
                        value={
                          visible.contact
                        }
                        onChange={
                          change
                        }
                      />

                      <EditField
                        label="Email"
                        name="email"
                        type="email"
                        value={
                          visible.email
                        }
                        onChange={
                          change
                        }
                      />

                      <EditField
                        label="Service"
                        name="service"
                        value={
                          visible.service
                        }
                        onChange={
                          change
                        }
                      />

                      <EditField
                        label="Amount"
                        name="amount"
                        value={
                          visible.amount
                        }
                        onChange={
                          change
                        }
                      />

                      <label
                        className={
                          styles.field
                        }
                      >
                        Status

                        <select
                          name="status"
                          value={
                            visible.status ||
                            "Draft"
                          }
                          onChange={
                            change
                          }
                        >
                          {STATUSES.map(
                            (
                              item
                            ) => (
                              <option
                                key={
                                  item
                                }
                                value={
                                  item
                                }
                              >
                                {
                                  item
                                }
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </>
                  )}

                  {access.canAssign && (
                    <label
                      className={
                        styles.field
                      }
                    >
                      Proposal owner

                      <select
                        name="owner_employee_id"
                        value={
                          visible.owner_employee_id ||
                          ""
                        }
                        onChange={
                          change
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
                </div>

                {access.canEdit && (
                  <div
                    className={
                      styles.panel
                    }
                  >
                    <label
                      className={
                        styles.field
                      }
                    >
                      Proposal content

                      <textarea
                        name="proposal_text"
                        rows={26}
                        value={
                          visible.proposal_text ||
                          ""
                        }
                        onChange={
                          change
                        }
                      />
                    </label>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ===============================================
              NORMAL CONTENT
          =============================================== */}

          {!editing && (
            <div
              className={
                styles.grid
              }
            >
              <section
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHead
                  }
                >
                  <h3>
                    Proposal information
                  </h3>
                </div>

                <Detail
                  label="Client"
                  value={
                    proposal.client
                  }
                />

                <Detail
                  label="Contact"
                  value={
                    proposal.contact
                  }
                />

                <Detail
                  label="Email"
                  value={
                    proposal.email
                  }
                />

                <Detail
                  label="Service"
                  value={
                    proposal.service
                  }
                />

                <Detail
                  label="Value"
                  value={
                    formatAmount(
                      proposal.amount
                    )
                  }
                />

                <Detail
                  label="Owner"
                  value={
                    proposal.owner
                      ?.full_name ||
                    "Unassigned"
                  }
                />

                <Detail
                  label="Created"
                  value={
                    formatDate(
                      proposal.created_at
                    )
                  }
                />

                {access.canEdit && (
                  <div
                    className={
                      styles.actions
                    }
                  >
                    {STATUSES.filter(
                      (
                        item
                      ) =>
                        item !==
                        proposal.status
                    ).map(
                      (
                        item
                      ) => (
                        <button
                          key={
                            item
                          }
                          type="button"
                          className={
                            styles.secondary
                          }
                          disabled={
                            saving
                          }
                          onClick={() =>
                            changeStatus(
                              item
                            )
                          }
                        >
                          Mark{" "}
                          {
                            item
                          }
                        </button>
                      )
                    )}
                  </div>
                )}
              </section>

              <section
                className={
                  styles.ai
                }
              >
                <div
                  className={
                    styles.panelHead
                  }
                >
                  <h3>
                    Proposal review
                  </h3>
                </div>

                {recommendations.map(
                  (
                    recommendation,
                    index
                  ) => (
                    <p
                      key={
                        index
                      }
                    >
                      ✦{" "}
                      {
                        recommendation
                      }
                    </p>
                  )
                )}
              </section>
            </div>
          )}

          {/* ===============================================
              DOCUMENT
          =============================================== */}

          {!editing && (
            <section
              className={
                styles.documentCard
              }
            >
              <div
                className={
                  styles.documentToolbar
                }
              >
                <div>
                  <span
                    className={
                      styles.eyebrow
                    }
                  >
                    Customer document
                  </span>

                  <h3>
                    Proposal preview
                  </h3>
                </div>

                <div>
                  <button
                    type="button"
                    className={
                      styles.secondary
                    }
                    onClick={
                      copy
                    }
                  >
                    Copy
                  </button>

                  <button
                    type="button"
                    className={
                      styles.primary
                    }
                    onClick={() =>
                      window.print()
                    }
                  >
                    Print / PDF
                  </button>
                </div>
              </div>

              <article
                className={
                  styles.document
                }
              >
                <header>
                  <div>
                    <b>
                      SN
                    </b>

                    <span>
                      <strong>
                        SaiNal Technologies Ltd
                      </strong>

                      <small>
                        Business solutions
                      </small>
                    </span>
                  </div>

                  <div>
                    <h2>
                      PROPOSAL
                    </h2>

                    <small>
                      {
                        proposal.proposal_number
                      }
                    </small>
                  </div>
                </header>

                <section
                  className={
                    styles.docMeta
                  }
                >
                  <div>
                    <small>
                      Prepared for
                    </small>

                    <strong>
                      {
                        proposal.client
                      }
                    </strong>

                    <p>
                      {proposal.contact ||
                        ""}
                    </p>

                    <p>
                      {proposal.email ||
                        ""}
                    </p>
                  </div>

                  <div>
                    <small>
                      Date
                    </small>

                    <strong>
                      {formatDate(
                        proposal.created_at
                      )}
                    </strong>
                  </div>
                </section>

                <section
                  className={
                    styles.summary
                  }
                >
                  <div>
                    <small>
                      Service
                    </small>

                    <strong>
                      {proposal.service ||
                        "Not specified"}
                    </strong>
                  </div>

                  <div>
                    <small>
                      Proposal value
                    </small>

                    <strong>
                      {formatAmount(
                        proposal.amount
                      )}
                    </strong>
                  </div>
                </section>

                <section
                  className={
                    styles.sections
                  }
                >
                  {sections.length >
                  0 ? (
                    sections.map(
                      (
                        section,
                        index
                      ) => (
                        <section
                          key={
                            index
                          }
                        >
                          {section.title && (
                            <h3>
                              {
                                section.title
                              }
                            </h3>
                          )}

                          <p>
                            {
                              section.content
                            }
                          </p>
                        </section>
                      )
                    )
                  ) : (
                    <p>
                      {
                        proposal.proposal_text
                      }
                    </p>
                  )}
                </section>

                <footer>
                  <p>
                    SaiNal Technologies Ltd
                  </p>

                  <p>
                    {
                      proposal.proposal_number
                    }
                  </p>
                </footer>
              </article>
            </section>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

// =========================================================
// EDIT FIELD
// =========================================================

function EditField({
  label,
  name,
  value,
  onChange,
  type = "text",
}) {
  return (
    <label
      className={
        styles.field
      }
    >
      {label}

      <input
        name={
          name
        }
        type={
          type
        }
        value={
          value ||
          ""
        }
        onChange={
          onChange
        }
      />
    </label>
  );
}

// =========================================================
// DETAIL
// =========================================================

function Detail({
  label,
  value,
}) {
  return (
    <div>
      <small>
        {label}
      </small>

      <p>
        {value ||
          "Not available"}
      </p>
    </div>
  );
}

// =========================================================
// LOADING
// =========================================================

function Loading() {
  return (
    <section
      className={
        styles.loading
      }
    >
      {Array.from({
        length: 6,
      }).map(
        (
          _,
          index
        ) => (
          <div
            key={
              index
            }
          />
        )
      )}
    </section>
  );
}

// =========================================================
// HELPERS
// =========================================================

function parseSections(
  text
) {
  const lines =
    String(
      text ||
        ""
    )
      .split("\n");

  const sections = [];

  let currentTitle =
    "";

  let currentContent = [];

  function pushSection() {
    const content =
      currentContent
        .join("\n")
        .trim();

    if (
      currentTitle ||
      content
    ) {
      sections.push({
        title:
          currentTitle,

        content,
      });
    }

    currentContent = [];
  }

  for (
    const line of lines
  ) {
    const trimmed =
      line.trim();

    const looksLikeHeading =
      trimmed &&
      trimmed.length <=
        55 &&
      trimmed ===
        trimmed.toUpperCase() &&
      /[A-Z]/.test(
        trimmed
      );

    if (
      looksLikeHeading
    ) {
      pushSection();

      currentTitle =
        trimmed;
    } else {
      currentContent.push(
        line
      );
    }
  }

  pushSection();

  return sections.filter(
    (
      section
    ) =>
      section.title ||
      section.content
  );
}

function buildRecommendations(
  proposal,
  sections
) {
  const recommendations = [];

  if (
    !proposal.email
  ) {
    recommendations.push(
      "Add a customer email address before sending the proposal."
    );
  }

  if (
    !proposal.amount
  ) {
    recommendations.push(
      "Confirm the commercial value before customer acceptance."
    );
  }

  if (
    sections.length <
    3
  ) {
    recommendations.push(
      "Consider adding clearer scope, commercial terms and next steps."
    );
  }

  if (
    normalise(
      proposal.status
    ) ===
    "draft"
  ) {
    recommendations.push(
      "Review the document before sending it to the customer."
    );
  }

  if (
    normalise(
      proposal.status
    ) ===
    "sent"
  ) {
    recommendations.push(
      "Follow up with the customer if a response is not received."
    );
  }

  if (
    recommendations.length ===
    0
  ) {
    recommendations.push(
      "The proposal currently has no obvious outstanding actions."
    );
  }

  return recommendations;
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

function getMoney(
  value
) {
  const parsed =
    Number(
      String(
        value ||
          ""
      ).replace(
        /[^0-9.-]/g,
        ""
      )
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function formatAmount(
  value
) {
  if (
    !value
  ) {
    return "Not set";
  }

  if (
    String(
      value
    ).includes(
      "£"
    )
  ) {
    return value;
  }

  const parsed =
    getMoney(
      value
    );

  if (
    !parsed
  ) {
    return value;
  }

  return parsed.toLocaleString(
    "en-GB",
    {
      style:
        "currency",

      currency:
        "GBP",

      maximumFractionDigits:
        2,
    }
  );
}

function formatDate(
  value
) {
  if (
    !value
  ) {
    return "Not available";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  );
}

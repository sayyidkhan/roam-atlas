/**
 * Starter-map chat and edit-modal presentation. This view renders only the
 * review workflow; callers own GenAI requests and draft state transitions.
 */
export function createDraftChatView({ escapeHtml }) {
  function getDraftEditModalContext(draft, target) {
    if (!target) return null;
    if (target === "starter-map") {
      return {
        target,
        label: "starter map",
        title: "Steer the starter map",
        placeholder: "Example: make the candidate regions more family-friendly, or focus the themes on food and nature",
        note: "Edits only change the starter map direction. Sources are still required before promotion."
      };
    }

    const [kind, name] = target.split(":");
    const decodedName = name ?? "";
    const isKnownRegion = kind === "region" && draft.regions.some((region) => region.name === decodedName);
    const isKnownTheme = kind === "theme" && draft.themes.some((theme) => theme.label === decodedName);
    if (!isKnownRegion && !isKnownTheme) return null;

    return {
      target,
      label: decodedName,
      title: `Steer ${decodedName}`,
      placeholder: `Example: rename ${decodedName}, or change why it matters`,
      note: `This edit is scoped to ${decodedName}. It only changes the starter map direction; sources are still required before promotion.`
    };
  }

  function renderDraftEditModal(draftState, modal) {
    const isSending = Boolean(draftState?.isSending);
    const messages = draftMessagesForTarget(draftState?.messages ?? [], modal.target);
    return `
      <section class="draft-edit-modal-backdrop" role="presentation">
        <section class="draft-edit-modal" role="dialog" aria-modal="true" aria-label="Edit ${escapeHtml(modal.label)} with GenAI">
          <header>
            <div>
              <p class="eyebrow">GenAI edit</p>
              <h3>${escapeHtml(modal.title)}</h3>
            </div>
            <button
              type="button"
              class="sheet-close"
              data-country-action="toggle-genai-prompt"
              data-genai-target="${escapeHtml(modal.target)}"
              aria-label="Close GenAI edit modal"
            >×</button>
          </header>
          <form class="draft-genai-form" data-country-genai-form data-genai-target="${escapeHtml(modal.target)}">
            <textarea
              name="instruction"
              rows="4"
              maxlength="420"
              placeholder="${escapeHtml(modal.placeholder)}"
              ${isSending ? "disabled" : ""}
            ></textarea>
            <button type="submit" ${isSending ? "disabled" : ""}>${isSending ? "Applying" : "Apply"}</button>
            <div class="draft-chat-log draft-chat-log--modal" aria-live="polite" aria-atomic="false">
              ${renderDraftChatLog(messages, {
                emptyText: "Chat history for this edit will appear here.",
                isSending
              })}
            </div>
            <p class="muted">${escapeHtml(modal.note)}</p>
          </form>
        </section>
      </section>
    `;
  }

  function renderDraftChat(draftState) {
    const messages = draftState.messages ?? [];
    const isSending = Boolean(draftState.isSending);

    return `
      <section class="draft-chat" aria-label="Starter map chat">
        <h3>Edit starter map</h3>
        <div class="draft-chat-log" aria-live="polite" aria-atomic="false">
          ${renderDraftChatLog(messages, {
            emptyText: "Ask for a different angle, such as states first, weekend trips, nature, food, family travel, or cross-border ideas.",
            isSending
          })}
        </div>
        <form class="draft-chat-form" data-country-chat-form>
          <textarea
            name="instruction"
            rows="2"
            maxlength="420"
            placeholder="Example: focus on regions first, then nearby cities"
            ${isSending ? "disabled" : ""}
          ></textarea>
          <button type="submit" ${isSending ? "disabled" : ""}>${isSending ? "Applying" : "Apply"}</button>
        </form>
        <p class="muted">This only changes the unconfirmed starter map. Sources are still required before promotion.</p>
      </section>
    `;
  }

  function renderDraftChatLog(messages, { emptyText, isSending } = {}) {
    const visibleMessages = (messages ?? []).filter((message) => !message.hidden);
    if (!visibleMessages.length) {
      return `<p class="muted">${escapeHtml(emptyText ?? "No chat history yet.")}</p>`;
    }

    const renderedMessages = visibleMessages.map(renderDraftChatMessage).join("");
    const status = isSending
      ? `<p class="draft-chat-status" role="status">Processing starter-map update...</p>`
      : "";
    return `${renderedMessages}${status}`;
  }

  function renderDraftChatMessage(message) {
    const status = message.status ? ` data-status="${escapeHtml(message.status)}"` : "";
    const label = draftChatMessageLabel(message);
    return `
      <article class="draft-chat-message draft-chat-message--${escapeHtml(message.role)}${message.status ? ` draft-chat-message--${escapeHtml(message.status)}` : ""}"${status}>
        <strong>${escapeHtml(label)}</strong>
        <p>${escapeHtml(message.text)}</p>
      </article>
    `;
  }

  function draftChatMessageLabel(message) {
    if (message.status === "processing") return "Processing";
    if (message.status === "done") return "Done";
    if (message.status === "error") return "Error";
    return message.role === "user" ? "You" : "RoamAtlas";
  }

  function draftMessagesForTarget(messages, target) {
    if (target === "starter-map") {
      return (messages ?? []).filter((message) => !message.target || message.target === "starter-map");
    }
    return (messages ?? []).filter((message) => message.target === target);
  }

  function scopedDraftMessage(message, target) {
    return { ...message, target };
  }

  return {
    draftMessagesForTarget,
    getDraftEditModalContext,
    renderDraftChat,
    renderDraftEditModal,
    scopedDraftMessage
  };
}

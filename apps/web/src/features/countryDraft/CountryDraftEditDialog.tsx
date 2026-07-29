import {
  type FormEvent,
  useEffect,
  useRef,
  useState
} from "react";

import type { DraftMessage } from "../countrySetup/countryExperiencePolicy";
import {
  draftChatMessageLabel,
  draftMessagesForTarget,
  getCountryDraftEditContext
} from "./countryDraftChatPolicy";
import type { CountryDraft } from "./countryDraftTypes";

type CountryDraftEditDialogProps = {
  draft: CountryDraft;
  isSending: boolean;
  messages: DraftMessage[];
  onClose: () => void;
  onSubmit: (target: string, instruction: string) => void;
  target: string | null;
};

export function CountryDraftEditDialog({
  draft,
  isSending,
  messages,
  onClose,
  onSubmit,
  target
}: CountryDraftEditDialogProps) {
  const [instruction, setInstruction] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const context = getCountryDraftEditContext(draft, target);

  useEffect(() => {
    if (context) {
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [context]);

  if (!context) return null;
  const visibleMessages = draftMessagesForTarget(
    messages,
    context.target
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction || isSending || !context) return;
    onSubmit(context.target, trimmedInstruction);
    setInstruction("");
  }

  return (
    <section
      className="draft-edit-modal-backdrop"
      role="presentation"
    >
      <section
        className="draft-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${context.label} with GenAI`}
      >
        <header>
          <div>
            <p className="eyebrow">GenAI edit</p>
            <h3>{context.title}</h3>
          </div>
          <button
            type="button"
            className="sheet-close"
            aria-label="Close GenAI edit modal"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <form className="draft-genai-form" onSubmit={submit}>
          <textarea
            ref={textareaRef}
            name="instruction"
            rows={4}
            maxLength={420}
            placeholder={context.placeholder}
            disabled={isSending}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
          />
          <button type="submit" disabled={isSending}>
            {isSending ? "Applying" : "Apply"}
          </button>
          <DraftChatLog
            isSending={isSending}
            messages={visibleMessages}
          />
          <p className="muted">{context.note}</p>
        </form>
      </section>
    </section>
  );
}

function DraftChatLog({
  isSending,
  messages
}: {
  isSending: boolean;
  messages: DraftMessage[];
}) {
  return (
    <div
      className="draft-chat-log draft-chat-log--modal"
      aria-live="polite"
      aria-atomic="false"
    >
      {messages.length === 0 ? (
        <p className="muted">
          Chat history for this edit will appear here.
        </p>
      ) : (
        messages
          .filter((message) => !message.hidden)
          .map((message, index) => (
            <article
              className={[
                "draft-chat-message",
                `draft-chat-message--${message.role}`,
                message.status
                  ? `draft-chat-message--${message.status}`
                  : ""
              ]
                .filter(Boolean)
                .join(" ")}
              data-status={message.status}
              key={`${index}:${message.role}:${message.text}`}
            >
              <strong>{draftChatMessageLabel(message)}</strong>
              <p>{message.text}</p>
            </article>
          ))
      )}
      {isSending ? (
        <p className="draft-chat-status" role="status">
          Processing starter-map update...
        </p>
      ) : null}
    </div>
  );
}

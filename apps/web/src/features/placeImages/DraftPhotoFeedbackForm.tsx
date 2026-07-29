import {
  useRef,
  useState,
  type FormEvent
} from "react";

import type { DraftPhotoLightboxSnapshot } from "./draftPhotoLightboxBridge";
import type { PlaceImagePromptResult } from "./placeImageTypes";

type DraftPhotoFeedbackFormProps = {
  feedbackMaxLength: number;
  onCancel: () => void;
  submitFeedback:
    DraftPhotoLightboxSnapshot["commands"]["submitFeedback"];
  suggestPrompts:
    DraftPhotoLightboxSnapshot["commands"]["suggestPrompts"];
};

export function DraftPhotoFeedbackForm({
  feedbackMaxLength,
  onCancel,
  submitFeedback,
  suggestPrompts
}: DraftPhotoFeedbackFormProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [promptResult, setPromptResult] =
    useState<PlaceImagePromptResult | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const normalizedFeedback = feedback.trim();
    if (!normalizedFeedback || isSubmitting) return;
    setIsSubmitting(true);
    const didSubmit = await submitFeedback(normalizedFeedback);
    if (!didSubmit) setIsSubmitting(false);
  }

  async function handleSuggestPrompts() {
    if (isSuggesting) return;
    setIsSuggesting(true);
    const result = await suggestPrompts(feedback);
    setPromptResult(result);
    setIsSuggesting(false);
  }

  function applySuggestion(suggestion: string) {
    setFeedback(suggestion);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <form
      className="draft-photo-lightbox-feedback"
      data-draft-photo-feedback
      onSubmit={handleSubmit}
    >
      <div className="draft-photo-lightbox-feedback-heading">
        <label htmlFor="draft-photo-feedback-input">
          Tell Exa what this photo should show
        </label>
        <button
          type="button"
          data-suggest-draft-photo-prompts
          disabled={isSuggesting}
          onClick={handleSuggestPrompts}
        >
          {isSuggesting ? "Suggesting" : "Suggest prompts"}
        </button>
      </div>
      <textarea
        ref={inputRef}
        id="draft-photo-feedback-input"
        name="feedback"
        rows={3}
        maxLength={feedbackMaxLength}
        placeholder="Example: Show NUS Kent Ridge campus or Jurong Lake Gardens, not Gardens by the Bay."
        value={feedback}
        autoFocus
        onChange={(event) => setFeedback(event.target.value)}
      />
      {promptResult?.suggestions.length ? (
        <DraftPhotoPromptSuggestions
          result={promptResult}
          onSelect={applySuggestion}
        />
      ) : null}
      <p>
        This only refines the external reference-photo search. It
        does not change travel facts.
      </p>
      <div className="draft-photo-lightbox-feedback-actions">
        <button
          type="button"
          data-close-draft-photo-feedback
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          data-submit-draft-photo-feedback
          disabled={!feedback.trim() || isSubmitting}
        >
          {isSubmitting ? "Searching Exa" : "Search Exa again"}
        </button>
      </div>
    </form>
  );
}

function DraftPhotoPromptSuggestions({
  result,
  onSelect
}: {
  result: PlaceImagePromptResult;
  onSelect: (suggestion: string) => void;
}) {
  const sourceLabel =
    result.source === "llm" ? "Gen AI" : "Fallback";
  return (
    <div
      className="draft-photo-prompt-suggestions"
      data-draft-photo-prompt-suggestions
    >
      <span
        className="draft-photo-prompt-source"
        data-prompt-source={result.source}
      >
        {sourceLabel}
      </span>
      {result.suggestions.map((suggestion, index) => (
        <button
          key={`${suggestion}-${index}`}
          type="button"
          data-draft-photo-prompt-index={index}
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}

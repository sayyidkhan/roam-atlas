import type { CountryDraftGroundingSnippet } from "./countryDraftTypes.ts";
import {
  asArray,
  isRecord
} from "./countryDraftTextPolicy.ts";

// A stray search result is not enough evidence to switch the prompt and
// confidence model into grounded mode.
export const MIN_GROUNDING_SNIPPETS = 3;

export function getUsableGroundingSnippets(
  groundingSnippets: unknown
): CountryDraftGroundingSnippet[] {
  const snippets = asArray(groundingSnippets)
    .filter(isRecord)
    .filter((snippet) =>
      Boolean(String(snippet.url ?? "").trim())
    );
  return snippets.length >= MIN_GROUNDING_SNIPPETS
    ? snippets
    : [];
}

export function formatGroundingSnippets(
  snippets: readonly CountryDraftGroundingSnippet[]
): string {
  return snippets
    .map((snippet, index) => {
      const title = truncatePromptText(
        snippet.title,
        "Untitled source",
        120
      );
      const url = truncatePromptText(
        snippet.url,
        "",
        300
      );
      const text = truncatePromptText(
        snippet.text,
        "",
        2000
      );
      return `[${index + 1}] ${title}\nURL: ${url}\n${text}`;
    })
    .join("\n\n");
}

function truncatePromptText(
  value: unknown,
  fallback: string,
  maxLength: number
): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  return text.length > maxLength
    ? `${text.slice(0, maxLength - 1).trim()}...`
    : text;
}

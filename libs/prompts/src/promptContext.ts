type PromptCountryContext = {
  countryName?: string;
  nodeTitle?: string;
};

export function getPromptCountryName(
  input: PromptCountryContext | null | undefined,
  {
    fallbackToNodeTitle = true
  }: {
    fallbackToNodeTitle?: boolean;
  } = {}
): string {
  return (
    cleanPromptText(input?.countryName) ||
    (fallbackToNodeTitle ? cleanPromptText(input?.nodeTitle) : "") ||
    "selected country"
  );
}

export function getPromptWholeAreaPhrase(
  countryName: string
): string {
  return countryName === "selected country" ? "the selected country" : `all of ${countryName}`;
}

function cleanPromptText(value: unknown): string {
  return String(value ?? "").trim();
}

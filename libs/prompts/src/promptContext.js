export function getPromptCountryName(input, { fallbackToNodeTitle = true } = {}) {
  return (
    cleanPromptText(input?.countryName) ||
    (fallbackToNodeTitle ? cleanPromptText(input?.nodeTitle) : "") ||
    "selected country"
  );
}

export function getPromptWholeAreaPhrase(countryName) {
  return countryName === "selected country" ? "the selected country" : `all of ${countryName}`;
}

function cleanPromptText(value) {
  return String(value ?? "").trim();
}

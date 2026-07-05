export function getPromptCountryName(input) {
  return cleanPromptText(input?.countryName) || cleanPromptText(input?.nodeTitle) || "selected country";
}

export function getPromptWholeAreaPhrase(countryName) {
  return countryName === "selected country" ? "the selected country" : `all of ${countryName}`;
}

function cleanPromptText(value) {
  return String(value ?? "").trim();
}

export function getPromptCountryName(input) {
  return cleanPromptText(input?.countryName) || "Singapore";
}

export function getPromptWholeAreaPhrase(countryName) {
  return countryName === "Singapore" ? "the entire island" : `all of ${countryName}`;
}

function cleanPromptText(value) {
  return String(value ?? "").trim();
}

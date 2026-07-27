export function toSafeHeaderValue(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]+/g, "")
    .slice(0, 240);
}

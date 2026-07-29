export function toSafeHeaderValue(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]+/g, "")
    .slice(0, 240);
}

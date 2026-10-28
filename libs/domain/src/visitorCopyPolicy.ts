/** Development notes must never be presented as destination descriptions. */
export function containsInternalVisitorCopy(text: string): boolean {
  return /\b(?:demo|testing|test[- ]only|prototype|hackathon|mvp|placeholder|first[- ]slice|proof[- ]of[- ]concept)\b|\broamatlas\s+(?:graph|dataset)\b|\bsource[- ]controlled dataset\b/i.test(text);
}

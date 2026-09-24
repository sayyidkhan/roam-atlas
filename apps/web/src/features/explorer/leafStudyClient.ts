import { apiPath } from "../../app/browserRuntime";

export type LeafStudyNoteResponse = {
  id: string;
  text: string;
};

export async function requestLeafStudyNotes({
  countrySlug,
  nodeId
}: {
  countrySlug: string;
  nodeId: string;
}): Promise<LeafStudyNoteResponse[]> {
  const response = await fetch(apiPath("/api/leaf-study"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ countrySlug, nodeId })
  });
  if (!response.ok) return [];
  const payload = await response.json() as { notes?: unknown };
  if (!Array.isArray(payload.notes)) return [];
  return payload.notes.flatMap((note) => {
    if (!note || typeof note !== "object") return [];
    const id = String((note as { id?: unknown }).id ?? "").trim();
    const text = String((note as { text?: unknown }).text ?? "").trim();
    return id && text ? [{ id, text }] : [];
  });
}

export function readExplorerCountrySlug(): string {
  const [slug] = window.location.pathname.split("/").filter(Boolean);
  return slug ?? "";
}

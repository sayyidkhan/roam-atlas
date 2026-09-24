export type LeafStudyPromptTopic = {
  id: string;
  label: string;
  sourceUrl?: string | null;
  text: string;
};

export function buildLeafStudyPrompt({
  countryName,
  placeTitle,
  topics
}: {
  countryName: string;
  placeTitle: string;
  topics: readonly LeafStudyPromptTopic[];
}): string {
  const curated = topics.map((topic) => ({
    id: topic.id,
    label: topic.label,
    curatedFact: topic.text,
    sourceUrl: topic.sourceUrl ?? null
  }));

  return [
    "You enrich one illustrated encyclopedia page in RoamAtlas.",
    "The curated lines below are short and repetitive. Replace each one with its own note.",
    "Return JSON only:",
    '{"notes":[{"id":"the supplied id","text":"two distinct sentences"}]}',
    "",
    "Rules:",
    "- Write exactly one note for every supplied id.",
    "- Each note is two sentences and stays under 280 characters.",
    "- Each note is about that topic only. Do not repeat another note's opening, shape, or wording.",
    "- Do not start a note with the pattern \"X is one of\" or \"X is part of\".",
    "- You may add general background that helps a reader picture that kind of landscape.",
    "- Keep every place-specific claim inside the curated fact for that id. A trail or landmark may be named only when that curated fact already names it.",
    "- Do not add opening hours, prices, tickets, closures, exact travel times, distances, live animal availability, rankings, or new place names.",
    "- Do not present the note as an official quotation or a confirmed fact.",
    "",
    `Country: ${countryName}`,
    `Place: ${placeTitle}`,
    `Curated topics: ${JSON.stringify(curated)}`
  ].join("\n");
}

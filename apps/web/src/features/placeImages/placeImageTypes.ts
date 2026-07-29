export type PlaceImageHistoryEntry = {
  active?: boolean;
  id: string;
  imageUrl: string;
};

export type PlaceImageHistoryResult = {
  activeDeleted?: boolean;
  items?: PlaceImageHistoryEntry[];
};

export type PlaceImagePromptResult = {
  source: "llm" | "curated-fallback";
  suggestions: string[];
};

export type PlaceImageSuggestionPayload = {
  source?: string;
  suggestions?: unknown[];
};

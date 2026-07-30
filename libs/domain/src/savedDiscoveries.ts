export type InitialSavedState = {
  createdAt: string;
  savedNodeIds: string[];
};

export function createInitialSavedState(
  savedNodeIds: string[] = []
): InitialSavedState {
  return {
    savedNodeIds: [...new Set(savedNodeIds)],
    createdAt: new Date().toISOString()
  };
}

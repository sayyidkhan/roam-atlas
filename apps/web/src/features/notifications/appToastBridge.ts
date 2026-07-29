export type AppToastOptions = {
  title: string;
  message: string;
  tone?: "success" | "error";
  durationMs?: number;
};

export type AppToastSnapshot = {
  commands: {
    dismiss: () => void;
  };
  message: string;
  title: string;
  tone: "success" | "error";
};

type Listener = () => void;

let currentSnapshot: AppToastSnapshot | null = null;
const listeners = new Set<Listener>();

export const appToastBridge = {
  clear(): void {
    currentSnapshot = null;
    listeners.forEach((listener) => listener());
  },

  getSnapshot(): AppToastSnapshot | null {
    return currentSnapshot;
  },

  publish(snapshot: AppToastSnapshot): void {
    currentSnapshot = snapshot;
    listeners.forEach((listener) => listener());
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};

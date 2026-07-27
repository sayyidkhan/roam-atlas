import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type PropsWithChildren
} from "react";

export type ApplicationView = "countries" | "country" | "explorer";

export type ApplicationRouteState = {
  view: ApplicationView;
  activeCountrySlug: string | null;
  selectedNodeId: string | null;
};

export type ApplicationAction =
  | { type: "show_countries" }
  | { type: "show_country_setup"; countrySlug: string }
  | { type: "show_explorer"; countrySlug: string; nodeId?: string | null }
  | { type: "select_node"; nodeId: string | null };

const initialRouteState: ApplicationRouteState = {
  view: "countries",
  activeCountrySlug: null,
  selectedNodeId: null
};

function applicationRouteReducer(
  state: ApplicationRouteState,
  action: ApplicationAction
): ApplicationRouteState {
  switch (action.type) {
    case "show_countries":
      return initialRouteState;
    case "show_country_setup":
      return {
        view: "country",
        activeCountrySlug: action.countrySlug,
        selectedNodeId: null
      };
    case "show_explorer":
      return {
        view: "explorer",
        activeCountrySlug: action.countrySlug,
        selectedNodeId: action.nodeId ?? null
      };
    case "select_node":
      return { ...state, selectedNodeId: action.nodeId };
  }
}

type ApplicationStore = {
  state: ApplicationRouteState;
  dispatch: Dispatch<ApplicationAction>;
};

const ApplicationStoreContext = createContext<ApplicationStore | null>(null);

export function ApplicationStoreProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(applicationRouteReducer, initialRouteState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <ApplicationStoreContext.Provider value={value}>
      {children}
    </ApplicationStoreContext.Provider>
  );
}

export function useApplicationStore(): ApplicationStore {
  const store = useContext(ApplicationStoreContext);
  if (!store) {
    throw new Error("useApplicationStore must be used inside ApplicationStoreProvider.");
  }
  return store;
}

export { applicationRouteReducer, initialRouteState };

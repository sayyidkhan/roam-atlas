import {
  apiPath,
  toApiUrl
} from "./browserRuntime";
import { createCountryDraftClient } from "../features/countryDraft/countryDraftClient";
import { createExplorerClient } from "../features/explorer/explorerClient";
import { createPlaceImageClient } from "../features/placeImages/placeImageClient";

export function createApplicationRuntimeClients() {
  return {
    countryDraftClient: createCountryDraftClient({
      fetchFn: (path, options) =>
        fetch(apiPath(String(path)), options)
    }),
    explorerClient: createExplorerClient({
      fetchFn: (path, options) =>
        fetch(toApiUrl(String(path)), options)
    }),
    placeImageClient: createPlaceImageClient({
      fetchFn: (path, options) =>
        fetch(apiPath(String(path)), options)
    })
  };
}

import { afterEach, expect, it, vi } from "vitest";
import { requestLeafStudyNotes } from "../../apps/web/src/features/explorer/leafStudyClient";

vi.mock("../../apps/web/src/app/browserRuntime", () => ({ apiPath: (path: string) => path }));
afterEach(() => vi.unstubAllGlobals());

it("drops old demo captions at the HTTP boundary while accepting traveller-facing notes", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ notes: [
    { id: "old", text: "Merlion Park appears in the Marina Bay demo path." },
    { id: "new", text: "Merlion Park is a photo stop in Marina Bay." }
  ] })));
  expect(await requestLeafStudyNotes({ countrySlug: "singapore", nodeId: "merlion-park" })).toEqual([
    { id: "new", text: "Merlion Park is a photo stop in Marina Bay." }
  ]);
});

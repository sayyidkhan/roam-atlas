import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const applicationRuntimeFacadeSource = readFileSync(
  new URL(
    "../apps/web/src/app/applicationRuntime.ts",
    import.meta.url
  ),
  "utf8"
);
const applicationRuntimeCompositionSource = readFileSync(
  new URL(
    "../apps/web/src/app/applicationRuntimeComposition.ts",
    import.meta.url
  ),
  "utf8"
);
const applicationRuntimeLifecycleSource = readFileSync(
  new URL(
    "../apps/web/src/app/applicationRuntimeLifecycle.ts",
    import.meta.url
  ),
  "utf8"
);
const applicationRuntimeClientsSource = readFileSync(
  new URL(
    "../apps/web/src/app/applicationRuntimeClients.ts",
    import.meta.url
  ),
  "utf8"
);
const applicationRuntimeConfigSource = readFileSync(
  new URL(
    "../apps/web/src/app/applicationRuntimeConfig.ts",
    import.meta.url
  ),
  "utf8"
);
const countrySetupRuntimeSource = readFileSync(
  new URL(
    "../apps/web/src/features/countrySetup/countrySetupRuntimeComposition.ts",
    import.meta.url
  ),
  "utf8"
);
const explorerPresentationSource = readFileSync(
  new URL(
    "../apps/web/src/features/explorer/explorerPresentationComposition.ts",
    import.meta.url
  ),
  "utf8"
);
const appSource = [
  applicationRuntimeFacadeSource,
  applicationRuntimeCompositionSource,
  applicationRuntimeLifecycleSource
].join("\n");
const featureRoot = new URL("../apps/web/src/features/", import.meta.url);

function readSourceTree(root) {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const entryUrl = new URL(entry.name + (entry.isDirectory() ? "/" : ""), root);
      if (entry.isDirectory()) return readSourceTree(entryUrl);
      if (!/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) return [];
      return [readFileSync(entryUrl, "utf8")];
    })
    .join("\n");
}

function listSourceFiles(root) {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const entryUrl = new URL(
        entry.name + (entry.isDirectory() ? "/" : ""),
        root
      );
      return entry.isDirectory()
        ? listSourceFiles(entryUrl)
        : [entryUrl.pathname];
    });
}

test("React composition root owns the frontend entry without an app monolith bridge", () => {
  const htmlSource = readFileSync(
    new URL("../apps/web/index.html", import.meta.url),
    "utf8"
  );
  const appComposition = readFileSync(new URL("../apps/web/src/app/App.tsx", import.meta.url), "utf8");
  const runtimeHost = readFileSync(
    new URL("../apps/web/src/app/ApplicationRuntimeHost.tsx", import.meta.url),
    "utf8"
  );

  assert.match(htmlSource, /src="\/src\/app\/main\.tsx"/);
  assert.doesNotMatch(htmlSource, /src="\/src\/ui\/app\.js/);
  assert.match(appComposition, /<Routes>/);
  assert.match(
    appComposition,
    /path="\/:countrySlug\/place\/:nodeId"/
  );
  assert.doesNotMatch(
    appComposition,
    /path="\*" element=\{<ApplicationRuntimeHost/
  );
  assert.doesNotMatch(appComposition, /ui\/app\.js/);
  assert.match(runtimeHost, /import\("\.\/applicationRuntime"\)/);
  assert.match(runtimeHost, /runtime\.startApplicationRuntime\(\)/);
  assert.match(
    runtimeHost,
    /runtime\.applyApplicationRuntimeRoute\(pathname\)/
  );
  assert.match(runtimeHost, /useLocation\(\)/);
  assert.match(runtimeHost, /stopRuntime\?\.\(\)/);
  assert.match(
    applicationRuntimeFacadeSource,
    /export function startApplicationRuntime\(/
  );
  assert.match(
    applicationRuntimeLifecycleSource,
    /consumers \+= 1/
  );
  assert.doesNotMatch(
    appSource,
    /^void getApplicationLifecycleController\(\)\.bootstrap\(\);$/m
  );
  assert.ok(
    applicationRuntimeFacadeSource.split("\n").length <=
      25
  );
  assert.doesNotMatch(
    applicationRuntimeFacadeSource,
    /features\//
  );
  assert.doesNotMatch(
    applicationRuntimeCompositionSource,
    /\bfetch\(/
  );
  assert.doesNotMatch(
    applicationRuntimeCompositionSource,
    /\b(?:window|document|localStorage)\b/
  );
  assert.match(
    applicationRuntimeClientsSource,
    /createApplicationRuntimeClients/
  );
  assert.match(
    applicationRuntimeConfigSource,
    /APPLICATION_RUNTIME_CONFIG/
  );
  assert.match(
    applicationRuntimeCompositionSource,
    /createCountrySetupRuntime/
  );
  assert.match(
    applicationRuntimeCompositionSource,
    /createArtworkRuntime/
  );
  assert.match(
    applicationRuntimeCompositionSource,
    /createExplorerRuntime/
  );
  assert.match(
    applicationRuntimeCompositionSource,
    /createExplorerPresentation/
  );
  assert.doesNotMatch(
    applicationRuntimeCompositionSource,
    /create(?:Artwork|Explorer|CountryExperience)Controller/
  );
  assert.doesNotMatch(
    applicationRuntimeCompositionSource,
    /\bas (?:never|unknown)\b/
  );
  assert.ok(
    applicationRuntimeCompositionSource.split("\n").length <=
      260
  );
  assert.equal(existsSync(new URL("../apps/web/src/ui/app.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/src/app/applicationRuntime.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/src/app/browserRuntime.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/src/app/applicationRuntime.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../apps/web/src/app/browserRuntime.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../apps/web/src/app/applicationElements.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../apps/web/src/app/applicationState.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../apps/web/src/app/applicationShellEvents.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/src/features/countrySetup/countryShellView.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/src/features/countrySetup/CountrySetupSurface.tsx", import.meta.url)), true);
  assert.equal(existsSync(new URL("../apps/web/src/features/countrySetup/countryShellController.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/src/features/countrySetup/countryShellController.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/src/features/countrySetup/countryExperienceController.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../apps/web/src/features/countrySetup/countryExperienceController.ts", import.meta.url)), true);
});

test("frontend source is TypeScript-only", () => {
  const webSourceRoot = new URL(
    "../apps/web/src/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(
    webSourceRoot
  ).filter((file) => /\.(?:js|jsx)$/.test(file));

  assert.deepEqual(javascriptFiles, []);
});

test("API source is TypeScript-only", () => {
  const apiSourceRoot = new URL(
    "../apps/api/src/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(
    apiSourceRoot
  ).filter((file) => /\.(?:js|jsx)$/.test(file));

  assert.deepEqual(javascriptFiles, []);
});

test("shared API contracts are TypeScript-owned behind stable package exports", () => {
  const contractSourceRoot = new URL(
    "../libs/contracts/src/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(
    contractSourceRoot
  ).filter((file) => /\.(?:js|jsx)$/.test(file));
  const contractPackage = JSON.parse(
    readFileSync(
      new URL(
        "../libs/contracts/package.json",
        import.meta.url
      ),
      "utf8"
    )
  );

  assert.deepEqual(javascriptFiles, []);
  assert.deepEqual(
    Object.keys(contractPackage.exports),
    [
      "./artworkContract.js",
      "./countryPackContract.js",
      "./runtimeCacheContract.js"
    ]
  );
  assert.ok(
    Object.values(contractPackage.exports).every(
      (target) =>
        typeof target === "string" &&
        target.endsWith(".ts")
    )
  );
});

test("shared catalog and experience config are TypeScript-owned behind stable package exports", () => {
  const dataSourceRoot = new URL(
    "../libs/data/src/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(
    dataSourceRoot
  ).filter((file) => /\.(?:js|jsx)$/.test(file));
  const dataPackage = JSON.parse(
    readFileSync(
      new URL(
        "../libs/data/package.json",
        import.meta.url
      ),
      "utf8"
    )
  );

  assert.deepEqual(javascriptFiles, []);
  assert.deepEqual(
    Object.keys(dataPackage.exports),
    [
      "./countries.js",
      "./experienceConfig.js"
    ]
  );
  assert.ok(
    Object.values(dataPackage.exports).every(
      (target) =>
        typeof target === "string" &&
        target.endsWith(".ts")
    )
  );
});

test("shared prompt construction is TypeScript-owned behind stable package exports", () => {
  const promptSourceRoot = new URL(
    "../libs/prompts/src/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(
    promptSourceRoot
  ).filter((file) => /\.(?:js|jsx)$/.test(file));
  const promptPackage = JSON.parse(
    readFileSync(
      new URL(
        "../libs/prompts/package.json",
        import.meta.url
      ),
      "utf8"
    )
  );
  const compilerSource = readFileSync(
    new URL(
      "../apps/api/src/data/countryPacks/compiler.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.deepEqual(javascriptFiles, []);
  assert.ok(
    Object.keys(promptPackage.exports).every(
      (specifier) => specifier.endsWith(".js")
    )
  );
  assert.ok(
    Object.values(promptPackage.exports).every(
      (target) =>
        typeof target === "string" &&
        target.endsWith(".ts")
    )
  );
  assert.equal(
    promptPackage.exports["./imagePromptBuilder.js"],
    "./src/imagePromptBuilder.ts"
  );
  assert.doesNotMatch(
    compilerSource,
    /buildRoamAtlasImagePrompt as unknown as/
  );
});

test("country-pack source compilation is TypeScript-owned", () => {
  const compilerSource = readFileSync(
    new URL(
      "../apps/api/src/data/countryPacks/compiler.ts",
      import.meta.url
    ),
    "utf8"
  );
  const registrySource = readFileSync(
    new URL(
      "../apps/api/src/data/countryPacks/serverRegistry.ts",
      import.meta.url
    ),
    "utf8"
  );
  const typeSource = readFileSync(
    new URL(
      "../apps/api/src/data/countryPacks/countryPackTypes.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(typeSource, /export type CountryPackSource/);
  assert.match(compilerSource, /buildTileCacheKey/);
  assert.match(compilerSource, /function compileScene/);
  assert.match(registrySource, /from "\.\/compiler\.ts"/);
  assert.match(registrySource, /parseCountryPackSource/);
  assert.match(registrySource, /requireNonEmptyString/);
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/data/countryPacks/compiler.js",
        import.meta.url
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/data/countryPacks/serverRegistry.js",
        import.meta.url
      )
    ),
    false
  );
});

test("API scene and default-artwork data are TypeScript-only", () => {
  const dataRoot = new URL(
    "../apps/api/src/data/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(
    dataRoot
  ).filter((file) => /\.(?:js|jsx)$/.test(file));
  const artworkSource = readFileSync(
    new URL("defaultArtworkPages.ts", dataRoot),
    "utf8"
  );
  const countryPackQueriesSource = readFileSync(
    new URL(
      "countryPacks/countryPackQueries.ts",
      dataRoot
    ),
    "utf8"
  );
  const sceneArtworkSource = readFileSync(
    new URL("sceneArtwork.ts", dataRoot),
    "utf8"
  );

  assert.deepEqual(javascriptFiles, []);
  assert.match(
    artworkSource,
    /export type DefaultArtworkPage/
  );
  assert.match(
    artworkSource,
    /CompiledCountryPack/
  );
  assert.match(
    countryPackQueriesSource,
    /nodes: CountryPackNodes,\s*query: unknown/
  );
  assert.match(
    sceneArtworkSource,
    /Record<\s*string,\s*SceneArtworkRecord/
  );
});

test("API HTTP platform primitives are TypeScript-owned", () => {
  const httpRoot = new URL(
    "../apps/api/src/platform/http/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(httpRoot).filter(
    (file) => /\.(?:js|jsx)$/.test(file)
  );
  const typedFiles = [
    "fetchResponses.ts",
    "mediaTypes.ts",
    "readJsonRequest.ts",
    "safeHeaderValue.ts"
  ];

  assert.deepEqual(javascriptFiles, []);
  for (const file of typedFiles) {
    assert.equal(existsSync(new URL(file, httpRoot)), true);
  }
  const requestReader = readFileSync(
    new URL("readJsonRequest.ts", httpRoot),
    "utf8"
  );
  assert.match(requestReader, /class HttpRequestError/);
  assert.match(requestReader, /maxBodyBytes/);
});

test("backend application config is TypeScript-owned", () => {
  const configSource = readFileSync(
    new URL(
      "../apps/api/src/config/roamAtlasConfig.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(configSource, /export type RoamAtlasConfig/);
  assert.match(
    configSource,
    /satisfies RoamAtlasConfig/
  );
  assert.match(
    configSource,
    /value is ConfiguredImageQuality/
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/config/roamAtlasConfig.js",
        import.meta.url
      )
    ),
    false
  );
});

test("OpenAI response parsing is TypeScript-owned and object-bounded", () => {
  const parserSource = readFileSync(
    new URL(
      "../apps/api/src/platform/openai/responseParsing.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    parserSource,
    /payload: unknown/
  );
  assert.match(
    parserSource,
    /JsonObject \| null/
  );
  assert.match(
    parserSource,
    /!Array\.isArray\(value\)/
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/platform/openai/responseParsing.js",
        import.meta.url
      )
    ),
    false
  );
});

test("runtime artifact path safety is TypeScript-owned", () => {
  const pathSource = readFileSync(
    new URL(
      "../apps/api/src/platform/runtime/runtimeCacheFiles.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    pathSource,
    /RuntimeArtifactPathResolverOptions/
  );
  assert.match(pathSource, /function isPathInside/);
  assert.match(pathSource, /function decodeUrlPath/);
  assert.match(
    pathSource,
    /catch \{\s*return null;/
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/platform/runtime/runtimeCacheFiles.js",
        import.meta.url
      )
    ),
    false
  );
});

test("local environment loading is TypeScript-owned", () => {
  const environmentSource = readFileSync(
    new URL(
      "../apps/api/src/platform/env/loadLocalEnv.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    environmentSource,
    /export type MutableEnvironment/
  );
  assert.match(
    environmentSource,
    /ENVIRONMENT_KEY_PATTERN/
  );
  assert.match(
    environmentSource,
    /Object\.hasOwn\(environment, key\)/
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/platform/env/loadLocalEnv.js",
        import.meta.url
      )
    ),
    false
  );
});

test("media fetch mechanics complete the TypeScript platform boundary", () => {
  const platformRoot = new URL(
    "../apps/api/src/platform/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(platformRoot).filter(
    (file) => /\.(?:js|jsx)$/.test(file)
  );
  const mediaSource = readFileSync(
    new URL("media/mediaFetch.ts", platformRoot),
    "utf8"
  );

  assert.deepEqual(javascriptFiles, []);
  assert.match(mediaSource, /export type MediaImageExtension/);
  assert.match(mediaSource, /RequestInit/);
  assert.match(mediaSource, /AbortSignal\.timeout\(timeoutMs\)/);
  assert.equal(
    existsSync(new URL("media/mediaFetch.js", platformRoot)),
    false
  );
});

test("critical domain guardrails, itinerary, and navigation policies are TypeScript-owned", () => {
  const domainPackage = JSON.parse(
    readFileSync(
      new URL(
        "../libs/domain/package.json",
        import.meta.url
      ),
      "utf8"
    )
  );
  const flipbookPageSource = readFileSync(
    new URL(
      "../libs/domain/src/flipbookPage.ts",
      import.meta.url
    ),
    "utf8"
  );
  const flipbookClickPolicySource = readFileSync(
    new URL(
      "../libs/domain/src/flipbookClickPolicy.ts",
      import.meta.url
    ),
    "utf8"
  );
  const flipbookTypesSource = readFileSync(
    new URL(
      "../libs/domain/src/flipbookTypes.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.equal(
    domainPackage.exports["./guardrails.js"],
    "./src/guardrails.ts"
  );
  assert.equal(
    domainPackage.exports["./itinerary.js"],
    "./src/itinerary.ts"
  );
  assert.equal(
    domainPackage.exports["./routes.js"],
    "./src/routes.ts"
  );
  assert.equal(
    domainPackage.exports[
      "./nextArtworkDestinations.js"
    ],
    "./src/nextArtworkDestinations.ts"
  );
  assert.equal(
    domainPackage.exports["./flipbookPage.js"],
    "./src/flipbookPage.ts"
  );
  for (const moduleName of [
    "clickResolver",
    "nodeMatcher",
    "pagePlanner",
    "scrollScene"
  ]) {
    assert.equal(
      domainPackage.exports[`./${moduleName}.js`],
      `./src/${moduleName}.ts`
    );
    assert.equal(
      existsSync(
        new URL(
          `../libs/domain/src/${moduleName}.js`,
          import.meta.url
        )
      ),
      false
    );
  }
  assert.equal(
    existsSync(
      new URL(
        "../libs/domain/src/guardrails.js",
        import.meta.url
      )
    ),
    false
  );
  assert.match(
    flipbookPageSource,
    /from "\.\/flipbookClickPolicy\.ts"/
  );
  assert.doesNotMatch(
    flipbookPageSource,
    /function (?:createVlmCandidates|resolveLocalPageClick|resolveTargetNodeClick)\(/
  );
  assert.match(
    flipbookClickPolicySource,
    /export function resolveLocalPageClick\(/
  );
  assert.match(
    flipbookTypesSource,
    /export type ResolveFlipbookClickInput/
  );
  assert.ok(
    [flipbookPageSource, flipbookClickPolicySource, flipbookTypesSource]
      .every((source) => source.split("\n").length <= 300)
  );
  assert.equal(
    existsSync(
      new URL(
        "../libs/domain/src/flipbookPage.js",
        import.meta.url
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "../libs/domain/src/itinerary.js",
        import.meta.url
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "../libs/domain/src/routes.js",
        import.meta.url
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "../libs/domain/src/nextArtworkDestinations.js",
        import.meta.url
      )
    ),
    false
  );
});

test("shared domain policy is TypeScript-only behind stable package exports", () => {
  const domainSourceRoot = new URL(
    "../libs/domain/src/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(
    domainSourceRoot
  ).filter((file) => /\.(?:js|jsx)$/.test(file));
  const domainPackage = JSON.parse(
    readFileSync(
      new URL(
        "../libs/domain/package.json",
        import.meta.url
      ),
      "utf8"
    )
  );

  assert.deepEqual(javascriptFiles, []);
  assert.ok(
    Object.values(domainPackage.exports).every(
      (target) =>
        typeof target === "string" &&
        target.endsWith(".ts")
    )
  );
  for (const moduleName of [
    "countryDraftReview",
    "loadingSteps",
    "placeImageSelection"
  ]) {
    assert.equal(
      domainPackage.exports[`./${moduleName}.js`],
      `./src/${moduleName}.ts`
    );
    assert.equal(
      existsSync(
        new URL(
          `../libs/domain/src/${moduleName}.js`,
          import.meta.url
        )
      ),
      false
    );
  }
});

test("place-image selection keeps configuration, profiles, and ranking behind a small facade", () => {
  const selectionFacade = readFileSync(
    new URL(
      "../libs/domain/src/placeImageSelection.ts",
      import.meta.url
    ),
    "utf8"
  );
  const selectionConfig = readFileSync(
    new URL(
      "../libs/domain/src/placeImageSelectionConfig.ts",
      import.meta.url
    ),
    "utf8"
  );
  const profilePolicy = readFileSync(
    new URL(
      "../libs/domain/src/placeImageProfile.ts",
      import.meta.url
    ),
    "utf8"
  );
  const rankingPolicy = readFileSync(
    new URL(
      "../libs/domain/src/placeImageCandidateRanking.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.ok(selectionFacade.split("\n").length <= 30);
  assert.match(selectionFacade, /from "\.\/placeImageProfile\.ts"/);
  assert.match(
    selectionFacade,
    /from "\.\/placeImageCandidateRanking\.ts"/
  );
  assert.doesNotMatch(
    selectionFacade,
    /REGION_CAPITALS|PLACE_LANDMARK_QUERIES/
  );
  assert.match(selectionConfig, /REGION_CAPITALS/);
  assert.match(selectionConfig, /PLACE_LANDMARK_QUERIES/);
  assert.match(profilePolicy, /function inferPlaceImageProfile\(/);
  assert.match(rankingPolicy, /function scorePlaceImageCandidate\(/);
});

test("public read-only API boundaries are TypeScript-owned", () => {
  const countryPackHandler = new URL(
    "../apps/api/src/features/countryCatalog/countryPackHttpHandler",
    import.meta.url
  );
  const experienceHandler = new URL(
    "../apps/api/src/features/experience/experienceConfigHttpHandler",
    import.meta.url
  );
  const countryPackSource = readFileSync(
    new URL(`${countryPackHandler.href}.ts`),
    "utf8"
  );
  const experienceSource = readFileSync(
    new URL(`${experienceHandler.href}.ts`),
    "utf8"
  );

  assert.equal(
    existsSync(new URL(`${countryPackHandler.href}.js`)),
    false
  );
  assert.equal(
    existsSync(new URL(`${experienceHandler.href}.js`)),
    false
  );
  assert.match(
    countryPackSource,
    /Record<string, CompiledCountryPack>/
  );
  assert.match(
    experienceSource,
    /RoamAtlasExperienceConfig/
  );
  assert.match(countryPackSource, /HonoRouteRegistrar/);
  assert.match(experienceSource, /HonoRouteRegistrar/);
});

test("country-draft domain policy is decomposed behind a typed facade", () => {
  const domainPackage = JSON.parse(
    readFileSync(
      new URL(
        "../libs/domain/package.json",
        import.meta.url
      ),
      "utf8"
    )
  );
  const facade = readFileSync(
    new URL(
      "../libs/domain/src/countryDraft.ts",
      import.meta.url
    ),
    "utf8"
  );
  const policyModules = [
    "countryDraftGroundingPolicy.ts",
    "countryDraftNormalization.ts",
    "countryDraftPrompt.ts",
    "countryDraftTextPolicy.ts",
    "countryDraftTypes.ts",
    "countryPackDraftProjection.ts"
  ];

  assert.equal(
    domainPackage.exports["./countryDraft.js"],
    "./src/countryDraft.ts"
  );
  assert.equal(
    existsSync(
      new URL(
        "../libs/domain/src/countryDraft.js",
        import.meta.url
      )
    ),
    false
  );
  assert.ok(facade.split("\n").length <= 30);
  assert.doesNotMatch(facade, /function\s+/);
  assert.match(facade, /from "\.\/countryDraftPrompt\.ts"/);
  assert.match(
    facade,
    /from "\.\/countryDraftNormalization\.ts"/
  );
  assert.match(
    facade,
    /from "\.\/countryPackDraftProjection\.ts"/
  );
  for (const moduleName of policyModules) {
    assert.equal(
      existsSync(
        new URL(
          `../libs/domain/src/${moduleName}`,
          import.meta.url
        )
      ),
      true
    );
  }
});

test("application state, element lookup, React routing, and view rendering stay outside runtime composition", () => {
  const stateSource = readFileSync(
    new URL("../apps/web/src/app/applicationState.ts", import.meta.url),
    "utf8"
  );
  const elementSource = readFileSync(
    new URL("../apps/web/src/app/applicationElements.ts", import.meta.url),
    "utf8"
  );
  const runtimeHostSource = readFileSync(
    new URL(
      "../apps/web/src/app/ApplicationRuntimeHost.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const viewSource = readFileSync(
    new URL("../apps/web/src/app/applicationViewController.ts", import.meta.url),
    "utf8"
  );
  const routeSource = readFileSync(
    new URL("../apps/web/src/app/applicationRouteController.ts", import.meta.url),
    "utf8"
  );
  const navigationStateSource = readFileSync(
    new URL("../apps/web/src/app/applicationNavigationState.ts", import.meta.url),
    "utf8"
  );

  assert.match(appSource, /createApplicationState/);
  assert.match(appSource, /createApplicationElements/);
  assert.doesNotMatch(appSource, /bindApplicationShellEvents/);
  assert.match(appSource, /createApplicationViewController/);
  assert.doesNotMatch(appSource, /applyApplicationRoute/);
  assert.doesNotMatch(appSource, /activateMappedCountry/);
  assert.doesNotMatch(appSource, /function requireElement</);
  assert.doesNotMatch(appSource, /window\.addEventListener\("popstate"/);
  assert.doesNotMatch(appSource, /function captureExplorerFocusKey\(/);
  assert.doesNotMatch(stateSource, /countryDrafts|checkedStoredDrafts/);
  assert.match(elementSource, /function requireElement</);
  assert.match(runtimeHostSource, /useLocation\(\)/);
  assert.match(
    runtimeHostSource,
    /applyApplicationRuntimeRoute\(pathname\)/
  );
  assert.match(viewSource, /function captureExplorerFocusKey\(/);
  assert.match(routeSource, /case "country_needs_config":/);
  assert.match(navigationStateSource, /function activateCuratedPlace\(/);
});

test("application navigation, generated state, and bootstrap have cohesive owners", () => {
  const lifecycleSource = readFileSync(
    new URL("../apps/web/src/app/applicationLifecycleController.ts", import.meta.url),
    "utf8"
  );
  const navigationSource = readFileSync(
    new URL(
      "../apps/web/src/app/applicationNavigationController.ts",
      import.meta.url
    ),
    "utf8"
  );
  const generatedStateSource = readFileSync(
    new URL(
      "../apps/web/src/app/applicationGeneratedStateController.ts",
      import.meta.url
    ),
    "utf8"
  );
  const shellSource = readFileSync(
    new URL("../apps/web/src/app/ApplicationShell.tsx", import.meta.url),
    "utf8"
  );
  const catalogPageSource = readFileSync(
    new URL("countryCatalog/CountryCatalogPage.tsx", featureRoot),
    "utf8"
  );

  assert.match(appSource, /createApplicationLifecycleController/);
  assert.doesNotMatch(appSource, /async function bootstrap\(/);
  assert.doesNotMatch(appSource, /function clearCountryGeneratedState\(/);
  assert.doesNotMatch(appSource, /function bindCountryLanding\(/);
  assert.match(lifecycleSource, /async function bootstrap\(/);
  assert.match(lifecycleSource, /async function applyRoute\(/);
  assert.match(lifecycleSource, /isRouteCurrent:/);
  assert.match(lifecycleSource, /function dispose\(/);
  assert.doesNotMatch(
    lifecycleSource,
    /resolveAppRoute as unknown/
  );
  assert.match(
    lifecycleSource,
    /createApplicationNavigationController/
  );
  assert.match(
    lifecycleSource,
    /createApplicationGeneratedStateController/
  );
  assert.doesNotMatch(
    lifecycleSource,
    /function clearCountryGeneratedState\(/
  );
  assert.doesNotMatch(
    lifecycleSource,
    /function enterCuratedPlace\(/
  );
  assert.match(
    generatedStateSource,
    /function clearCountryGeneratedState\(/
  );
  assert.match(navigationSource, /function enterCuratedPlace\(/);
  assert.match(
    navigationSource,
    /confidence: "unconfirmed"/
  );
  assert.doesNotMatch(shellSource, /id="country-landing"/);
  assert.doesNotMatch(shellSource, /id="country-grid"/);
  assert.match(catalogPageSource, /<CountryCatalogView/);
});

test("application runtime delegates mutable feature API calls to feature clients", () => {
  const explorerPageNavigationController = readFileSync(
    new URL(
      "explorer/explorerPageNavigationController.ts",
      featureRoot
    ),
    "utf8"
  );

  assert.doesNotMatch(appSource, /fetch\(apiPath\("\/api\/(?:country-draft|place-image|runtime-cache|flipbook)/);
  assert.match(
    applicationRuntimeClientsSource,
    /createCountryDraftClient/
  );
  assert.match(
    applicationRuntimeClientsSource,
    /createPlaceImageClient/
  );
  assert.match(
    applicationRuntimeClientsSource,
    /createExplorerClient/
  );
  assert.match(
    countrySetupRuntimeSource,
    /flushCountryRuntimeCache/
  );
  assert.doesNotMatch(appSource, /explorerClient\.resolveFlipbookClick/);
  assert.match(
    explorerPageNavigationController,
    /explorerClient\.resolveFlipbookClick/
  );
});

test("feature clients retain endpoint ownership outside the UI entry point", () => {
  const countryDraftClient = readFileSync(new URL("countryDraft/countryDraftClient.ts", featureRoot), "utf8");
  const placeImageClient = readFileSync(new URL("placeImages/placeImageClient.ts", featureRoot), "utf8");
  const runtimeCacheClient = readFileSync(new URL("runtimeCache/runtimeCacheClient.ts", featureRoot), "utf8");
  const explorerClient = readFileSync(new URL("explorer/explorerClient.ts", featureRoot), "utf8");

  assert.match(countryDraftClient, /\/api\/country-draft\/influence/);
  assert.match(placeImageClient, /\/api\/place-image\/feedback/);
  assert.match(runtimeCacheClient, /\/api\/runtime-cache\/flush/);
  assert.match(explorerClient, /\/api\/flipbook\/click/);
});

test("country-draft rendering is feature-owned instead of embedded in the UI controller", () => {
  const countryDraftTree = readFileSync(
    new URL("countryDraft/CountryDraftTree.tsx", featureRoot),
    "utf8"
  );
  const countryDraftRegionItem = readFileSync(
    new URL("countryDraft/CountryDraftRegionItem.tsx", featureRoot),
    "utf8"
  );
  const countryDraftThemeItem = readFileSync(
    new URL("countryDraft/CountryDraftThemeItem.tsx", featureRoot),
    "utf8"
  );
  const countryDraftChildNodes = readFileSync(
    new URL("countryDraft/CountryDraftChildNodes.tsx", featureRoot),
    "utf8"
  );

  assert.doesNotMatch(appSource, /createCountryDraftPanelView/);
  assert.doesNotMatch(appSource, /function renderDraftRegion\(/);
  assert.doesNotMatch(appSource, /function renderDraftTheme\(/);
  assert.doesNotMatch(appSource, /function renderDraftChildNodes\(/);
  assert.match(countryDraftTree, /<CountryDraftRegionItem/);
  assert.match(countryDraftTree, /<CountryDraftThemeItem/);
  assert.doesNotMatch(countryDraftTree, /function DraftRegionItem\(/);
  assert.match(
    countryDraftRegionItem,
    /function CountryDraftRegionItem\(/
  );
  assert.match(
    countryDraftThemeItem,
    /function CountryDraftThemeItem\(/
  );
  assert.match(
    countryDraftChildNodes,
    /function CountryDraftChildNodes\(/
  );
  assert.doesNotMatch(countryDraftTree, /dangerouslySetInnerHTML/);
  assert.equal(
    existsSync(
      new URL(
        "countryDraft/countryDraftPanelView.ts",
        featureRoot
      )
    ),
    false
  );
});

test("React owns destination loading and region navigation", () => {
  const destinationController = readFileSync(
    new URL(
      "explorer/explorerDestinationController.ts",
      featureRoot
    ),
    "utf8"
  );
  const destinationNavigation = readFileSync(
    new URL(
      "explorer/ExplorerDestinationNavigation.tsx",
      featureRoot
    ),
    "utf8"
  );

  assert.match(
    explorerPresentationSource,
    /createExplorerDestinationController/
  );
  assert.match(
    destinationController,
    /explorerDestinationBridge\.publish/
  );
  assert.match(
    destinationNavigation,
    /function ExplorerLoadingBoard\(/
  );
  assert.match(
    destinationNavigation,
    /function ExplorerRegionRail\(/
  );
  assert.doesNotMatch(
    destinationNavigation,
    /dangerouslySetInnerHTML/
  );
  assert.equal(
    existsSync(
      new URL(
        "explorer/destinationNavigationView.js",
        featureRoot
      )
    ),
    false
  );
});

test("React draft controls replace the delegated country-shell event controller", () => {
  const countryDraftViewController = readFileSync(
    new URL(
      "countryDraft/countryDraftViewController.ts",
      featureRoot
    ),
    "utf8"
  );
  const countryDraftEditDialog = readFileSync(
    new URL(
      "countryDraft/CountryDraftEditDialog.tsx",
      featureRoot
    ),
    "utf8"
  );
  const countryDraftTree = readFileSync(
    new URL("countryDraft/CountryDraftTree.tsx", featureRoot),
    "utf8"
  );
  const countryDraftRegionItem = readFileSync(
    new URL("countryDraft/CountryDraftRegionItem.tsx", featureRoot),
    "utf8"
  );
  const countryDraftChildNodes = readFileSync(
    new URL("countryDraft/CountryDraftChildNodes.tsx", featureRoot),
    "utf8"
  );
  const countryDraftDrag = readFileSync(
    new URL("countryDraft/useCountryDraftDrag.ts", featureRoot),
    "utf8"
  );
  const countryDraftToolbar = readFileSync(
    new URL("countryDraft/CountryDraftToolbar.tsx", featureRoot),
    "utf8"
  );
  const countryDraftSurface = readFileSync(
    new URL("countryDraft/CountryDraftSurface.tsx", featureRoot),
    "utf8"
  );
  const countryDraftEditTarget = readFileSync(
    new URL(
      "countryDraft/useCountryDraftEditTarget.ts",
      featureRoot
    ),
    "utf8"
  );
  assert.doesNotMatch(appSource, /createCountryShellController/);
  assert.doesNotMatch(appSource, /function bindCountryShell\(/);
  assert.doesNotMatch(appSource, /function focusOpenDraftGenAiTextarea\(/);
  assert.doesNotMatch(countryDraftViewController, /function focusPrompt\(/);
  assert.match(countryDraftEditDialog, /textareaRef\.current\?\.focus/);
  assert.match(countryDraftRegionItem, /commands\.approveItem/);
  assert.match(countryDraftTree, /commands\.reorderItems/);
  assert.match(countryDraftChildNodes, /commands\.deleteItem/);
  assert.match(countryDraftDrag, /reorderItems\(\{/);
  assert.match(countryDraftToolbar, /useState\(false\)/);
  assert.doesNotMatch(
    countryDraftViewController,
    /toggleToolMenu|countryDraftToolMenuOpen/
  );
  assert.doesNotMatch(appSource, /countryDraftToolMenuOpen/);
  assert.match(
    countryDraftSurface,
    /useState<CountryDraftSection>\("regions"\)/
  );
  assert.doesNotMatch(
    countryDraftViewController,
    /selectSection|countryDraftSectionTabs/
  );
  assert.doesNotMatch(appSource, /countryDraftSectionTabs/);
  assert.match(
    countryDraftSurface,
    /useCountryDraftEditTarget/
  );
  assert.match(
    countryDraftEditTarget,
    /getCountryDraftEditContext/
  );
  assert.doesNotMatch(
    countryDraftViewController,
    /toggleGenAi|countryDraftGenAiOpen/
  );
  assert.doesNotMatch(appSource, /countryDraftGenAiOpen/);
});

test("React owns the country setup shell through a feature-owned store", () => {
  const shellSource = readFileSync(
    new URL("../apps/web/src/app/ApplicationShell.tsx", import.meta.url),
    "utf8"
  );
  const surfaceSource = readFileSync(
    new URL(
      "countrySetup/CountrySetupSurface.tsx",
      featureRoot
    ),
    "utf8"
  );
  const countryExperienceController = readFileSync(
    new URL(
      "countrySetup/countryExperienceController.ts",
      featureRoot
    ),
    "utf8"
  );
  const actionController = readFileSync(
    new URL(
      "countrySetup/countrySetupActionController.ts",
      featureRoot
    ),
    "utf8"
  );
  const draftSurface = readFileSync(
    new URL(
      "countryDraft/CountryDraftSurface.tsx",
      featureRoot
    ),
    "utf8"
  );
  const draftToolbar = readFileSync(
    new URL(
      "countryDraft/CountryDraftToolbar.tsx",
      featureRoot
    ),
    "utf8"
  );
  const draftReview = readFileSync(
    new URL(
      "countryDraft/CountryDraftReview.tsx",
      featureRoot
    ),
    "utf8"
  );
  const draftEditDialog = readFileSync(
    new URL(
      "countryDraft/CountryDraftEditDialog.tsx",
      featureRoot
    ),
    "utf8"
  );

  assert.match(shellSource, /<CountrySetupSurface \/>/);
  assert.match(surfaceSource, /useStore/);
  assert.match(surfaceSource, /function CountrySetupActions/);
  assert.match(surfaceSource, /function ImageQualitySetting/);
  assert.match(surfaceSource, /useState\(false\)/);
  assert.match(
    countryExperienceController,
    /countrySetupStore\.getState\(\)\.setSetup/
  );
  assert.doesNotMatch(
    countryExperienceController,
    /countryShell\.innerHTML/
  );
  assert.match(
    surfaceSource,
    /snapshot\.commands\.openOrBuildMap/
  );
  assert.match(
    actionController,
    /function openOrBuildMap\(/
  );
  assert.doesNotMatch(
    actionController,
    /toggleActionGuide/
  );
  assert.doesNotMatch(
    countryExperienceController,
    /countryActionLegendOpen|isActionLegendOpen/
  );
  assert.doesNotMatch(
    appSource,
    /countryActionLegendOpen/
  );
  assert.doesNotMatch(appSource, /createCountryShellController/);
  assert.match(
    surfaceSource,
    /<CountryDraftSurface/
  );
  assert.match(
    draftSurface,
    /draft\.status === "empty"/
  );
  assert.match(
    draftSurface,
    /draft\.status === "failed"/
  );
  assert.match(draftToolbar, /function DraftSectionTabs/);
  assert.match(draftToolbar, /function DraftToolMenu/);
  assert.match(draftReview, /function DraftConfirmation/);
  assert.match(draftReview, /function ReviewChecklist/);
  assert.match(draftEditDialog, /function DraftChatLog/);
  assert.match(draftEditDialog, /onSubmit\(context\.target, trimmedInstruction\)/);
  assert.equal(
    existsSync(
      new URL(
        "../apps/web/src/features/countrySetup/countryShellView.ts",
        import.meta.url
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "countryDraft/draftReviewView.js",
        featureRoot
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "countryDraft/draftChatView.js",
        featureRoot
      )
    ),
    false
  );
});

test("country-draft workflows are feature-owned instead of embedded in country setup", () => {
  const countryExperienceController = readFileSync(
    new URL("countrySetup/countryExperienceController.ts", featureRoot),
    "utf8"
  );
  const countryDraftController = readFileSync(
    new URL("countryDraft/countryDraftController.ts", featureRoot),
    "utf8"
  );
  const lifecycleController = readFileSync(
    new URL(
      "countryDraft/countryDraftLifecycleController.ts",
      featureRoot
    ),
    "utf8"
  );
  const mutationController = readFileSync(
    new URL(
      "countryDraft/countryDraftMutationController.ts",
      featureRoot
    ),
    "utf8"
  );
  const influenceController = readFileSync(
    new URL(
      "countryDraft/countryDraftInfluenceController.ts",
      featureRoot
    ),
    "utf8"
  );
  const reviewController = readFileSync(
    new URL(
      "countryDraft/countryDraftReviewController.ts",
      featureRoot
    ),
    "utf8"
  );
  const draftStore = readFileSync(
    new URL(
      "countryDraft/countryDraftStore.ts",
      featureRoot
    ),
    "utf8"
  );
  const draftStateHook = readFileSync(
    new URL(
      "countryDraft/useCountryDraftState.ts",
      featureRoot
    ),
    "utf8"
  );
  const setupSurface = readFileSync(
    new URL(
      "countrySetup/CountrySetupSurface.tsx",
      featureRoot
    ),
    "utf8"
  );

  assert.match(countryExperienceController, /createCountryDraftController/);
  assert.doesNotMatch(countryExperienceController, /async function requestCountryDraftInfluence\(/);
  assert.doesNotMatch(countryExperienceController, /async function requestCountryDraftApproval\(/);
  assert.doesNotMatch(countryExperienceController, /function reorderCurrentDraftItems\(/);
  assert.match(
    countryDraftController,
    /createCountryDraftLifecycleController/
  );
  assert.match(
    countryDraftController,
    /createCountryDraftMutationController/
  );
  assert.doesNotMatch(
    countryDraftController,
    /async function requestCountryDraftInfluence\(/
  );
  assert.doesNotMatch(
    countryDraftController,
    /async function requestCountryDraftApproval\(/
  );
  assert.doesNotMatch(
    countryDraftController,
    /function reorderCurrentDraftItems\(/
  );
  assert.match(
    lifecycleController,
    /async function loadStoredCountryDraft\(/
  );
  assert.match(
    mutationController,
    /function reorderCurrentDraftItems\(/
  );
  assert.match(
    influenceController,
    /async function requestCountryDraftInfluence\(/
  );
  assert.match(
    reviewController,
    /async function requestCountryDraftApproval\(/
  );
  assert.match(
    lifecycleController,
    /cannot replace the curated source tree/
  );
  assert.match(draftStore, /listenersByCountry/);
  assert.match(draftStore, /checkedStoredDrafts/);
  assert.match(draftStateHook, /useSyncExternalStore/);
  assert.match(setupSurface, /useCountryDraftState/);
  assert.doesNotMatch(
    countryExperienceController,
    /state\.countryDrafts|state\.checkedStoredDrafts/
  );
});

test("reference-photo workflows are feature-owned instead of embedded in country setup", () => {
  const countryExperienceController = readFileSync(
    new URL("countrySetup/countryExperienceController.ts", featureRoot),
    "utf8"
  );
  const placeImageController = readFileSync(
    new URL("placeImages/placeImageController.ts", featureRoot),
    "utf8"
  );
  const lightboxController = readFileSync(
    new URL("placeImages/draftPhotoLightboxController.ts", featureRoot),
    "utf8"
  );
  const lightboxView = readFileSync(
    new URL("placeImages/DraftPhotoLightbox.tsx", featureRoot),
    "utf8"
  );
  const lightboxFeedbackView = readFileSync(
    new URL("placeImages/DraftPhotoFeedbackForm.tsx", featureRoot),
    "utf8"
  );
  const placeImageSessionStore = readFileSync(
    new URL(
      "placeImages/placeImageSessionStore.ts",
      featureRoot
    ),
    "utf8"
  );
  const applicationState = readFileSync(
    new URL(
      "../apps/web/src/app/applicationRuntimeTypes.ts",
      import.meta.url
    ),
    "utf8"
  );
  const draftPhotoView = readFileSync(
    new URL("countryDraft/CountryDraftReferencePhoto.tsx", featureRoot),
    "utf8"
  );
  const countrySetupStore = readFileSync(
    new URL("countrySetup/countrySetupStore.ts", featureRoot),
    "utf8"
  );

  assert.match(
    countrySetupStore,
    /createStore<CountrySetupStoreState>/
  );
  assert.doesNotMatch(countrySetupStore, /new Set|listeners/);
  assert.match(countryExperienceController, /createPlaceImageController/);
  assert.match(countryExperienceController, /createDraftPhotoLightboxController/);
  assert.doesNotMatch(countryExperienceController, /function buildPlaceImageUrl\(/);
  assert.doesNotMatch(countryExperienceController, /function openDraftPhotoLightbox\(/);
  assert.doesNotMatch(countryExperienceController, /async function requestPlaceImageFeedback\(/);
  assert.match(placeImageController, /function buildPlaceImageUrl\(/);
  assert.match(placeImageController, /async function requestPlaceImageFeedback\(/);
  assert.match(placeImageController, /placeImageSessionStore\.getUrlState/);
  assert.doesNotMatch(placeImageController, /state\.placeImage/);
  assert.match(lightboxController, /function openDraftPhotoLightbox\(/);
  assert.match(lightboxController, /async function loadDraftPhotoHistory\(/);
  assert.match(placeImageSessionStore, /const feedbacks = new Map/);
  assert.match(placeImageSessionStore, /const refreshes = new Map/);
  assert.doesNotMatch(
    applicationState,
    /placeImageRefreshes|placeImageFeedbacks/
  );
  assert.doesNotMatch(lightboxController, /innerHTML|createElement|querySelector/);
  assert.match(lightboxView, /useSyncExternalStore/);
  assert.match(lightboxView, /Not verified travel\s+data/);
  assert.match(lightboxFeedbackView, /does not change travel facts/);
  assert.match(draftPhotoView, /onLoad=\{handleLoad\}/);
  assert.doesNotMatch(countrySetupStore, /hydrateDraftPhotos/);
});

test("notifications, browser preferences, and runtime deletion have feature boundaries", () => {
  const countryExperienceController = readFileSync(
    new URL("countrySetup/countryExperienceController.ts", featureRoot),
    "utf8"
  );
  const runtimeCacheController = readFileSync(
    new URL(
      "runtimeCache/countryRuntimeCacheController.ts",
      featureRoot
    ),
    "utf8"
  );
  const runtimeCacheStore = readFileSync(
    new URL(
      "runtimeCache/countryRuntimeCacheStore.ts",
      featureRoot
    ),
    "utf8"
  );
  const countrySetupSurface = readFileSync(
    new URL(
      "countrySetup/CountrySetupSurface.tsx",
      featureRoot
    ),
    "utf8"
  );
  const applicationState = readFileSync(
    new URL("../apps/web/src/app/applicationRuntimeTypes.ts", import.meta.url),
    "utf8"
  );
  const appToastController = readFileSync(
    new URL("notifications/appToastController.ts", featureRoot),
    "utf8"
  );
  const appToastView = readFileSync(
    new URL("notifications/AppToast.tsx", featureRoot),
    "utf8"
  );
  const imageQualityPreference = readFileSync(
    new URL(
      "experience/imageQualityPreference.ts",
      featureRoot
    ),
    "utf8"
  );

  assert.match(
    countrySetupRuntimeSource,
    /createCountryRuntimeCacheController/
  );
  assert.match(appSource, /createAppToastController/);
  assert.match(appSource, /createImageQualityPreference/);
  assert.doesNotMatch(
    countryExperienceController,
    /async function requestCountryRuntimeCacheFlush\(/
  );
  assert.doesNotMatch(
    countryExperienceController,
    /function showAppToast\(/
  );
  assert.doesNotMatch(
    countryExperienceController,
    /localStorage/
  );
  assert.match(
    runtimeCacheController,
    /async function flush\(/
  );
  assert.match(runtimeCacheController, /runtimeCacheStore\.set/);
  assert.match(runtimeCacheStore, /listenersByCountry/);
  assert.match(runtimeCacheStore, /getSnapshot\(countrySlug\)/);
  assert.match(countrySetupSurface, /store\.subscribe\(countrySlug/);
  assert.doesNotMatch(applicationState, /countryCacheFlushes/);
  assert.doesNotMatch(runtimeCacheController, /countryCacheFlushes/);
  assert.match(appToastController, /function show\(/);
  assert.doesNotMatch(
    appToastController,
    /innerHTML|createElement|querySelector/
  );
  assert.match(appToastView, /useSyncExternalStore/);
  assert.match(appToastView, /data-dismiss-app-toast/);
  assert.match(
    imageQualityPreference,
    /localStorage\.setItem\(storageKey, value\)/
  );
});

test("artwork prefetch lifecycle is feature-owned instead of embedded in interactive artwork", () => {
  const artworkController = readFileSync(
    new URL("artwork/artworkController.ts", featureRoot),
    "utf8"
  );
  const prefetchController = readFileSync(
    new URL("artwork/artworkPrefetchController.ts", featureRoot),
    "utf8"
  );
  const prefetchJobController = readFileSync(
    new URL(
      "artwork/artworkPrefetchJobController.ts",
      featureRoot
    ),
    "utf8"
  );
  const prefetchPollingController = readFileSync(
    new URL(
      "artwork/artworkPrefetchPollingController.ts",
      featureRoot
    ),
    "utf8"
  );
  const prefetchCache = readFileSync(
    new URL("artwork/artworkPrefetchCache.ts", featureRoot),
    "utf8"
  );

  assert.match(artworkController, /createArtworkPrefetchController/);
  assert.doesNotMatch(artworkController, /function prefetchArtworkTarget\(/);
  assert.doesNotMatch(artworkController, /function pollPrefetchJob\(/);
  assert.match(
    prefetchController,
    /createArtworkPrefetchJobController/
  );
  assert.doesNotMatch(
    prefetchController,
    /function pollPrefetchJob\(/
  );
  assert.match(
    prefetchJobController,
    /function prefetchArtworkTarget\(/
  );
  assert.doesNotMatch(
    prefetchJobController,
    /function poll\(/
  );
  assert.match(
    prefetchJobController,
    /createArtworkPrefetchPollingController/
  );
  assert.match(
    prefetchPollingController,
    /function poll\(/
  );
  assert.doesNotMatch(
    prefetchJobController,
    /state\.artworkBy(?:Page|Scene)\.set/
  );
  assert.doesNotMatch(
    prefetchPollingController,
    /state\.artworkBy(?:Page|Scene)\.set/
  );
  assert.match(
    prefetchCache,
    /function storePrefetchedArtwork\(/
  );
});

test("interactive artwork lifecycles have cohesive feature owners", () => {
  const artworkController = readFileSync(
    new URL("artwork/artworkController.ts", featureRoot),
    "utf8"
  );
  const interactiveController = readFileSync(
    new URL("artwork/artworkInteractiveController.ts", featureRoot),
    "utf8"
  );
  const pollingController = readFileSync(
    new URL("artwork/artworkPollingController.ts", featureRoot),
    "utf8"
  );
  const requestController = readFileSync(
    new URL("artwork/artworkRequestController.ts", featureRoot),
    "utf8"
  );
  const pendingController = readFileSync(
    new URL("artwork/artworkPendingController.ts", featureRoot),
    "utf8"
  );
  const pollStateController = readFileSync(
    new URL(
      "artwork/artworkPollStateController.ts",
      featureRoot
    ),
    "utf8"
  );
  const lifecycleController = readFileSync(
    new URL("artwork/artworkLifecycleController.ts", featureRoot),
    "utf8"
  );
  const completionController = readFileSync(
    new URL("artwork/artworkCompletionController.ts", featureRoot),
    "utf8"
  );
  const partialController = readFileSync(
    new URL("artwork/artworkPartialController.ts", featureRoot),
    "utf8"
  );

  assert.match(artworkController, /createArtworkInteractiveController/);
  assert.match(artworkController, /createArtworkPollingController/);
  assert.match(artworkController, /createArtworkLifecycleController/);
  assert.match(artworkController, /createArtworkCompletionController/);
  assert.match(artworkController, /createArtworkPartialController/);
  assert.doesNotMatch(artworkController, /async function requestSceneArtwork\(/);
  assert.doesNotMatch(artworkController, /async function pollArtworkJob\(/);
  assert.doesNotMatch(artworkController, /async function completeSceneArtwork\(/);
  assert.match(
    interactiveController,
    /createArtworkRequestController/
  );
  assert.match(
    interactiveController,
    /createArtworkPendingController/
  );
  assert.doesNotMatch(
    interactiveController,
    /async function requestSceneArtwork\(/
  );
  assert.doesNotMatch(
    interactiveController,
    /function renderImageGenerationPending\(/
  );
  assert.match(
    requestController,
    /async function requestSceneArtwork\(/
  );
  assert.match(
    pendingController,
    /function renderImageGenerationPending\(/
  );
  assert.match(pollingController, /async function pollArtworkJob\(/);
  assert.match(
    pollingController,
    /createArtworkPollStateController/
  );
  assert.doesNotMatch(
    pollingController,
    /function shouldStopArtworkPolling\(/
  );
  assert.match(
    pollStateController,
    /function shouldStopArtworkPolling\(/
  );
  assert.match(
    pollStateController,
    /function copyArtworkJobStatus\(/
  );
  assert.doesNotMatch(pollingController, /async function completeSceneArtwork\(/);
  assert.doesNotMatch(pollingController, /async function preparePartialArtwork\(/);
  assert.doesNotMatch(pollingController, /function isCurrentArtworkAttempt\(/);
  assert.match(lifecycleController, /function isCurrentArtworkAttempt\(/);
  assert.match(lifecycleController, /function markArtworkJobFailed\(/);
  assert.match(completionController, /async function completeSceneArtwork\(/);
  assert.match(completionController, /async function completeCurrentPageArtwork\(/);
  assert.match(partialController, /async function preparePartialArtwork\(/);
});

test("environment-plan lifecycle is feature-owned instead of embedded in explorer rendering", () => {
  const explorerController = readFileSync(
    new URL("explorer/explorerController.ts", featureRoot),
    "utf8"
  );
  const environmentController = readFileSync(
    new URL("explorer/explorerEnvironmentController.ts", featureRoot),
    "utf8"
  );
  const promotionController = readFileSync(
    new URL(
      "explorer/explorerEnvironmentPromotionController.ts",
      featureRoot
    ),
    "utf8"
  );

  assert.match(explorerController, /createExplorerEnvironmentController/);
  assert.doesNotMatch(explorerController, /function fetchEnvironmentPlanWithRetry\(/);
  assert.doesNotMatch(explorerController, /function clearEnvironmentState\(/);
  assert.match(environmentController, /function fetchEnvironmentPlanWithRetry\(/);
  assert.match(environmentController, /function clearEnvironmentState\(/);
  assert.match(environmentController, /environmentPlanNeedsTargetRecovery/);
  assert.match(
    environmentController,
    /createExplorerEnvironmentPromotionController/
  );
  assert.doesNotMatch(
    environmentController,
    /function applyCurrentPageEnvironmentReference\(/
  );
  assert.match(
    promotionController,
    /function applyCurrentPageEnvironmentReference\(/
  );
});

test("click navigation lifecycle is feature-owned instead of embedded in explorer rendering", () => {
  const explorerController = readFileSync(
    new URL("explorer/explorerController.ts", featureRoot),
    "utf8"
  );
  const navigationController = readFileSync(
    new URL("explorer/explorerNavigationController.ts", featureRoot),
    "utf8"
  );
  const clickAdapter = readFileSync(
    new URL("explorer/explorerPageClickAdapter.ts", featureRoot),
    "utf8"
  );
  const requestController = readFileSync(
    new URL(
      "explorer/explorerNavigationRequestController.ts",
      featureRoot
    ),
    "utf8"
  );
  const pagePolicy = readFileSync(
    new URL(
      "explorer/explorerNavigationPagePolicy.ts",
      featureRoot
    ),
    "utf8"
  );
  const pageNavigationController = readFileSync(
    new URL(
      "explorer/explorerPageNavigationController.ts",
      featureRoot
    ),
    "utf8"
  );

  assert.match(explorerController, /createExplorerNavigationController/);
  assert.doesNotMatch(explorerController, /async function resolveClickAt\(/);
  assert.doesNotMatch(explorerController, /function beginNavigationRequest\(/);
  assert.doesNotMatch(explorerController, /function computeImageClick\(/);
  assert.match(navigationController, /async function resolveClickAt\(/);
  assert.doesNotMatch(navigationController, /new AbortController\(\)/);
  assert.doesNotMatch(
    navigationController,
    /querySelector<HTMLImageElement>/
  );
  assert.match(requestController, /function beginNavigationRequest\(/);
  assert.match(clickAdapter, /function computeImageClick\(/);
  assert.match(clickAdapter, /removeEventListener\("click"/);
  assert.match(pagePolicy, /function materializeExplorerRequestPage\(/);
  assert.match(
    navigationController,
    /createExplorerPageNavigationController/
  );
  assert.doesNotMatch(
    navigationController,
    /function runFlipbookResult\(/
  );
  assert.match(
    pageNavigationController,
    /function runFlipbookResult\(/
  );
  assert.match(
    pageNavigationController,
    /function buildImmediatePageFromTarget\(/
  );
  assert.match(navigationController, /Runtime artwork may navigate only through/);
});

test("React owns scene artwork, tiles, target overlays, and responsive layout", () => {
  const explorerController = readFileSync(
    new URL("explorer/explorerController.ts", featureRoot),
    "utf8"
  );
  const sceneController = readFileSync(
    new URL(
      "explorer/explorerSceneController.ts",
      featureRoot
    ),
    "utf8"
  );
  const sceneOrchestrator = readFileSync(
    new URL(
      "explorer/explorerSceneOrchestrator.ts",
      featureRoot
    ),
    "utf8"
  );
  const sceneStage = readFileSync(
    new URL("explorer/ExplorerSceneStage.tsx", featureRoot),
    "utf8"
  );

  assert.match(explorerController, /publishExplorerScene/);
  assert.doesNotMatch(explorerController, /function renderImageTargetHotspots\(/);
  assert.doesNotMatch(explorerController, /function renderTileArt\(/);
  assert.doesNotMatch(explorerController, /new ResizeObserver\(/);
  assert.match(
    sceneController,
    /explorerSceneBridge\.publish/
  );
  assert.match(
    explorerController,
    /createExplorerSceneOrchestrator/
  );
  assert.doesNotMatch(
    explorerController,
    /function renderScene\(/
  );
  assert.match(sceneOrchestrator, /function renderScene\(/);
  assert.match(sceneStage, /function SceneTile\(/);
  assert.match(sceneStage, /function SceneTarget\(/);
  assert.match(sceneStage, /new ResizeObserver\(sync\)/);
  assert.doesNotMatch(sceneStage, /dangerouslySetInnerHTML/);
  assert.equal(
    existsSync(
      new URL("explorer/explorerSceneView.ts", featureRoot)
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL("explorer/explorerController.js", featureRoot)
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL("explorer/explorerController.ts", featureRoot)
    ),
    true
  );
});

test("React owns decorative ambient layers without factual or navigation authority", () => {
  const environmentLayers = readFileSync(
    new URL(
      "explorer/ExplorerEnvironmentLayers.tsx",
      featureRoot
    ),
    "utf8"
  );
  const environmentPolicy = readFileSync(
    new URL(
      "explorer/explorerEnvironmentLayerPolicy.ts",
      featureRoot
    ),
    "utf8"
  );
  const environmentAtmosphere = readFileSync(
    new URL(
      "explorer/ExplorerEnvironmentAtmosphere.tsx",
      featureRoot
    ),
    "utf8"
  );

  assert.match(
    environmentAtmosphere,
    /function ExplorerEnvironmentAtmosphere\(/
  );
  assert.match(
    environmentLayers,
    /aria-hidden="true"/
  );
  assert.match(
    environmentPolicy,
    /function selectEnvironmentLayers\(/
  );
  assert.doesNotMatch(
    environmentLayers,
    /facts|sourceUrl|resolveOverlayTarget|onClick/
  );
  assert.doesNotMatch(
    environmentLayers,
    /dangerouslySetInnerHTML/
  );
  assert.equal(
    existsSync(
      new URL(
        "explorer/environmentLayerRenderer.js",
        featureRoot
      )
    ),
    false
  );
});

test("React owns explorer factual detail and detour rendering", () => {
  const explorerController = readFileSync(
    new URL("explorer/explorerController.ts", featureRoot),
    "utf8"
  );
  const detailController = readFileSync(
    new URL(
      "explorer/explorerDetailController.ts",
      featureRoot
    ),
    "utf8"
  );
  const detailSheet = readFileSync(
    new URL("explorer/ExplorerDetailSheet.tsx", featureRoot),
    "utf8"
  );

  assert.match(
    explorerController,
    /createExplorerDetailController/
  );
  assert.doesNotMatch(
    explorerController,
    /detailRoot\.innerHTML|renderExplorerDetailPanel/
  );
  assert.match(
    detailController,
    /explorerDetailBridge\.publish/
  );
  assert.match(detailSheet, /useSyncExternalStore/);
  assert.match(detailSheet, /hasUnconfirmedNodeFacts/);
  assert.doesNotMatch(detailSheet, /dangerouslySetInnerHTML/);
  assert.equal(
    existsSync(
      new URL("explorer/detailPanel.js", featureRoot)
    ),
    false
  );
});

test("React owns explorer HUD, navigation controls, visibility, and busy state", () => {
  const shellSource = readFileSync(
    new URL(
      "../apps/web/src/app/ApplicationShell.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const elementSource = readFileSync(
    new URL(
      "../apps/web/src/app/applicationElements.ts",
      import.meta.url
    ),
    "utf8"
  );
  const viewportSource = readFileSync(
    new URL("explorer/ExplorerViewport.tsx", featureRoot),
    "utf8"
  );
  const navigationController = readFileSync(
    new URL(
      "explorer/explorerNavigationController.ts",
      featureRoot
    ),
    "utf8"
  );

  assert.match(shellSource, /<ExplorerViewport \/>/);
  assert.match(viewportSource, /useSyncExternalStore/);
  assert.match(viewportSource, /snapshot\?\.commands\.countries/);
  assert.match(viewportSource, /snapshot\?\.commands\.back/);
  assert.doesNotMatch(
    elementSource,
    /sceneTitle|breadcrumb|countryButton|backButton/
  );
  assert.doesNotMatch(
    navigationController,
    /viewport\.classList\.(?:add|remove)\("is-busy"/
  );
});

test("React owns explorer loading feedback while page transitions stay outside browser infrastructure", () => {
  const browserRuntime = readFileSync(
    new URL(
      "../apps/web/src/app/browserRuntime.ts",
      import.meta.url
    ),
    "utf8"
  );
  const feedbackSurface = readFileSync(
    new URL(
      "explorer/ExplorerNavigationFeedback.tsx",
      featureRoot
    ),
    "utf8"
  );
  const feedbackController = readFileSync(
    new URL(
      "explorer/explorerFeedbackController.ts",
      featureRoot
    ),
    "utf8"
  );
  const pageTransitionController = readFileSync(
    new URL(
      "explorer/explorerPageTransitionController.ts",
      featureRoot
    ),
    "utf8"
  );

  assert.match(feedbackSurface, /useSyncExternalStore/);
  assert.match(
    feedbackController,
    /explorerFeedbackBridge\.publish/
  );
  assert.match(
    pageTransitionController,
    /function enterReadyPage\(/
  );
  assert.doesNotMatch(
    browserRuntime,
    /createBrowserFeedbackController|loading-panel|scroll-status/
  );
  assert.doesNotMatch(
    feedbackSurface,
    /dangerouslySetInnerHTML/
  );
});

test("stateless feature policy does not remain embedded in the application runtime", () => {
  const artworkPolicy = readFileSync(
    new URL("artwork/artworkJobPolicy.ts", featureRoot),
    "utf8"
  );
  const artworkPrefetchPolicy = readFileSync(
    new URL("artwork/artworkPrefetchPolicy.ts", featureRoot),
    "utf8"
  );
  const draftTree = readFileSync(new URL("countryDraft/draftTree.ts", featureRoot), "utf8");
  const sceneGeometry = readFileSync(new URL("explorer/sceneGeometry.ts", featureRoot), "utf8");
  const environmentPlanPolicy = readFileSync(
    new URL("explorer/environmentPlanPolicy.ts", featureRoot),
    "utf8"
  );

  assert.doesNotMatch(appSource, /function getArtworkFailureMessage\(/);
  assert.doesNotMatch(appSource, /function getDraftNodeAtPath\(/);
  assert.doesNotMatch(appSource, /function normalizeEnvironmentPlanBounds\(/);
  assert.doesNotMatch(appSource, /function normalizeEnvironmentPlan\(/);
  assert.match(artworkPolicy, /function getArtworkFailureMessage\(/);
  assert.match(artworkPrefetchPolicy, /function getPrefetchSceneKey\(/);
  assert.match(artworkPrefetchPolicy, /function mergePrefetchedArtwork</);
  assert.match(draftTree, /function getDraftNodeAtPath\(/);
  assert.match(sceneGeometry, /function normalizeEnvironmentPlanBounds\(/);
  assert.match(environmentPlanPolicy, /function normalizeEnvironmentPlan\(/);
});

test("CSS entry is an import manifest and React catalog styles are locally owned", () => {
  const styleEntry = readFileSync(new URL("../apps/web/src/styles.css", import.meta.url), "utf8");
  const countryDraftStyles = readFileSync(
    new URL(
      "countryDraft/countryDraftStyles.css",
      featureRoot
    ),
    "utf8"
  );
  const explorerStyles = readFileSync(
    new URL(
      "explorer/explorerStyles.css",
      featureRoot
    ),
    "utf8"
  );
  const explorerChromeStyles = readFileSync(
    new URL(
      "explorer/explorerChromeStyles.css",
      featureRoot
    ),
    "utf8"
  );
  const draftTreeStyles = readFileSync(
    new URL("countryDraft/draftTree.css", featureRoot),
    "utf8"
  );
  const draftToolStyles = readFileSync(
    new URL(
      "countryDraft/draftTreeTools.css",
      featureRoot
    ),
    "utf8"
  );
  const draftLightboxStyles = readFileSync(
    new URL(
      "countryDraft/draftPhotoLightbox.css",
      featureRoot
    ),
    "utf8"
  );
  const environmentStyles = readFileSync(
    new URL(
      "explorer/environmentLayers.css",
      featureRoot
    ),
    "utf8"
  );
  const environmentAnimations = readFileSync(
    new URL(
      "explorer/environmentLayerAnimations.css",
      featureRoot
    ),
    "utf8"
  );
  const catalogView = readFileSync(
    new URL("countryCatalog/CountryCatalogView.tsx", featureRoot),
    "utf8"
  );

  assert.ok(styleEntry.trim().split("\n").length <= 24);
  assert.match(styleEntry, /features\/countrySetup\/countrySetup\.css/);
  assert.match(styleEntry, /features\/countryDraft\/countryDraftStyles\.css/);
  assert.match(
    styleEntry,
    /features\/explorer\/explorerChromeStyles\.css/
  );
  assert.match(styleEntry, /features\/explorer\/explorerStyles\.css/);
  assert.match(countryDraftStyles, /draftTreeTools\.css/);
  assert.match(countryDraftStyles, /draftPhotoLightbox\.css/);
  assert.match(explorerChromeStyles, /explorerChrome\.css/);
  assert.match(explorerStyles, /environmentLayerAnimations\.css/);
  assert.doesNotMatch(draftTreeStyles, /\.draft-tool-menu/);
  assert.match(draftToolStyles, /\.draft-tool-menu/);
  assert.match(draftLightboxStyles, /\.draft-photo-lightbox/);
  assert.doesNotMatch(environmentStyles, /@keyframes ambient-light/);
  assert.match(environmentAnimations, /@keyframes ambient-light/);
  assert.doesNotMatch(styleEntry, /\{\s*$/m);
  assert.match(catalogView, /import styles from "\.\/CountryCatalog\.module\.css"/);
  assert.equal(
    existsSync(new URL("countryCatalog/CountryCatalog.module.css", featureRoot)),
    true
  );
});

test("workspace commands keep web and API deployment entry points separate", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  );
  const apiPackage = JSON.parse(
    readFileSync(new URL("../apps/api/package.json", import.meta.url), "utf8")
  );
  const webPackage = JSON.parse(
    readFileSync(new URL("../apps/web/package.json", import.meta.url), "utf8")
  );

  assert.equal(
    packageJson.scripts["dev:api"],
    "npm run dev --workspace @roamatlas/api"
  );
  assert.equal(packageJson.scripts["build:web"], "npm run build --workspace @roamatlas/web");
  assert.equal(apiPackage.scripts.start, "node src/main.ts");
  assert.equal(apiPackage.scripts.check, "node --check src/main.ts");
  assert.equal(webPackage.scripts.build, "vite build");
  assert.equal(packageJson.dependencies, undefined);
});

test("deployable applications communicate through libraries and HTTP only", () => {
  const webSource = readSourceTree(
    new URL("../apps/web/src/", import.meta.url)
  );
  const apiSource = readSourceTree(
    new URL("../apps/api/src/", import.meta.url)
  );
  const librarySource = readSourceTree(
    new URL("../libs/", import.meta.url)
  );

  assert.doesNotMatch(webSource, /@roamatlas\/api|apps\/api|from ["']node:/);
  assert.doesNotMatch(apiSource, /@roamatlas\/web|apps\/web|from ["']react(?:-dom)?/);
  assert.doesNotMatch(librarySource, /apps\/(?:web|api)|@roamatlas\/(?:web|api)/);
});

test("TypeScript project references encode the workspace dependency graph", () => {
  const rootConfig = JSON.parse(
    readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8")
  );
  const apiConfig = JSON.parse(
    readFileSync(new URL("../apps/api/tsconfig.json", import.meta.url), "utf8")
  );
  const webConfig = JSON.parse(
    readFileSync(new URL("../apps/web/tsconfig.json", import.meta.url), "utf8")
  );

  assert.deepEqual(rootConfig.files, []);
  assert.ok(
    rootConfig.references.some(({ path }) => path === "./apps/api")
  );
  assert.ok(
    rootConfig.references.some(({ path }) => path === "./apps/web")
  );
  assert.ok(
    apiConfig.references.some(
      ({ path }) => path === "../../libs/contracts"
    )
  );
  assert.ok(
    webConfig.references.every(
      ({ path }) => !path.includes("apps/api")
    )
  );
});

test("shared library exports are explicit and the legacy packages directory stays absent", () => {
  assert.equal(
    existsSync(
      new URL("../packages/", import.meta.url)
    ),
    false
  );
  const libraryNames = [
    "contracts",
    "data",
    "domain",
    "prompts"
  ];

  for (const libraryName of libraryNames) {
    const manifest = JSON.parse(
      readFileSync(
        new URL(`../libs/${libraryName}/package.json`, import.meta.url),
        "utf8"
      )
    );
    assert.equal(Object.hasOwn(manifest.exports, "./*"), false);
    assert.ok(Object.keys(manifest.exports).length > 0);
  }
});

test("lint configuration rejects cross-deployment imports", () => {
  const eslintSource = readFileSync(
    new URL("../eslint.config.js", import.meta.url),
    "utf8"
  );

  assert.match(eslintSource, /apps\/web\/src\/\*\*\/\*\.\{js,ts,tsx\}/);
  assert.match(eslintSource, /@roamatlas\/api/);
  assert.match(eslintSource, /node:\*/);
  assert.match(eslintSource, /apps\/api\/src\/\*\*\/\*\.\{js,ts,tsx\}/);
  assert.match(eslintSource, /@roamatlas\/web/);
  assert.match(eslintSource, /libs\/\*\*\/\*\.\{js,ts,tsx\}/);
  assert.match(eslintSource, /no-restricted-imports/);
});

test("CI runs isolated provider and browser quality gates", () => {
  const workflowSource = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8"
  );
  const dependabotSource = readFileSync(
    new URL("../.github/dependabot.yml", import.meta.url),
    "utf8"
  );

  assert.match(workflowSource, /npm run typecheck/);
  assert.match(workflowSource, /npm run lint/);
  assert.match(workflowSource, /npm run test:browser/);
  assert.match(workflowSource, /OPENAI_API_KEY: ""/);
  assert.match(workflowSource, /EXA_API_KEY: ""/);
  assert.match(
    workflowSource,
    /ROAMATLAS_IMAGE_PROVIDER_CONCURRENCY: "0"/
  );
  assert.match(dependabotSource, /package-ecosystem: npm/);
  assert.match(dependabotSource, /package-ecosystem: github-actions/);
});

test("API runtime artifacts do not write into the web deployment", () => {
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /path\.join\(runtimeCacheRoot, "country-cards"\)/);
  assert.doesNotMatch(serverSource, /path\.join\(root, "public"/);
});

test("platform concerns stay outside the backend composition entry", () => {
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /platform\/env\/loadLocalEnv/);
  assert.match(serverSource, /createRuntimeArtifactRoutes/);
  assert.doesNotMatch(serverSource, /staticAssetServer|liveReloadServer|index\.html/);
  assert.doesNotMatch(serverSource, /function loadLocalEnv\(/);
  assert.doesNotMatch(serverSource, /readJsonBody|function readJson\(/);
  assert.doesNotMatch(serverSource, /function serveStatic\(/);
  assert.doesNotMatch(serverSource, /function startLiveReloadWatcher\(/);
});

test("country and Wikipedia media ownership stays outside the server entry", () => {
  const featureRoot = new URL(
    "../apps/api/src/features/countryImages/",
    import.meta.url
  );
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const serviceSource = readFileSync(
    new URL(
      "../apps/api/src/features/countryImages/countryImageService.ts",
      import.meta.url
    ),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL(
      "../apps/api/src/features/countryImages/countryImageRepository.ts",
      import.meta.url
    ),
    "utf8"
  );
  const selectionSource = readFileSync(
    new URL(
      "../apps/api/src/features/countryImages/countryImageSelection.ts",
      import.meta.url
    ),
    "utf8"
  );
  const providerSource = readFileSync(
    new URL("wikimediaCountryImageProvider.ts", featureRoot),
    "utf8"
  );
  const typesSource = readFileSync(
    new URL("countryImageTypes.ts", featureRoot),
    "utf8"
  );
  const javascriptFiles = listSourceFiles(featureRoot).filter(
    (file) => /\.(?:js|jsx)$/.test(file)
  );

  assert.deepEqual(javascriptFiles, []);
  assert.match(serverSource, /createCountryImageService/);
  assert.match(serverSource, /createCountryImageRepository/);
  assert.match(serverSource, /wikipediaPlaceImageProvider/);
  assert.match(serviceSource, /repository\.find\(country\)/);
  assert.match(repositorySource, /async function write\(/);
  assert.match(selectionSource, /interface WikimediaPage/);
  assert.match(providerSource, /payload: unknown/);
  assert.match(providerSource, /function parseWikimediaPages/);
  assert.match(typesSource, /export type CountryImageRepository/);
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/data/countryImageTopics.js",
        import.meta.url
      )
    ),
    false
  );
  assert.match(selectionSource, /function isAllowedCountryMediaUrl/);
  assert.match(selectionSource, /function selectCountryArticleImage/);
  assert.doesNotMatch(serviceSource, /from "node:fs/);
  assert.doesNotMatch(serverSource, /function handleCountryImageRequest\(/);
  assert.doesNotMatch(serverSource, /function persistCountryCardImage\(/);
  assert.doesNotMatch(serverSource, /function resolveCountryWikipediaArticleImage\(/);
  assert.doesNotMatch(serverSource, /function resolveCountryLandmarkSearchImage\(/);
  assert.doesNotMatch(serverSource, /function resolvePlaceWikipediaImage\(/);
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/countryImages/countryImageSelection.js",
        import.meta.url
      )
    ),
    false
  );
});

test("place-image policy, persistence, and providers stay outside the server entry", () => {
  const placeImageFeatureRoot = new URL(
    "../apps/api/src/features/placeImages/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(
    placeImageFeatureRoot
  ).filter((file) => /\.(?:js|jsx)$/.test(file));
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const featureSource = readFileSync(
    new URL("../apps/api/src/features/placeImages/placeImageFeature.ts", import.meta.url),
    "utf8"
  );
  const serviceSource = readFileSync(
    new URL("../apps/api/src/features/placeImages/placeImageService.ts", import.meta.url),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL("../apps/api/src/features/placeImages/placeImageRepository.ts", import.meta.url),
    "utf8"
  );
  const providerSource = readFileSync(
    new URL("../apps/api/src/features/placeImages/exaPlaceImageProvider.ts", import.meta.url),
    "utf8"
  );
  const suggestionPolicySource = readFileSync(
    new URL(
      "../apps/api/src/features/placeImages/placeImageSuggestionPolicy.ts",
      import.meta.url
    ),
    "utf8"
  );
  const mediaPolicySource = readFileSync(
    new URL(
      "../apps/api/src/features/placeImages/placeImageMediaPolicy.ts",
      import.meta.url
    ),
    "utf8"
  );
  const historyPolicySource = readFileSync(
    new URL(
      "../apps/api/src/features/placeImages/placeImageHistoryPolicy.ts",
      import.meta.url
    ),
    "utf8"
  );
  const claimRegistrySource = readFileSync(
    new URL(
      "../apps/api/src/features/placeImages/placeImageClaimRegistry.ts",
      import.meta.url
    ),
    "utf8"
  );
  const historyServiceSource = readFileSync(
    new URL(
      "../apps/api/src/features/placeImages/placeImageHistoryService.ts",
      import.meta.url
    ),
    "utf8"
  );
  const httpFacadeSource = readFileSync(
    new URL(
      "../apps/api/src/features/placeImages/placeImageHttpHandler.ts",
      import.meta.url
    ),
    "utf8"
  );
  const mediaHttpSource = readFileSync(
    new URL(
      "../apps/api/src/features/placeImages/placeImageMediaHttpHandlers.ts",
      import.meta.url
    ),
    "utf8"
  );
  const suggestionHttpSource = readFileSync(
    new URL(
      "../apps/api/src/features/placeImages/placeImageSuggestionHttpHandler.ts",
      import.meta.url
    ),
    "utf8"
  );
  const historyHttpSource = readFileSync(
    new URL(
      "../apps/api/src/features/placeImages/placeImageHistoryHttpHandlers.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.deepEqual(javascriptFiles, []);
  assert.ok(httpFacadeSource.split("\n").length < 150);
  assert.ok(mediaHttpSource.split("\n").length < 250);
  assert.ok(suggestionHttpSource.split("\n").length < 150);
  assert.ok(historyHttpSource.split("\n").length < 150);
  assert.match(httpFacadeSource, /createPlaceImageMediaHttpHandlers/);
  assert.match(httpFacadeSource, /createPlaceImageSuggestionHttpHandler/);
  assert.match(httpFacadeSource, /createPlaceImageHistoryHttpHandlers/);
  assert.doesNotMatch(httpFacadeSource, /jsonResponse/);
  assert.match(serverSource, /createPlaceImageFeature/);
  assert.match(featureSource, /createPlaceImageService/);
  assert.match(featureSource, /createPlaceImageRepository/);
  assert.match(serviceSource, /async function resolveImage/);
  assert.match(serviceSource, /from "\.\/placeImageSuggestionPolicy\.ts"/);
  assert.match(serviceSource, /from "\.\/placeImageMediaPolicy\.ts"/);
  assert.match(serviceSource, /from "\.\/placeImageHistoryPolicy\.ts"/);
  assert.match(serviceSource, /createPlaceImageClaimRegistry/);
  assert.match(serviceSource, /createPlaceImageHistoryService/);
  assert.match(suggestionPolicySource, /normalizePlaceImagePromptSuggestions/);
  assert.match(mediaPolicySource, /hasUsablePlaceImageDimensions/);
  assert.match(mediaPolicySource, /PLACE_IMAGE_FACT_BOUNDARY/);
  assert.match(historyPolicySource, /PLACE_IMAGE_HISTORY_LIMIT = 6/);
  assert.match(claimRegistrySource, /isClaimedByAnotherPlace/);
  assert.match(historyServiceSource, /async function selectHistoryEntry/);
  assert.doesNotMatch(serviceSource, /const claimsByCountry/);
  assert.doesNotMatch(serviceSource, /async function deleteActive/);
  assert.match(
    featureSource,
    /readCachedImage:\s*repository\.readCachedImage/
  );
  assert.doesNotMatch(featureSource, /from "node:fs/);
  assert.match(repositorySource, /async function readCachedImage/);
  assert.match(repositorySource, /async function selectHistoryEntry/);
  assert.match(providerSource, /https:\/\/api\.exa\.ai\/search/);
  assert.doesNotMatch(serverSource, /function resolvePlaceImage/);
  assert.doesNotMatch(serverSource, /function archiveStoredPlaceImage/);
  assert.doesNotMatch(serverSource, /function searchExaPlaceImageQuery/);
  assert.doesNotMatch(serverSource, /contents: \{ extras: \{ imageLinks/);
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/placeImages/placeImagePolicy.js",
        import.meta.url
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/placeImages/placeImageService.js",
        import.meta.url
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/placeImages/placeImageRepository.js",
        import.meta.url
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "placeImageFeature.js",
        placeImageFeatureRoot
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "placeImageHttpHandler.js",
        placeImageFeatureRoot
      )
    ),
    false
  );
});

test("country-draft generation and persistence stay outside the server entry", () => {
  const countryDraftFeatureRoot = new URL(
    "../apps/api/src/features/countryDraft/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(
    countryDraftFeatureRoot
  ).filter((file) => /\.(?:js|jsx)$/.test(file));
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const featureSource = readFileSync(
    new URL("../apps/api/src/features/countryDraft/countryDraftFeature.ts", import.meta.url),
    "utf8"
  );
  const generatorSource = readFileSync(
    new URL("../apps/api/src/features/countryDraft/countryDraftGenerator.ts", import.meta.url),
    "utf8"
  );
  const openAIProviderSource = readFileSync(
    new URL(
      "../apps/api/src/features/countryDraft/openAICountryDraftProvider.ts",
      import.meta.url
    ),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL("../apps/api/src/features/countryDraft/countryDraftRepository.ts", import.meta.url),
    "utf8"
  );
  const groundingSource = readFileSync(
    new URL("../apps/api/src/features/countryDraft/exaCountryGroundingProvider.ts", import.meta.url),
    "utf8"
  );
  const httpFacadeSource = readFileSync(
    new URL(
      "../apps/api/src/features/countryDraft/countryDraftHttpHandler.ts",
      import.meta.url
    ),
    "utf8"
  );
  const readHttpSource = readFileSync(
    new URL(
      "../apps/api/src/features/countryDraft/countryDraftReadHttpHandler.ts",
      import.meta.url
    ),
    "utf8"
  );
  const influenceHttpSource = readFileSync(
    new URL(
      "../apps/api/src/features/countryDraft/countryDraftInfluenceHttpHandler.ts",
      import.meta.url
    ),
    "utf8"
  );
  const reviewHttpSource = readFileSync(
    new URL(
      "../apps/api/src/features/countryDraft/countryDraftReviewHttpHandlers.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.deepEqual(javascriptFiles, []);
  assert.ok(httpFacadeSource.split("\n").length < 150);
  assert.ok(readHttpSource.split("\n").length < 250);
  assert.ok(influenceHttpSource.split("\n").length < 250);
  assert.ok(reviewHttpSource.split("\n").length < 300);
  assert.match(httpFacadeSource, /createCountryDraftReadHttpHandler/);
  assert.match(httpFacadeSource, /createCountryDraftInfluenceHttpHandler/);
  assert.match(httpFacadeSource, /createCountryDraftReviewHttpHandlers/);
  assert.doesNotMatch(httpFacadeSource, /jsonResponse/);
  assert.match(serverSource, /createCountryDraftFeature/);
  assert.match(featureSource, /createCountryDraftGenerator/);
  assert.match(featureSource, /createCountryDraftRepository/);
  assert.match(featureSource, /createOpenAICountryDraftProvider/);
  assert.match(generatorSource, /buildCountryDraftPrompt/);
  assert.match(generatorSource, /draftProvider\.generate\(prompt\)/);
  assert.doesNotMatch(generatorSource, /api\.openai\.com/);
  assert.match(openAIProviderSource, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(repositorySource, /createCountryStarterMapCachePaths/);
  assert.match(groundingSource, /EXA_MIN_SNIPPET_TEXT_LENGTH/);
  assert.doesNotMatch(serverSource, /function generateCountryDraft/);
  assert.doesNotMatch(serverSource, /function readStoredCountryDraft/);
  assert.doesNotMatch(serverSource, /const EXA_GROUNDING_DOMAINS/);
  assert.equal(
    existsSync(
      new URL(
        "countryDraftFeature.js",
        countryDraftFeatureRoot
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "countryDraftHttpHandler.js",
        countryDraftFeatureRoot
      )
    ),
    false
  );
});

test("click VLM provider and PNG annotation stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const resolverSource = readFileSync(
    new URL("../apps/api/src/features/explorer/openAIClickResolver.ts", import.meta.url),
    "utf8"
  );
  const markerSource = readFileSync(
    new URL("../apps/api/src/features/explorer/clickMarkerPng.ts", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createOpenAIClickResolver/);
  assert.match(resolverSource, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(markerSource, /annotateClickPointOnPng/);
  assert.doesNotMatch(serverSource, /function resolveClickPhraseWithOpenAI/);
  assert.doesNotMatch(serverSource, /function decodeSimplePng/);
  assert.doesNotMatch(serverSource, /PNG_CRC_TABLE/);
});

test("environment provider and normalization policy stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const providerSource = readFileSync(
    new URL("../apps/api/src/features/explorer/openAIEnvironmentPlanner.ts", import.meta.url),
    "utf8"
  );
  const policySource = readFileSync(
    new URL("../apps/api/src/features/explorer/environmentPlanServerPolicy.ts", import.meta.url),
    "utf8"
  );
  const normalizationSource = readFileSync(
    new URL(
      "../apps/api/src/features/explorer/environmentPlanNormalization.ts",
      import.meta.url
    ),
    "utf8"
  );
  const queueSource = readFileSync(
    new URL("../apps/api/src/features/artwork/environmentPlanQueue.ts", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createOpenAIEnvironmentPlanner/);
  assert.match(serverSource, /createEnvironmentPlanServerPolicy/);
  assert.match(providerSource, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(
    normalizationSource,
    /function normalizeEnvironmentTarget/
  );
  assert.doesNotMatch(
    policySource,
    /function normalizeEnvironmentTarget/
  );
  assert.match(queueSource, /async function ensurePlan/);
  assert.match(queueSource, /function scheduleProcessing/);
  assert.doesNotMatch(serverSource, /function normalizeEnvironmentTarget/);
  assert.doesNotMatch(serverSource, /function createEnvironmentFallbackPlan/);
  assert.doesNotMatch(serverSource, /function createServerRequestSignal/);
  assert.doesNotMatch(serverSource, /function processNextEnvironmentPlan/);
  assert.doesNotMatch(serverSource, /function ensureEnvironmentPlanForPage/);
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/explorer/environmentPlanServerPolicy.ts",
        import.meta.url
      )
    ),
    true
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/explorer/environmentPlanServerPolicy.js",
        import.meta.url
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/explorer/environmentPlanNormalization.ts",
        import.meta.url
      )
    ),
    true
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/explorer/environmentPlanServerTypes.ts",
        import.meta.url
      )
    ),
    true
  );
});

test("configured image provider stays outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const policySource = readFileSync(
    new URL(
      "../apps/api/src/domain/imageGenerationPolicy.ts",
      import.meta.url
    ),
    "utf8"
  );
  const transportSource = readFileSync(
    new URL(
      "../apps/api/src/platform/openai/openAiImageProvider.ts",
      import.meta.url
    ),
    "utf8"
  );
  const providerSource = readFileSync(
    new URL("../apps/api/src/features/artwork/configuredImageProvider.ts", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createConfiguredImageProvider/);
  assert.match(providerSource, /generateTileImageWithOpenAI/);
  assert.match(providerSource, /normalizeImageModel/);
  assert.match(transportSource, /https:\/\/api\.openai\.com\/v1\/images\/generations/);
  assert.match(transportSource, /readStreamingImageResponse/);
  assert.match(policySource, /normalizeImageQuality/);
  assert.match(policySource, /DEFAULT_ROAMATLAS_IMAGE_SYSTEM_PROMPT/);
  assert.doesNotMatch(policySource, /\bfetch\(/);
  assert.doesNotMatch(providerSource, /\bfetch\(/);
  assert.doesNotMatch(serverSource, /function generateConfiguredImage/);
  assert.doesNotMatch(serverSource, /generateTileImageWithOpenAI/);
  assert.equal(
    existsSync(
      new URL("../apps/api/src/domain/imageProvider.js", import.meta.url)
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/artwork/configuredImageProvider.js",
        import.meta.url
      )
    ),
    false
  );
});

test("semantic click policy and persistence stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const featureSource = readFileSync(
    new URL("../apps/api/src/features/explorer/clickResolutionFeature.ts", import.meta.url),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL("../apps/api/src/features/explorer/pageUnderstandingRepository.ts", import.meta.url),
    "utf8"
  );
  const policySource = readFileSync(
    new URL("../apps/api/src/features/explorer/semanticRegionPolicy.ts", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createClickResolutionFeature/);
  assert.match(featureSource, /createPageUnderstandingRepository/);
  assert.match(repositorySource, /understandingPath/);
  assert.match(policySource, /selectSemanticRegionForPoint/);
  assert.doesNotMatch(serverSource, /function appendSemanticRegionFromResult/);
  assert.doesNotMatch(serverSource, /function readPageUnderstanding/);
  assert.doesNotMatch(serverSource, /function matchVlmPhraseForCurrentPage/);
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/explorer/semanticRegionPolicy.ts",
        import.meta.url
      )
    ),
    true
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/explorer/semanticRegionPolicy.js",
        import.meta.url
      )
    ),
    false
  );
});

test("artwork job files and terminal-state indexing stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL("../apps/api/src/features/artwork/artworkJobRepository.ts", import.meta.url),
    "utf8"
  );

  assert.match(serverSource, /createArtworkJobRepository/);
  assert.match(repositorySource, /async function writeJob/);
  assert.match(repositorySource, /async function writeBinaryArtifact/);
  assert.match(repositorySource, /async function writeJsonArtifact/);
  assert.match(repositorySource, /async function listJobFiles/);
  assert.match(repositorySource, /const terminalJobs = new Set/);
  assert.doesNotMatch(serverSource, /async function writeCodexImageJob/);
  assert.doesNotMatch(serverSource, /async function listRuntimeImageJobFiles/);
  assert.doesNotMatch(serverSource, /terminalImageJobs/);
});

test("artwork job eligibility and cache identity stay outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const policySource = readFileSync(
    new URL(
      "../apps/api/src/features/artwork/artworkJobProcessingPolicy.ts",
      import.meta.url
    ),
    "utf8"
  );
  const queuePolicySource = readFileSync(
    new URL(
      "../apps/api/src/features/artwork/artworkQueuePolicy.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(serverSource, /createArtworkJobPolicy/);
  assert.match(policySource, /createImageVariantKey/);
  assert.match(policySource, /function shouldProcessJob/);
  assert.match(policySource, /function isTransientGenerationError/);
  assert.match(policySource, /from "\.\/artworkQueuePolicy\.ts"/);
  assert.match(queuePolicySource, /function selectImageJobsForProcessing/);
  assert.match(queuePolicySource, /interactiveReservedSlots/);
  assert.doesNotMatch(serverSource, /function createAssetVersionForPage/);
  assert.doesNotMatch(serverSource, /function shouldProcessCodexJob/);
  assert.doesNotMatch(serverSource, /function isTransientImageGenerationError/);
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/artwork/artworkJobProcessingPolicy.ts",
        import.meta.url
      )
    ),
    true
  );
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/artwork/artworkJobProcessingPolicy.js",
        import.meta.url
      )
    ),
    false
  );
  assert.equal(
    existsSync(
      new URL("../apps/api/src/domain/imageJobQueue.js", import.meta.url)
    ),
    false
  );
});

test("artwork job lifecycle stays outside the server composition entry", () => {
  const artworkRoot = new URL(
    "../apps/api/src/features/artwork/",
    import.meta.url
  );
  const javascriptFiles = listSourceFiles(
    artworkRoot
  ).filter((file) => /\.(?:js|jsx)$/.test(file));
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const serviceSource = readFileSync(
    new URL("../apps/api/src/features/artwork/artworkJobService.ts", import.meta.url),
    "utf8"
  );
  const creationSource = readFileSync(
    new URL(
      "../apps/api/src/features/artwork/artworkJobCreationService.ts",
      import.meta.url
    ),
    "utf8"
  );
  const runtimeContextSource = readFileSync(
    new URL(
      "../apps/api/src/features/artwork/runtimeArtworkContext.ts",
      import.meta.url
    ),
    "utf8"
  );
  const creationGuardSource = readFileSync(
    new URL(
      "../apps/api/src/features/artwork/artworkJobCreationGuard.ts",
      import.meta.url
    ),
    "utf8"
  );
  const reuseServiceSource = readFileSync(
    new URL(
      "../apps/api/src/features/artwork/artworkJobReuseService.ts",
      import.meta.url
    ),
    "utf8"
  );
  const workerSource = readFileSync(
    new URL(
      "../apps/api/src/features/artwork/artworkJobWorker.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.deepEqual(javascriptFiles, []);
  assert.match(serverSource, /createArtworkJobService/);
  assert.match(serviceSource, /createArtworkJobCreationService/);
  assert.match(creationSource, /async function createImageJob/);
  assert.match(creationSource, /createArtworkJobCreationGuard/);
  assert.match(creationSource, /createArtworkJobReuseService/);
  assert.match(creationGuardSource, /async function waitForFlushes/);
  assert.match(creationGuardSource, /Promise\.allSettled/);
  assert.match(reuseServiceSource, /async function reuseReadyImage/);
  assert.match(reuseServiceSource, /async function reuseMetadataImage/);
  assert.match(reuseServiceSource, /async function promoteExistingJob/);
  assert.doesNotMatch(creationSource, /async function reuseReadyImage/);
  assert.doesNotMatch(creationSource, /async function reuseMetadataImage/);
  assert.doesNotMatch(creationSource, /async function promoteExistingJob/);
  assert.doesNotMatch(creationSource, /activeCountryJobCreations/);
  assert.match(serviceSource, /createArtworkJobWorker/);
  assert.match(workerSource, /async function processJob/);
  assert.match(workerSource, /function cancelForCountry/);
  assert.match(workerSource, /jobRepository\.writeBinaryArtifact/);
  assert.match(workerSource, /jobRepository\.writeJsonArtifact/);
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/artwork/artworkJobWorker.js",
        import.meta.url
      )
    ),
    false
  );
  assert.doesNotMatch(serviceSource, /async function processJob/);
  assert.doesNotMatch(serviceSource, /function cancelForCountry/);
  assert.doesNotMatch(serviceSource, /jobRepository\.writeBinaryArtifact/);
  assert.match(runtimeContextSource, /function getCountrySlugForPage/);
  assert.match(runtimeContextSource, /function resolveAssetVersionForPage/);
  assert.doesNotMatch(serviceSource, /from "node:fs/);
  assert.doesNotMatch(creationSource, /from "node:fs/);
  assert.doesNotMatch(serverSource, /function processCodexImageJob/);
  assert.doesNotMatch(serverSource, /function createCodexImageJobUnlocked/);
  assert.doesNotMatch(serverSource, /const processingJobs = new Map/);
  assert.equal(
    existsSync(
      new URL(
        "../apps/api/src/features/artwork/runtimeArtworkContext.js",
        import.meta.url
      )
    ),
    false
  );
});

test("country runtime cache coordination stays outside the server entry", () => {
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const domainSource = readFileSync(
    new URL(
      "../apps/api/src/domain/runtimeCache.ts",
      import.meta.url
    ),
    "utf8"
  );
  const serviceSource = readFileSync(
    new URL(
      "../apps/api/src/features/runtimeCache/runtimeCacheService.ts",
      import.meta.url
    ),
    "utf8"
  );
  const repositorySource = readFileSync(
    new URL(
      "../apps/api/src/features/runtimeCache/runtimeCacheRepository.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(serverSource, /createRuntimeCacheService/);
  assert.match(serverSource, /createRuntimeCacheRepository/);
  assert.match(domainSource, /export type RuntimeImageFormat/);
  assert.match(domainSource, /ImageVariantKeyInput/);
  assert.match(serviceSource, /RuntimeCacheServiceDependencies/);
  assert.match(repositorySource, /export type RuntimeCacheRepository/);
  assert.match(serviceSource, /async function flushVisualCache/);
  assert.match(serviceSource, /async function flushRuntimeCache/);
  assert.match(serviceSource, /function isPathBeingFlushed/);
  assert.match(serviceSource, /repository\.removeFolders/);
  assert.doesNotMatch(serviceSource, /from "node:fs/);
  assert.match(repositorySource, /async function removeCountryRoot/);
  assert.doesNotMatch(serverSource, /function flushCountryGeneratedVisualCache/);
  assert.doesNotMatch(serverSource, /const flushingCountryCacheRoots/);
  for (const legacyPath of [
    "../apps/api/src/domain/runtimeCache.js",
    "../apps/api/src/features/runtimeCache/runtimeArtifactHttpHandler.js",
    "../apps/api/src/features/runtimeCache/runtimeCacheHttpHandler.js",
    "../apps/api/src/features/runtimeCache/runtimeCacheRepository.js",
    "../apps/api/src/features/runtimeCache/runtimeCacheService.js"
  ]) {
    assert.equal(
      existsSync(new URL(legacyPath, import.meta.url)),
      false
    );
  }
});

test("typed Hono API composes feature-owned routes outside the dev bootstrap", () => {
  const serverSource = readFileSync(
    new URL("../apps/api/src/main.ts", import.meta.url),
    "utf8"
  );
  const apiSource = readFileSync(
    new URL("../apps/api/src/server/createRoamAtlasApi.ts", import.meta.url),
    "utf8"
  );
  const runtimeCacheHttpSource = readFileSync(
    new URL(
      "../apps/api/src/features/runtimeCache/runtimeCacheHttpHandler.ts",
      import.meta.url
    ),
    "utf8"
  );
  const honoRoutesSource = readFileSync(
    new URL(
      "../apps/api/src/platform/http/honoRoutes.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(serverSource, /createRoamAtlasApi/);
  assert.match(serverSource, /serve\(\{/);
  assert.match(serverSource, /createRuntimeCacheRoutes/);
  assert.match(apiSource, /new Hono\(\)/);
  assert.match(apiSource, /for \(const registerRoutes of routeRegistrars\)/);
  assert.doesNotMatch(apiSource, /RESPONSE_ALREADY_SENT|IncomingMessage|ServerResponse/);
  assert.doesNotMatch(apiSource, /"\/api\//);
  assert.match(honoRoutesSource, /registerHonoRoute/);
  assert.match(
    runtimeCacheHttpSource,
    /RuntimeCacheHttpDependencies/
  );
  assert.doesNotMatch(honoRoutesSource, /RESPONSE_ALREADY_SENT|IncomingMessage|ServerResponse/);
  assert.match(runtimeCacheHttpSource, /"\/api\/runtime-cache\/flush"/);
  assert.doesNotMatch(serverSource, /createServer\(async/);
  assert.doesNotMatch(serverSource, /request\.method ===/);
  assert.doesNotMatch(serverSource, /"\/api\//);
});

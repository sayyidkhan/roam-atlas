import { readFileSync } from "node:fs";

const countryDraftTreeModules = [
  "../../apps/web/src/features/countryDraft/CountryDraftTree.tsx",
  "../../apps/web/src/features/countryDraft/CountryDraftRegionItem.tsx",
  "../../apps/web/src/features/countryDraft/CountryDraftThemeItem.tsx",
  "../../apps/web/src/features/countryDraft/CountryDraftChildNodes.tsx",
  "../../apps/web/src/features/countryDraft/CountryDraftTreeControls.tsx",
  "../../apps/web/src/features/countryDraft/useCountryDraftDrag.ts",
  "../../apps/web/src/features/countryDraft/countryDraftTreePolicy.ts"
];

const runtimeModules = [
  "../../apps/web/src/app/applicationRuntime.ts",
  "../../apps/web/src/app/applicationRuntimeComposition.ts",
  "../../apps/web/src/app/applicationRuntimeClients.ts",
  "../../apps/web/src/app/applicationRuntimeConfig.ts",
  "../../apps/web/src/app/queryClient.ts",
  "../../apps/web/src/app/applicationRuntimeLifecycle.ts",
  "../../apps/web/src/app/applicationLifecycleBridge.ts",
  "../../apps/web/src/app/applicationLifecycleController.ts",
  "../../apps/web/src/app/applicationRouteController.ts",
  "../../apps/web/src/app/applicationGeneratedStateController.ts",
  "../../apps/web/src/app/applicationNavigationController.ts",
  "../../apps/web/src/app/applicationViewController.ts",
  "../../apps/web/src/app/applicationViewBridge.ts",
  "../../apps/web/src/features/countryDraft/countryDraftController.ts",
  "../../apps/web/src/features/countryDraft/countryDraftLifecycleController.ts",
  "../../apps/web/src/features/countryDraft/countryDraftMutationController.ts",
  "../../apps/web/src/features/countryDraft/countryDraftInfluenceController.ts",
  "../../apps/web/src/features/countryDraft/countryDraftReviewController.ts",
  "../../apps/web/src/features/countryDraft/countryDraftChatPolicy.ts",
  "../../apps/web/src/features/countryDraft/countryDraftViewController.ts",
  ...countryDraftTreeModules,
  "../../apps/web/src/features/countrySetup/countryExperienceController.ts",
  "../../apps/web/src/features/countrySetup/countrySetupRuntimeComposition.ts",
  "../../apps/web/src/features/countrySetup/countryExperiencePolicy.ts",
  "../../apps/web/src/features/experience/imageQualityPreference.ts",
  "../../apps/web/src/features/notifications/appToastController.ts",
  "../../apps/web/src/features/notifications/appToastBridge.ts",
  "../../apps/web/src/features/notifications/AppToast.tsx",
  "../../apps/web/src/features/runtimeCache/countryRuntimeCacheController.ts",
  "../../apps/web/src/features/placeImages/draftPhotoLightboxController.ts",
  "../../apps/web/src/features/placeImages/draftPhotoLightboxBridge.ts",
  "../../apps/web/src/features/placeImages/DraftPhotoLightbox.tsx",
  "../../apps/web/src/features/placeImages/DraftPhotoFeedbackForm.tsx",
  "../../apps/web/src/features/placeImages/placeImageController.ts",
  "../../apps/web/src/features/placeImages/placeImageSessionStore.ts",
  "../../apps/web/src/features/explorer/explorerController.ts",
  "../../apps/web/src/features/explorer/explorerRuntimeComposition.ts",
  "../../apps/web/src/features/explorer/explorerPresentationComposition.ts",
  "../../apps/web/src/features/explorer/explorerPublisherRegistry.ts",
  "../../apps/web/src/features/explorer/explorerSceneOrchestrator.ts",
  "../../apps/web/src/features/explorer/explorerEnvironmentPagePolicy.ts",
  "../../apps/web/src/features/explorer/explorerImagePreloader.ts",
  "../../apps/web/src/features/explorer/explorerSceneController.ts",
  "../../apps/web/src/features/explorer/explorerScenePolicy.ts",
  "../../apps/web/src/features/explorer/ExplorerSceneStage.tsx",
  "../../apps/web/src/features/explorer/ExplorerEnvironmentLayers.tsx",
  "../../apps/web/src/features/explorer/explorerEnvironmentLayerPolicy.ts",
  "../../apps/web/src/features/explorer/explorerPageClickAdapter.ts",
  "../../apps/web/src/features/explorer/explorerNavigationRequestController.ts",
  "../../apps/web/src/features/explorer/explorerNavigationPagePolicy.ts",
  "../../apps/web/src/features/explorer/explorerNavigationController.ts",
  "../../apps/web/src/features/explorer/explorerPageNavigationController.ts",
  "../../apps/web/src/features/explorer/explorerNavigationTypes.ts",
  "../../apps/web/src/features/explorer/explorerEnvironmentController.ts",
  "../../apps/web/src/features/explorer/explorerEnvironmentPromotionController.ts",
  "../../apps/web/src/features/explorer/explorerEnvironmentTypes.ts",
  "../../apps/web/src/features/explorer/explorerDestinationController.ts",
  "../../apps/web/src/features/explorer/explorerDestinationPolicy.ts",
  "../../apps/web/src/features/explorer/explorerFeedbackController.ts",
  "../../apps/web/src/features/explorer/explorerPageTransitionController.ts",
  "../../apps/web/src/features/explorer/explorerPageTransitionBridge.ts",
  "../../apps/web/src/features/explorer/ExplorerNavigationFeedback.tsx",
  "../../apps/web/src/features/artwork/artworkController.ts",
  "../../apps/web/src/features/artwork/artworkRuntimeComposition.ts",
  "../../apps/web/src/features/artwork/artworkInteractiveController.ts",
  "../../apps/web/src/features/artwork/artworkRequestController.ts",
  "../../apps/web/src/features/artwork/artworkPendingController.ts",
  "../../apps/web/src/features/artwork/artworkJobQueryPolling.ts",
  "../../apps/web/src/features/artwork/artworkPollingController.ts",
  "../../apps/web/src/features/artwork/artworkPollStateController.ts",
  "../../apps/web/src/features/artwork/artworkLifecycleController.ts",
  "../../apps/web/src/features/artwork/artworkCompletionController.ts",
  "../../apps/web/src/features/artwork/artworkPartialController.ts",
  "../../apps/web/src/features/artwork/artworkPrefetchController.ts",
  "../../apps/web/src/features/artwork/artworkPrefetchJobController.ts",
  "../../apps/web/src/features/artwork/artworkPrefetchPollingController.ts",
  "../../apps/web/src/features/artwork/artworkPrefetchCache.ts",
  "../../apps/web/src/features/artwork/artworkPrefetchTypes.ts",
  "../../apps/web/src/app/browserRuntime.ts"
];

export function readFrontendRuntimeSource() {
  return runtimeModules
    .map((modulePath) => readFileSync(new URL(modulePath, import.meta.url), "utf8"))
    .join("\n");
}

export function readCountryDraftTreeSource() {
  return countryDraftTreeModules
    .map((modulePath) =>
      readFileSync(new URL(modulePath, import.meta.url), "utf8")
    )
    .join("\n");
}

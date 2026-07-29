export type RuntimeCacheScope = "all" | "visuals";

export type CountryRuntimeCacheState = {
  message: string;
  scope: RuntimeCacheScope;
  status: "loading" | "ready" | "failed";
};

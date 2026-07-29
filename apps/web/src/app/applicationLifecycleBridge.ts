import type { createApplicationLifecycleController } from "./applicationLifecycleController";
import type {
  CountryShellNavigationOptions,
  CountrySummary,
  NavigationOptions
} from "./applicationRuntimeTypes";
import type { RuntimePack } from "./browserRuntime";

type ApplicationLifecycle = ReturnType<
  typeof createApplicationLifecycleController
>;

export function createApplicationLifecycleBridge() {
  let lifecycle: ApplicationLifecycle | null = null;

  function requireLifecycle(): ApplicationLifecycle {
    if (!lifecycle) {
      throw new Error(
        "Application lifecycle has not been composed yet."
      );
    }
    return lifecycle;
  }

  return {
    attach(nextLifecycle: ApplicationLifecycle) {
      lifecycle = nextLifecycle;
      return nextLifecycle;
    },
    clearCountryGeneratedState(countrySlug: string): void {
      requireLifecycle().clearCountryGeneratedState(countrySlug);
    },
    enterCountryLanding(options?: NavigationOptions): void {
      requireLifecycle().enterCountryLanding(options);
    },
    enterCountryShell(
      country: CountrySummary,
      options?: CountryShellNavigationOptions
    ): void {
      requireLifecycle().enterCountryShell(country, options);
    },
    enterMappedCountry(
      pack: RuntimePack | null,
      options?: NavigationOptions
    ): void {
      requireLifecycle().enterMappedCountry(pack, options);
    },
    showBootstrapError(error: unknown): void {
      requireLifecycle().showBootstrapError(error);
    }
  };
}

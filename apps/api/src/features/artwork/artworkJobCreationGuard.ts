type CountryFlushRun = PromiseLike<unknown> | null | undefined;

interface ArtworkJobCreationGuardDependencies {
  getCountryCacheFlushRun: (countrySlug: string) => CountryFlushRun;
}

export interface ArtworkJobCreationGuard {
  begin: (countrySlug: string) => Promise<() => void>;
  waitForCountry: (countrySlug: string) => Promise<PromiseSettledResult<void>[]>;
}

export function createArtworkJobCreationGuard({
  getCountryCacheFlushRun
}: ArtworkJobCreationGuardDependencies): ArtworkJobCreationGuard {
  const activeCountryCreations = new Map<string, Set<Promise<void>>>();

  async function begin(countrySlug: string): Promise<() => void> {
    await waitForFlushes(countrySlug);

    let resolveDone: () => void = () => {};
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    const active = activeCountryCreations.get(countrySlug) ?? new Set();
    active.add(done);
    activeCountryCreations.set(countrySlug, active);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      active.delete(done);
      if (active.size === 0) activeCountryCreations.delete(countrySlug);
      resolveDone();
    };
  }

  function waitForCountry(
    countrySlug: string
  ): Promise<PromiseSettledResult<void>[]> {
    return Promise.allSettled([
      ...(activeCountryCreations.get(countrySlug) ?? [])
    ]);
  }

  async function waitForFlushes(countrySlug: string): Promise<void> {
    let flushRun = getCountryCacheFlushRun(countrySlug);
    while (flushRun) {
      await flushRun;
      flushRun = getCountryCacheFlushRun(countrySlug);
    }
  }

  return { begin, waitForCountry };
}

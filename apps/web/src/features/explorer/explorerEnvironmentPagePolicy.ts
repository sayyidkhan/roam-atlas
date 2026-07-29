import type {
  ExplorerEnvironmentPage
} from "./explorerEnvironmentTypes";

export function getPageEnvironmentUrl(
  page: ExplorerEnvironmentPage | null | undefined
): string | null {
  const status =
    page?.environmentStatus ??
    page?.generated?.environmentStatus;
  if (status === "deferred") return null;

  return (
    page?.environmentUrl ??
    page?.generated?.environmentUrl ??
    null
  );
}

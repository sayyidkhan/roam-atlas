export type ApplicationElements = ReturnType<
  typeof createApplicationElements
>;

export function createApplicationElements(root: ParentNode = document) {
  return {
    countryShell: requireElement<HTMLElement>(root, "#country-shell"),
    runtimeNotice: requireElement<HTMLElement>(
      root,
      "#runtime-notice"
    ),
    viewport: requireElement<HTMLElement>(root, "#scroll-viewport"),
    stage: requireElement<HTMLElement>(root, "#scroll-stage")
  };
}

function requireElement<T extends HTMLElement>(
  root: ParentNode,
  selector: string
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(
      `RoamAtlas application shell is missing ${selector}.`
    );
  }
  return element;
}

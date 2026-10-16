/** Folded atlas with a route running across its pages. */
export function AtlasMark() {
  return <svg width="1em" height="1em" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <path d="m3 7 8-3 10 4 8-3v20l-8 3-10-4-8 3V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M11 4v7m0 9v4M21 8v4m0 9v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
    <path d="M7 19c3-7 6-7 9-3s5 3 9-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="25" cy="14" r="2.5" fill="currentColor" />
  </svg>;
}

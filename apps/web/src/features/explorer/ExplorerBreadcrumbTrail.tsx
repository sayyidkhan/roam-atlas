import type {
  ExplorerBreadcrumbItem
} from "./explorerBreadcrumbPolicy";

type ExplorerBreadcrumbTrailProps = {
  currentLabel: string;
  items: ExplorerBreadcrumbItem[];
  onSelect: (nodeId: string) => void;
};

export function ExplorerBreadcrumbTrail({
  currentLabel,
  items,
  onSelect
}: ExplorerBreadcrumbTrailProps) {
  return (
    <div className="scene-hud-location">
      <span className="scene-hud-brand">RoamAtlas</span>
      <nav
        className="scene-hud-breadcrumb"
        aria-label="Explorer breadcrumb"
      >
        <ol>
          {items.map((item) => (
            <li
              className="scene-hud-breadcrumb-ancestor"
              key={item.nodeId}
            >
              <button
                type="button"
                aria-label={`Go to ${item.label}`}
                title={item.label}
                onClick={() => onSelect(item.nodeId)}
              >
                {item.label}
              </button>
              <BreadcrumbSeparator />
            </li>
          ))}
          <li
            className="scene-hud-breadcrumb-current"
            aria-current="page"
          >
            <h1 title={currentLabel}>{currentLabel}</h1>
          </li>
        </ol>
      </nav>
    </div>
  );
}

function BreadcrumbSeparator() {
  return (
    <span
      className="scene-hud-breadcrumb-separator"
      aria-hidden="true"
    >
      ›
    </span>
  );
}

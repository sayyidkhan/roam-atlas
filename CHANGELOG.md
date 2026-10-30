# Changelog

Notable changes to RoamAtlas, newest first. Work in progress belongs under
**Unreleased** until a release is prepared. Versions use `MAJOR.MINOR.PATCH`;
release dates use Singapore time. See [Releasing](docs/RELEASING.md).

## [Unreleased]

## [2.1.0] - 2026-10-30

### Added

- A maintained changelog and release workflow for keeping package versions,
  release notes, and the app's displayed version aligned.

### Changed

- Upgraded country drafts, edits, encyclopedia notes, photo suggestions, and
  image-click understanding to GPT-6.1 Terra; scene target and ambient-layer
  planning to GPT-6.1 Sol; and atlas illustrations to the pinned GPT Image 2.5
  Sunburst snapshot. Added usage cost estimates for the new text/vision models.
- Simplified the country setup header into one desktop toolbar with a quiet
  Back arrow, icon-only Reset action, and prominent Open map action.
- Grouped illustration detail and lock help inside a compact control. The lock
  explanation is available on hover and keyboard focus.
- Positioned the travel-information link beside the country name and code when
  space permits, with wrapping on narrower screens.
- Arranged country identity above settings and actions on phones to preserve
  readable controls without horizontal scrolling.
- Synchronized the app, all workspace packages, and lockfile at `2.1.0`;
  homepage and footer version labels use the shared app version.

### Fixed

- Removed an unsupported sampling parameter from photo suggestion requests for
  compatibility with GPT-6.1 reasoning models.

## [2.0.0] - 2026-10-28

Versioning baseline recorded from commit `2544d61`. This entry records the
existing version in Git; it does not imply a production deployment or Git tag.
Earlier changes are available in Git history.

### Added

- App version displayed in the homepage brand and country setup footer, sourced
  from the root package manifest.

### Changed

- Synchronized the root package, all six workspace packages, and lockfile at
  version `2.0.0`.

[Unreleased]: https://github.com/sayyidkhan/roam-atlas/compare/v2.1.0...dev-v1.5
[2.1.0]: https://github.com/sayyidkhan/roam-atlas/compare/2544d61...v2.1.0
[2.0.0]: https://github.com/sayyidkhan/roam-atlas/commit/2544d61

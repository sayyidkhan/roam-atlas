# Changelog and releases

## Source of truth

- [CHANGELOG.md](../CHANGELOG.md) records notable changes and release history.
- The root `package.json` owns the app version. All six workspace manifests and
  their entries in `package-lock.json` use the same version.
- Vite injects that root version into the UI at startup/build time. Restart the
  dev server or rebuild the frontend after a version change.
- A commit saves progress. A release groups changes under a version. A deployment
  puts a build into an environment; recording a release does not deploy it.

## During development

Update **Unreleased** in the same change as any user-visible feature, fix, or
behavior change. Use `Added`, `Changed`, `Fixed`, `Removed`, or `Security` as
needed; omit empty sections. Describe the result for users, combining follow-up
edits into a single entry where appropriate. Do not record every commit.

Keep the version unchanged during ordinary development. Docs-only changes,
tests, and internal refactors need an entry only if they materially affect
operating or maintaining the app. The initial changelog starts at the existing
`2.0.0` baseline; do not invent older releases or deployment dates.

## Choose a version

| Change | Bump | Example from 2.0.0 |
| --- | --- | --- |
| Bug fixes or nonbreaking layout/usability refinements | Patch | 2.0.1 |
| New functionality that preserves existing behavior and data compatibility | Minor | 2.1.0 |
| Breaking API, saved-data, or supported workflow changes | Major | 3.0.0 |

Choose the highest required bump among the Unreleased changes. A branch name
such as `dev-v1.5` does not determine the app version. Header-only refinements
are patch candidates; an upgrade to the app's model capabilities can justify a
minor release, as in `2.1.0`.

## Prepare a release

1. Review Unreleased against Git history and choose the version.
2. From the repository root, bump the root, workspaces, and lockfile together:

   ```bash
   npm version patch --workspaces --include-workspace-root --no-git-tag-version
   ```

   Use `minor` or `major` instead of `patch` when appropriate. This command
   updates files locally; it does not create a commit or tag. Inspect the diff
   to confirm every package has the same version and dependencies did not drift.
3. Move the Unreleased entries under `## [X.Y.Z] - YYYY-MM-DD`, using the release
   preparation date in Asia/Singapore. Leave an empty `## [Unreleased]` heading
   above it for future work. Update the comparison links at the bottom: point
   Unreleased from the new release tag to the development branch, and link the
   new version to its comparison with the previous release. For the first
   release after this baseline, compare from commit `2544d61`.
4. Run the [required checks](TESTING.md#required-gates) with provider credentials
   absent, then build and verify the displayed version. Keep browser tests on
   local fixtures and mocked APIs.
5. Commit the changelog, manifests, and lockfile together, for example
   `Release 2.0.1`.
6. When publishing the release is requested, create an annotated `vX.Y.Z` tag on
   that release commit and push the branch and that specific tag. Never move an
   existing release tag or create a tag for the historical baseline retroactively.

Keep Git tags, changelog headings, package versions, and the displayed app
version consistent. Deployment follows the separate [deployment guide](DEPLOYMENT.md).

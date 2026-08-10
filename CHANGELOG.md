# Changelog

All notable changes to Task Planner are documented here. The project follows [Semantic Versioning](https://semver.org/) and keeps breaking removals for explicitly planned major releases.

## [Unreleased]

### Fixed

- Preserved escaped Dataview attributes and `@` shortcuts as literal task text during metadata parsing and edits.
- Preserved enabled `@` shortcuts inside bare email addresses with dotted domains during metadata parsing and edits.
- Preserved angle-bracket links and HTML containing field-like text during metadata parsing and edits.
- Preserved escaped literal hashtags when reading or removing task tags.
- Preserved URL fragments that resemble hashtags when reading or removing task tags.
- Kept the task index accurate when notes move into or out of ignored folders, including during the initial vault scan, without hiding similarly named sibling folders.

## [2.0.6] - 2026-08-01

### Added

- Added a real Obsidian product screenshot above the fold and a social-preview crop based on the same synthetic planning scene.

### Changed

- Kept planning controls pinned to the right on wide boards while allowing search to consume the available row on narrow boards.
- Reworked the README and release metadata around the concrete workflow of planning Markdown tasks that remain in their source notes.
- Updated contributor guidance for the Node.js 22 development baseline and real-Obsidian test command.

### Security

- Updated every `brace-expansion` lockfile entry to its fixed compatible backport and removed the temporary development-audit exception ([#124](https://github.com/selfish/obsidian-task-planner/issues/124)).

## [2.0.5] - 2026-08-01

### Fixed

- Removed a redundant V8-only stack-trace call that triggered the final community scanner finding.

## [2.0.4] - 2026-08-01

### Fixed

- Validated persisted settings recursively, isolated loaded settings from mutable defaults, and blocked downgrade writes for future settings schemas.
- Replaced unsafe DOM and runtime patterns identified by the Obsidian community scanner while preserving current and minimum-version settings behavior.

## [2.0.3] - 2026-08-01

### Changed

- Raised the minimum supported Obsidian version to public 1.8.7, where Task Planner's existing vault-local settings APIs are public ([#136](https://github.com/selfish/obsidian-task-planner/issues/136)).

### Fixed

- Reused and unmounted the planning view's React root so repeated refreshes do not leak subscriptions or document listeners.
- Preserved date-like values such as `tomorrow` in unrelated Dataview fields during attribute completion.
- Preserved concurrent edits when adding onboarding examples to an existing note.
- Preserved dollar-sign sequences entered through Quick Add instead of interpreting them as JavaScript replacement tokens.
- Restored the published Obsidian compatibility floor for each existing release so older app versions can still install the newest compatible Task Planner build.
- Preserved `{date}`, `{time}`, and `{datetime}` text entered through Quick Add instead of treating it as part of the configured task template.

## [2.0.2] - 2026-07-30

### Added

- Permanent real-Obsidian CI on the current runtime and declared supported floor, using a synthetic CRLF vault and SHA-256-verified runtime archives ([#122](https://github.com/selfish/obsidian-task-planner/issues/122)).
- Flat scalar parenthesized Dataview field input with targeted edits that resolve fields case-insensitively in source order, update only the last effective duplicate while preserving earlier fields and existing key casing, and leave malformed or nested forms, Tasks emoji text, unknown metadata, inline code, and wiki links untouched ([#107](https://github.com/selfish/obsidian-task-planner/issues/107)).
- Tasks and Dataview metadata compatibility characterization covering canonical fields, legacy Task Planner aliases, unsupported forms, and current lossy rewrite behavior ([#108](https://github.com/selfish/obsidian-task-planner/pull/108)).
- Private-first vulnerability reporting guidance and a documented security support policy.
- A CI dependency audit that fails on high or critical known vulnerabilities, except for the documented, expiring development-only `brace-expansion` exception tracked in [#124](https://github.com/selfish/obsidian-task-planner/issues/124); the production dependency audit remains clean.

### Changed

- Raised the minimum supported Obsidian version to the public 1.4.10 release, which provides the public input-suggest API used by Task Planner ([#123](https://github.com/selfish/obsidian-task-planner/issues/123)).
- Replaced the direct `eslint-plugin-react` development dependency with the maintained `@eslint-react/eslint-plugin` alternative while preserving the existing lint baseline.
- Updated vulnerable development and build dependencies without changing generated plugin assets.
- Pinned third-party GitHub Actions to immutable commit SHAs and migrated Codecov test-result uploads to the supported unified action.

### Fixed

- Made task, follow-up, and Quick Add writes atomic so stale task positions cannot overwrite concurrent vault edits ([#120](https://github.com/selfish/obsidian-task-planner/issues/120)).

## Historical releases

Detailed notes and source comparisons for releases before this changelog are available on the [GitHub Releases](https://github.com/selfish/obsidian-task-planner/releases) page. This file intentionally does not invent retroactive release details.

- [2.0.1](https://github.com/selfish/obsidian-task-planner/releases/tag/2.0.1)
- [2.0.0](https://github.com/selfish/obsidian-task-planner/releases/tag/2.0.0)
- [1.5.0](https://github.com/selfish/obsidian-task-planner/releases/tag/1.5.0)

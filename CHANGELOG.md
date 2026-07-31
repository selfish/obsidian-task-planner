# Changelog

All notable changes to Task Planner are documented here. The project follows [Semantic Versioning](https://semver.org/) and keeps breaking removals for explicitly planned major releases.

## [Unreleased]

### Changed

- Raised the minimum supported Obsidian version to public 1.8.7, where Task Planner's existing vault-local settings APIs are public ([#136](https://github.com/selfish/obsidian-task-planner/issues/136)).

### Fixed

- Preserved date-like values such as `tomorrow` in unrelated Dataview fields during attribute completion.
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

# Changelog

All notable changes to Task Planner are documented here. The project follows [Semantic Versioning](https://semver.org/) and keeps breaking removals for explicitly planned major releases.

## [Unreleased]

### Added

- Tasks and Dataview metadata compatibility characterization covering canonical fields, legacy Task Planner aliases, unsupported forms, and current lossy rewrite behavior ([#108](https://github.com/selfish/obsidian-task-planner/pull/108)).
- Private-first vulnerability reporting guidance and a documented security support policy.
- A CI dependency audit that fails on high or critical known vulnerabilities.

### Fixed

- Re-resolve indexed tasks against current vault content before mutations and fail safely when task identity is missing or ambiguous ([#120](https://github.com/selfish/obsidian-task-planner/issues/120)).
- Route task, follow-up, Quick Add, and onboarding appends through Obsidian's atomic file processor when available.
- Keep the plugin loadable on the declared Obsidian 1.0 floor by using plain inputs when the newer input-suggest API is unavailable.

### Changed

- Replaced the direct `eslint-plugin-react` development dependency with the maintained `@eslint-react/eslint-plugin` alternative while preserving the existing lint baseline.
- Updated vulnerable development and build dependencies without changing generated plugin assets.
- Pinned third-party GitHub Actions to immutable commit SHAs and migrated Codecov test-result uploads to the supported unified action.

## Historical releases

Detailed notes and source comparisons for releases before this changelog are available on the [GitHub Releases](https://github.com/selfish/obsidian-task-planner/releases) page. This file intentionally does not invent retroactive release details.

- [2.0.1](https://github.com/selfish/obsidian-task-planner/releases/tag/2.0.1)
- [2.0.0](https://github.com/selfish/obsidian-task-planner/releases/tag/2.0.0)
- [1.5.0](https://github.com/selfish/obsidian-task-planner/releases/tag/1.5.0)

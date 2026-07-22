# Changelog

All notable changes to Task Planner are documented here. The project follows [Semantic Versioning](https://semver.org/) and keeps breaking removals for explicitly planned major releases.

## [Unreleased]

### Added

- Tasks and Dataview metadata compatibility characterization covering canonical fields, legacy Task Planner aliases, unsupported forms, and current lossy rewrite behavior ([#108](https://github.com/selfish/obsidian-task-planner/pull/108)).
- Private-first vulnerability reporting guidance and a documented security support policy.
- A CI dependency audit that fails on high or critical known vulnerabilities.

### Changed

- Raised the minimum supported Obsidian version to 1.13.0 and updated the compile-time API to 1.13.1.
- Migrated plugin settings to Obsidian's declarative settings definitions, typed file/folder lookups, and structured vault-local storage while retaining legacy stored values.
- Moved Daily Notes and Periodic Notes compatibility behind the community-maintained `obsidian-daily-notes-interface` adapter; Task Planner now uses public Vault APIs for note creation.
- Deep-merge stored plugin settings with current nested defaults so older vault configurations inherit newly added options safely.
- Preserved planning-board settings and native-menu guidance with supported UI affordances instead of private Obsidian settings/configuration APIs.
- Replaced the direct `eslint-plugin-react` development dependency with the maintained `@eslint-react/eslint-plugin` alternative while preserving the existing lint baseline.
- Updated vulnerable development and build dependencies without changing generated plugin assets.
- Pinned third-party GitHub Actions to immutable commit SHAs and migrated Codecov test-result uploads to the supported unified action.

## Historical releases

Detailed notes and source comparisons for releases before this changelog are available on the [GitHub Releases](https://github.com/selfish/obsidian-task-planner/releases) page. This file intentionally does not invent retroactive release details.

- [2.0.1](https://github.com/selfish/obsidian-task-planner/releases/tag/2.0.1)
- [2.0.0](https://github.com/selfish/obsidian-task-planner/releases/tag/2.0.0)
- [1.5.0](https://github.com/selfish/obsidian-task-planner/releases/tag/1.5.0)

# Task Planner Roadmap

This document separates implemented capabilities from proposals. GitHub issues and owner decisions are the source of truth for active work; a roadmap entry is not approval to implement, merge, or publish it.

## Current maintenance

The reliability follow-up is tracked in [#264](https://github.com/selfish/obsidian-task-planner/issues/264). The latest published release is **2.2.0**; changes under [Unreleased in the changelog](CHANGELOG.md#unreleased) are on `main`, not in that release.

Completed on `main`, awaiting a separately approved release:

- [x] Release closed report/Today Focus view subscriptions and reuse mounted roots (#265).
- [x] Include every matching completed/canceled task exactly once in report groups, including tasks with missing or future completion dates (#266).
- [x] Refresh Today Focus, board horizons/counts, and report periods at local midnight and on focus/visible recovery (#268, #270).
- [x] Publish separately labeled focused-core and whole-source unit coverage, with ratcheting gates and revision-bound artifacts (#269). See [Coverage surfaces and gates](docs/COVERAGE.md); real-host smoke tests are separate from unit coverage percentages.

Remaining work in #264:

- [ ] Profile the existing 1,000-task edit-to-board scenario on a fixed runtime/fixture. Separate parse/index, notification, rendering, and paint; report repeated p50/p95 measurements rather than claiming whole-app gains from a microbenchmark.
- [ ] Evaluate code scanning and define actionable finding triage. A badge alone is not a security outcome.
- [ ] Finish branch-protection verification without broadening credentials or changing policy as part of the audit. The active default-branch ruleset is readable, but the classic branch-protection endpoint returns 403; do not interpret that denial as absent protection.

## Future proposals

These are retained product ideas, not prerequisites for the reliability patch or new commitments. Visible changes require review of the concrete rendered candidate; preserve existing settings and vault behavior.

### [ ] Filtered-versus-total task counter

**Effort:** Small | **Type:** UI

The board already shows active-task and completed-today counts ([planning component](src/ui/planning-component.tsx), [header controls](src/ui/planning-settings-component.tsx)). The remaining proposal is an explicit filtered-versus-total comparison, such as `12 of 47 tasks`, with a defined scope for statuses and subtasks—not adding the first task count.

### [ ] Saved views / presets

**Effort:** Medium | **Type:** Feature

Save named combinations of filters, sort order, and view mode, such as work tasks, urgent tasks this week, or shopping. Hashtag parsing already exists; define any new tag-selection UI rather than treating parsing as the missing prerequisite.

### [ ] Generic custom-attribute grouping/filtering

**Effort:** Medium | **Type:** Feature

Let users choose arbitrary fields such as projects, clients, areas, or contexts for grouping/filtering. The [parser](src/core/parsers/line-parser.ts) already reads scalar inline fields, and settings already support custom shortcut expansions and configurable due/completed/selected field names. Arbitrary attribute-based views remain a separate proposal; they must not remove existing fields, aliases, or shorthand behavior.

### [ ] Polished sample vault / demo mode

**Effort:** Small | **Type:** Documentation

Disposable [host-test fixtures](test/e2e/vault/Tasks.md), an [onboarding component](src/ui/onboarding-modal.ts), and a real product screenshot already exist. The remaining idea is a reusable, realistic demonstration vault or demo mode for contributors and screenshots, not the first test vault.

Include varied due dates, backlog, statuses, hashtags, and subtasks. Do not install examples into the owner's real vault as part of routine validation.

### [?] Settings/board control styling consistency

**Effort:** Small | **Type:** UI

Reassess whether any styling mismatch remains after 2.2.0 replaced the legacy settings renderer with native Obsidian controls. Preserve native settings APIs and the owner-approved layout; the old LED-button proposal is not evidence that a mismatch still exists or approval to replace native controls.

### [?] Additional status shortcuts

The six-status context menu is implemented. Dedicated per-status keyboard shortcuts or another status-picker surface remain optional ideas, not a missing basic status UI. Keep the existing completion/in-progress commands and checkbox behavior.

## Implemented capabilities

These capabilities are present in 2.2.0. This list is not an exhaustive release history; see the [changelog](CHANGELOG.md) and [README](README.md) for versioned changes and usage.

- **Priority filter** — filter by `critical`, `high`, `medium`, `low`, or `lowest`, rather than the old `!`/`!!`/`!!!` proposal.
- **Task inbox / Quick Add** — a command and board button open Quick Add; settings choose inbox/daily-note destination, insertion point, and template ([command](src/commands/quick-add.ts), [modal](src/ui/quick-add-modal.ts), [settings](src/settings/types.ts)).
- **Follow-up tasks** — card context menus offer Follow-up and Complete & follow-up, with a chosen due date or backlog and configurable prefix/tag/priority copying. The new task is inserted after the original's subtask block ([menu](src/ui/task-item-component.tsx), [creator](src/core/services/follow-up-creator.ts)).
- **Status UI** — card context menus provide Todo, In progress, Complete, Needs attention, Delegated, and Cancelled. Completion and in-progress commands also exist ([menu](src/ui/task-item-component.tsx), [commands](src/commands)).
- **Task type cleanup** — `TaskItem` has no dedicated `project` field; arbitrary metadata remains in `attributes`. There is no pending `TodoItem.project` removal ([type](src/types/task.ts)).
- **Markdown rendering** — task cards use Obsidian's MarkdownRenderer for links, wikilinks, tags, and inline formatting.
- **Custom horizon colors and tags** — theme-aware color choices and task-text hashtag parsing support custom horizons.
- **Inline metadata and shortcuts** — bracketed Dataview fields, flat scalar parenthesized fields, and enabled `@` shortcuts are supported. This is not a Dataview-only migration; unsupported text and Tasks emoji are not silently converted. See the [compatibility fixtures](__tests__/core/task-metadata-compatibility.test.ts).
- **Today/Future focus and header controls** — focus modes, LED control indicators, centralized fuzzy-search settings, and Obsidian icon chevrons.
- **Settings and note date picker** — flat searchable native settings, maximum horizons per column, and the in-note `@date` picker/command.
- **README refresh** — a concrete workflow description, real Obsidian screenshot, and release metadata refresh shipped in 2.0.6; there is no pending first refresh.

## Compatibility boundaries

Within the current major, preserve settings, aliases, statuses, metadata reads, URLs/commands, and vault behavior unless a scoped exception is explicitly approved. Do not silently rewrite Markdown or migrate Tasks emoji/Dataview formats. Breaking removals and destructive migrations need a separately approved major-release plan and migration path.

An Obsidian-floor change must use the lowest officially public release supplying the needed public API or materially reducing compatibility risk. Verify official release evidence, update the manifest/release map together, and exercise the floor and current public host lanes. No new floor change is proposed here.

## Contributing and delivery

- Search existing issues before opening a new one; keep owner decisions in the relevant issue or PR.
- Use a focused branch and PR, conventional commits, and the checks in [CONTRIBUTING.md](CONTRIBUTING.md).
- Prove deterministic behavior with unit/integration tests and disposable real-Obsidian vaults; do not make the owner smoke-test every build.
- Request owner testing only for a named residual risk, subjective UX, or actual-device behavior, with the exact build and a verified reproducible synthetic-vault ZIP.
- Distinguish merged work from published releases. Release publication and installation into the owner's real vault require explicit approval.

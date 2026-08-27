# Architecture and maintainer guide

This document describes the runtime data flow and the invariants that matter when changing Task Planner. It is a map, not an exhaustive API reference; the tests remain the executable specification.

## System shape

Task Planner is a desktop-only Obsidian plugin. `src/main.ts` is the composition root: it loads settings, builds the parsers and task index, registers commands, views, editor extensions, URI handlers, and vault event listeners, then starts the initial vault scan after Obsidian's layout is ready.

The main flow is:

```text
Markdown files
  -> FileAdapter / ObsidianFile
  -> FileTaskParser + StatusOperations + LineParser
  -> TaskIndex
  -> planning, sidebar, and report views
  -> React/Preact components
  -> FileOperations (optionally through UndoableFileOperations)
  -> atomic Vault.process update
  -> Obsidian modify event
  -> TaskIndex reparses the file and updates every subscribed view
```

React imports are aliased to `preact/compat` by `esbuild.config.mjs`. Obsidian and Electron APIs remain external to the generated CommonJS bundle. SCSS is built separately into `styles.css`.

## Responsibilities by area

- `src/main.ts`: plugin lifecycle and dependency wiring. It owns the live `TaskIndex` and global settings.
- `src/core/parsers`: turns file text into tasks. `FileTaskParser` excludes fenced code blocks, builds indentation-based subtask trees, and records source-line identity.
- `src/core/operations`: safe Markdown mutations, status transitions, undo history, and undo application.
- `src/core/index`: the in-memory, vault-wide task index and its change event.
- `src/core/matchers`: text filtering.
- `src/core/services`: workflows built from core operations, including quick-add support, follow-ups, daily notes, and workload spreading.
- `src/ui`: Preact-compatible components and UI-local state. `planning-component.tsx` derives all board horizons and routes drag-and-drop actions to operations.
- `src/views`: thin Obsidian `ItemView` adapters around UI components.
- `src/settings`: schema/defaults, defensive parsing, and settings UI.
- `src/lib/file-adapter.ts`: boundary between core code and Obsidian's vault API.
- `src/editor` and `src/commands`: editor shortcuts and command-palette entry points.

## Task model and parsing

`TaskItem` is deliberately close to Markdown rather than a database entity. It contains parsed status, text, tags, inline attributes, source file, source line information, and optional subtasks.

Supported state is encoded by checkbox marks and mapped through `TaskStatus`. Attributes use Dataview-compatible inline fields, but Dataview is not a runtime dependency. Attribute names such as due and completed are configurable, so business logic must use settings rather than hard-code those names. Priority is currently a conventional attribute used by workload spreading.

Subtasks are inferred from indentation. They are attached recursively to a parent and removed from the top-level parse result. The planning board promotes a dated subtask into its own card while keeping undated subtasks nested under the parent.

Fenced code blocks are excluded both while parsing and while resolving writes. Keep those two paths consistent whenever task syntax changes.

## Index lifecycle and concurrency

`TaskIndex` stores tasks grouped by file and exposes a flattened cached `tasks` array. The cache is invalidated on every accepted file change, and views subscribe through `onUpdateEvent`.

The initial scan can overlap with vault events. `filesLoading` preserves newer per-file changes while the bulk parse is running. Per-file parsing also uses monotonically increasing sequence numbers so a slower, stale parse cannot overwrite a newer result. File identity uses both path-like `id` and the underlying file object because Obsidian mutates a `TFile` during rename events.

Archived-folder exclusion happens at index time. Task-level or frontmatter ignore state is generally handled at display time so the planning view's "show ignored" mode can still reveal those tasks.

When changing index behavior, test at least:

- modify/create/delete/rename event ordering;
- a file moving into or out of an ignored folder;
- a bulk load racing a newer file event;
- two parses of the same file finishing out of order.

## Safe Markdown writes

All existing-task edits should go through `FileOperations`. It uses `FileAdapter.processContent`, backed by Obsidian's atomic `Vault.process`, instead of read-then-write. The update callback works on the latest file contents.

A parsed task carries its exact `sourceLine` and the number of identical occurrences. Before writing, `FileOperations` relocates that source line in the current content. It fails closed when the line disappeared, appears more than once, is now inside a fenced block, or multiple requested updates resolve to the same line. Legacy callers without `sourceLine` receive a stricter line-number and parsed-text check.

This is the central data-safety invariant: never silently guess which Markdown line to edit.

The writer also preserves each original line separator, including mixed or CRLF content, and refreshes the in-memory identity after a successful write. Batch operations group tasks by file so each file is processed once.

Use the narrowest operation that fits:

- `updateAttribute`, `appendTag`, `updateTaskStatus` for individual edits;
- batch variants or `batchMove` for multi-card operations;
- `processTask` for a structural edit such as inserting a follow-up;
- `UndoableFileOperations` for board actions that users expect to undo.

Do not mutate vault text directly from a component or service. A new write path needs stale-task, duplicate-line, fenced-block, and line-ending tests.

## Planning and undo

`PlanningComponent` derives columns rather than storing board membership. A task's due/completed attributes, status, selected flag, tags, current date, configured horizons, and view filters determine where it appears.

Dropping a card writes the relevant due date, status, and optional custom-horizon tag back to its source. Moving into a built-in horizon removes tags belonging to custom horizons. Group drag operations are resolved and written in batches.

Board mutations use `UndoableFileOperations`, which records prior attribute, status, tag, and completion-date state in `UndoManager` only after the forward write succeeds. Undo is intentionally scoped to the planning view and has size/age limits from settings. Direct checkbox/status controls use `FileOperations` and are not automatically undoable unless explicitly routed through the wrapper.

## Settings and persistence

Global plugin settings are loaded through `parseTaskPlannerSettings`, which validates unknown persisted data and fills defaults. When stored settings have a schema version newer than the running plugin, `main.ts` blocks writes to avoid destroying fields during a downgrade.

Planning display preferences such as view mode and hide-empty state are separate UI-local settings stored by `PlanningSettingsStore`. "Show ignored" is session-only.

When adding a global setting:

1. Extend the type and `DEFAULT_SETTINGS`.
2. Add defensive parsing for persisted unknown input.
3. Add the settings UI and tests.
4. Decide whether the schema version must change and verify downgrade behavior.
5. Pass settings into core code instead of importing mutable plugin state.

## Feature entry points

- Planning board: `src/views/planning-view.ts` -> `src/ui/planning-component.tsx`
- Sidebar list: `src/views/task-list-view.ts` -> `src/ui/task-side-panel-component.tsx`
- Completed report: `src/views/task-report-view.ts` -> `src/ui/task-report-component.tsx`
- Quick add: `src/ui/quick-add-modal.ts` -> `src/core/services/task-creator.ts`
- Follow-up task: context menu in `src/ui/task-item-component.tsx` -> `src/core/services/follow-up-creator.ts`
- Editor shorthand expansion: `src/editor/auto-convert-extension.ts`
- Workload spreading: `src/core/services/task-spreader.ts`, invoked by planning horizon actions

## Testing strategy

`npm run validate` is the normal gate: TypeScript, ESLint, Prettier check, and Jest. Unit tests mirror source areas under `__tests__`; Obsidian APIs are replaced by `__tests__/__mocks__/obsidian.ts`.

`npm run test:e2e` builds the exact plugin, prepares a disposable synthetic vault and pinned Obsidian runtime, launches it under Xvfb, then drives the app over the Chrome DevTools Protocol. Use this suite for behavior that depends on real vault events, `Vault.process`, settings APIs, rendering/layout, drag-and-drop, or plugin loading. Never use a personal vault as a routine test fixture.

Suggested test ownership:

- parser or pure transformation: focused Jest tests;
- write behavior: Jest tests with exact before/after bytes and failure cases;
- component behavior: Testing Library where the mock is representative;
- Obsidian lifecycle/API integration: disposable real-Obsidian E2E test.

Run `npm run build` after changes that affect bundling or styles. Run `npm run test:e2e` when the change crosses the Obsidian boundary or alters a critical write flow.

## Common change recipes

### Add or change task syntax

Update `LineParser`/`StatusOperations`, keep parse and write behavior symmetrical, verify configurable attribute names, and add compatibility tests before changing UI behavior.

### Add a board action

Derive membership in `PlanningComponent`, implement the mutation in core operations or a service, route user-reversible actions through `UndoableFileOperations`, and cover both the Markdown result and UI refresh caused by the vault event.

### Add a view or command

Keep the Obsidian adapter thin, register it in `main.ts`, place testable logic in core/services/UI, and verify cleanup through the plugin registration APIs.

### Diagnose a stale or duplicated card

Inspect the file's parsed `sourceLine`, `sourceLineCount`, and `line`, then check `TaskIndex` event ordering. Do not weaken ambiguous-write checks to make the symptom disappear; fix the identity or indexing path.

## Release artifacts

The production build emits `main.js` and `styles.css`. A release also requires `manifest.json`, with version mappings in `versions.json`. `version-bump.mjs` keeps those files aligned during `npm version`. The version lifecycle expects a clean worktree and pushes the commit and tag in `postversion`, so inspect the branch and remote before invoking it.

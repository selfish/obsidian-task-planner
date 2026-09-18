# Settings audit — 2.2.0

## Scope and decisions

Every persisted preference in `TaskPlannerSettings` was compared with the old UI and runtime consumer. A unit test now enumerates the settings schema and fails if an active preference is missing from the native definitions. This is an interface and discoverability migration, not a rewrite of user notes.

- Replace Essential/Horizons/Advanced subpages and their parallel legacy renderer with one native settings page.
- Use public `PluginSettingTab.getSettingDefinitions`, `SettingControl`, `getControlValue`, `setControlValue`, `SettingDefinitionList`, and `update`. No patched host prototypes, internal search integration, custom navigation, or fallback renderers.
- Require Obsidian **1.13.4**, the first officially public 1.13 desktop release. The declarative API was introduced in 1.13.0, but 1.13.0–1.13.3 were Catalyst releases and have no public test assets. The real-host harness exercises both the 1.13.4 floor and current public 1.13.7; `versions.json` keeps 2.1.0's 1.8.7 compatibility intact.
- Restore the compact weekday button row through the public `SettingDefinition.render` hook, rather than seven full-height toggles. It retains week-start ordering, keyboard-operable buttons, accessible pressed states, save rollback, and search aliases for every weekday.
- Native groups keep all controls exposed to host search. Conditional controls remain visible but disabled, with explanations, instead of disappearing.
- Native collection rows own add/edit/reorder/delete affordances. Collection editors use public `Modal`/`Setting` APIs with draft values, explicit Save/Cancel, validation, and save-failure feedback. There is no legacy settings screen hidden behind these dialogs.

## Audit findings and resolution

- **Horizons per column was absent.** Added `maxHorizonsPerColumn` as the first setting. `0` preserves automatic two/three-high layout; 1–6 limits stacking. Short panes may fit fewer. Extra horizons continue horizontally; Today is unaffected. Tests measure actual geometry, not just stored state or CSS variables.
- **Every setting was nested.** Removed all settings subpages and plugin-specific accordion/layout CSS. Groups are flat, descriptive and host-rendered.
- **Undo controls were incomplete.** Expose history age, history size, toast duration, notifications and undo enablement; dependent controls remain searchable.
- **Changes affecting indexing did not consistently apply immediately.** Exclusions, field names and shortcut interpretation now reindex Markdown files after saving. No file contents are changed.
- **Pinned-task help did not match the implementation.** Document the existing `@selected` keyword; it now respects the configured selected-task attribute.
- **Collection edits could mutate saved state before confirmation.** Edit cloned drafts; Cancel/Escape/validation failures leave stored data untouched. Save failures restore scalar/list state. Unknown properties on existing collection entries survive editing.
- **Invalid settings were too easy to save.** Native number bounds, integer checks, dropdown membership, attribute syntax, regular expressions, vault-relative Markdown paths and required Quick Add `{task}` placeholders are validated. Custom shortcuts reject unusable keywords and collisions with built-ins. Existing data is not mass-normalized by the UI.

## Complete preference coverage

- **Planning board:** stacking cap, daily work-in-progress limit, fuzzy search.
- **Quick add:** destination, inbox file, placement, location regex, task pattern and Templater delay.
- **Horizons:** backlog, overdue, later, seven weekdays, week start, next-week representation, future-week/month counts, quarters, next year; native custom-horizon collection with name/date/tag/position/color.
- **Task attributes:** due date, completion date, selected-task field.
- **Shortcuts:** automatic conversion, master enable, natural-language dates, priorities, pinned shortcut, native custom-shortcut collection with keyword/attribute/value.
- **Indexing:** ignored-folder exclusion toggle and native excluded-folder collection.
- **Undo:** enabled, history size/age and toast enabled/duration.
- **Follow-up tasks:** prefix, tag copying, priority copying.

Internal state (`version`, onboarding/warning acknowledgments) and the obsolete `horizonVisibility.showPast` compatibility key are retained but not presented as user controls. Per-board display modes and temporary filters remain in the board toolbar; they are not duplicated as global preferences.

## Verification contract

- Unit tests enumerate schema coverage, native definitions and the compact weekday renderer, dependent controls, validation, failed-save rollback, list operations and old-data preservation.
- Real Obsidian tests operate controls in the native settings window, check persisted data and layout, and exercise collection editing. The harness attaches to the separate settings window for screenshots; a screenshot of the main vault window is not settings evidence.
- Existing task mutations, date picker, stale-edit, drag/undo and Markdown preservation scenarios remain release gates.
- Desktop support only. Narrow desktop viewport checks are not mobile-host certification.

References: [official settings guide](https://docs.obsidian.md/Plugins/User+interface/Settings), [public API declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts).

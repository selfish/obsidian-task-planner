# Task Horizon Roadmap

This document tracks planned features, improvements, and open questions for the project.

## Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[?]` Needs discussion/research

---

## High Priority

### [~] Today Focus / View Modes
**Effort:** Small | **Type:** UI only

Add view mode toggles to quickly focus on different time horizons:

| Mode | Behavior |
|------|----------|
| **Default** | Show all columns (current behavior) |
| **Today Focus** | Expand Today column to fill space, hide future columns |
| **Future Focus** | Hide Today column, show future columns with a "today horizon" for today's tasks |

**Notes:**
- View mode is NOT persisted (session only)
- Today Focus hides future columns entirely
- Future Focus needs a "today horizon" within future view so today's tasks have somewhere to appear
- Both modes should show Todo + In Progress tasks

---

### [ ] Parse #hashtags from Task Text
**Effort:** Medium | **Type:** Core parsing

Replace the current `@tags(shopping,work)` attribute syntax with standard hashtag parsing.

**Current:** Users must write `@tags(shopping,work)` explicitly
**Target:** Parse `#hashtag` directly from task text like `- [ ] Buy milk #shopping #household`

**Benefits:**
- Matches how most Obsidian users already write tasks
- Enables tag filtering in header
- Unlocks saved views feature
- Standard Obsidian convention

**Action:** Drop `@tags()` attribute support entirely.

---

### [ ] Simplify Attribute Syntax (Standardize on Dataview)
**Effort:** Small | **Type:** Breaking change

**Current state:**
- Plugin supports both syntaxes:
  - `@key(value)` - "Classic" syntax (our invention)
  - `[key:: value]` - Dataview syntax (community standard)
- Setting: `useDataviewSyntax` toggles between them

**Decision:** The `@key()` syntax is non-standard. Dataview syntax `[key:: value]` is the Obsidian community standard.

**Action:**
1. Default to Dataview syntax
2. Consider deprecating/removing `@key()` syntax entirely
3. Migration path for existing users

---

## Medium Priority

### [ ] Task Counter Badge
**Effort:** Small | **Type:** UI

Show filtered vs total task count in the header.

Example: `12 of 47 tasks` or `47 tasks (12 filtered)`

Helps users understand the impact of their filters.

---

### [ ] Saved Views / Presets
**Effort:** Medium | **Type:** Feature

Save combinations of filters, sort order, and view mode as named presets.

Examples:
- "Work tasks" - filter by #work tag
- "This week urgent" - Today + Tomorrow + high priority
- "Shopping list" - filter by #shopping

**Depends on:** #hashtag parsing

---

### [ ] Generic Custom Attributes
**Effort:** Medium | **Type:** Architecture

Allow users to define their own attribute names for grouping/filtering.

**Use cases:**
- One user wants "projects"
- Another wants "clients"
- Another wants "areas" or "contexts"

**Approach:** Settings page where users define attribute names, then filter/group by them.

---

## Low Priority / Future

### [ ] Status Toggle UI
**Effort:** Medium | **Type:** UI

**Current state (verified):**
All 6 statuses ARE correctly parsed:
```
- [ ] Todo
- [x] Complete
- [>] In Progress
- [-] Canceled (also: [c] or [])
- [d] Delegated
- [!] Attention Required
```

**The gap:** No UI to change status (except click-to-complete). Users must manually edit the checkbox character.

**Options to explore:**
1. Right-click context menu with status picker
2. Keyboard shortcuts (e.g., `Ctrl+1` through `Ctrl+6`)
3. Status dropdown on hover
4. Status picker in side panel

**Research:** What do other task plugins (Tasks, Todoist, etc.) do?

---

### [ ] README Refresh
**Effort:** Small | **Type:** Documentation

Current README feels:
- Slightly dated
- Too "salesy" / trying to convince
- Less mature and direct

**Target:**
- Cleaner, more direct tone
- Focus on what it does, not why you should use it
- Keep SEO/discoverability in mind
- Better screenshots

**Depends on:** Demo mode for screenshots

---

### [ ] Demo Mode / Sample Vault
**Effort:** Small | **Type:** Documentation

Create sample notes with realistic tasks for:
1. Taking screenshots for README
2. Testing during development
3. Onboarding new contributors

**Requirements:**
- Variety of due dates (overdue, today, tomorrow, next week, backlog)
- Mix of statuses (todo, in progress, done, canceled)
- Example hashtags
- Realistic looking (not "test task 1, test task 2")

---

## Cleanup / Tech Debt

### [ ] Remove Dead Project Code
**Effort:** Small | **Type:** Cleanup

The `project?: string` field in `TodoItem` is:
- Defined in the type
- Never populated during parsing
- Never used in UI or filtering

**Action:** Remove the field and any related dead code.

---

## Open Questions

### Task Status Toggle UI
How should users change task status (beyond just completing)?

Options:
1. Right-click context menu
2. Keyboard shortcuts
3. Dropdown on hover
4. Status picker in side panel

Worth investigating what other task plugins do.

---

## Completed

_(Move items here when done)_

### [x] Toggle Pills for Header Controls
Converted "Hide empty" and "Hide done" checkboxes to icon buttons with LED indicators.

### [x] Move Fuzzy Search to Main Settings
Consolidated fuzzy toggle from individual views to plugin settings.

### [x] Dropdown Chevron Using Obsidian Icons
Fixed hardcoded SVG color by using `setIcon("chevron-down")`.

---

## Contributing

Found a bug? Have a feature idea?
- Open an issue on GitHub
- Or submit a PR referencing this roadmap

When working on an item, update this file to mark it `[~]` in progress.

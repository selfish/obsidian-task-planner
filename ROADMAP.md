# Task Horizon Roadmap

This document tracks planned features, improvements, and open questions for the project.

## Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[?]` Needs discussion/research

---

## High Priority

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

### [ ] Priority Filter
**Effort:** Small | **Type:** UI

Add ability to filter tasks by priority level in the header.

**Options:**
- Dropdown or toggle buttons for priority levels (!, !!, !!!)
- Show all / high only / medium+ options
- Could combine with existing filter controls

**Depends on:** Priority is already parsed as an attribute

---

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

### [ ] Custom Horizon Colors
**Effort:** Small | **Type:** UI

Allow users to select a color for each custom horizon.

**Current:** Custom horizons use default styling
**Target:** Color picker in custom horizon settings, applies tint to column (like overdue=red, today-horizon=amber)

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

- **Today Focus / View Modes** — sun/calendar-range toggles to focus on today or future
- **Toggle Pills for Header Controls** — icon buttons with LED indicators
- **Move Fuzzy Search to Main Settings** — consolidated from individual views
- **Dropdown Chevron Using Obsidian Icons** — fixed hardcoded SVG color

---

## Contributing

Found a bug? Have a feature idea?
- Open an issue on GitHub
- Or submit a PR referencing this roadmap

When working on an item, update this file to mark it `[~]` in progress.

---

## Development Workflow

- **Branch per feature** — every change, even small ones, gets its own branch and PR
- **Commit early, commit often** — small, frequent commits
- **Simple commit messages** — subject line only, no description body needed. Write like a human: `fix typo in header`, `add priority filter dropdown`
- **Conventional prefixes** — use `feat:`, `fix:`, `docs:`, `style:`, `test:`, `refactor:`, `chore:` as needed
- **Keep roadmap current** — move completed items to "Completed" section, update descriptions to reflect current state

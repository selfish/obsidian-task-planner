# Task Horizon Roadmap

This document tracks planned features, improvements, and open questions for the project.

## Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[?]` Needs discussion/research

---

## High Priority

(No high priority items at this time)

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

### [ ] Task Inbox / Quick Add
**Effort:** Medium | **Type:** Feature

Add ability to create tasks directly from the task view.

**Open questions:**
- Where do new tasks get dropped? (dedicated inbox note? current daily note? configurable?)
- UI: floating button? keyboard shortcut? input field in header?

---

### [ ] Render Tasks Like Notes
**Effort:** Small | **Type:** UI

Task text should render closer to how it appears in notes:
- Markdown links `[text](url)` should display as plaintext (not raw syntax)
- Wikilinks `[[page]]` should render plainly
- Other inline formatting as appropriate

Currently task text is shown raw, which looks cluttered.

---

### [ ] Followup Task (Right-Click Action)
**Effort:** Medium | **Type:** Feature

Right-click context menu to create a followup task from an existing one.

**Use case:** Task is done, but needs review/revisit later.

**Behavior:**
- Duplicates task immediately below the original (same note)
- Removes due date (task goes to backlog)
- Adds brief prefix (e.g., "F/U:" or "→")

**Menu options:**
1. "Create followup" — keeps original unchanged
2. "Complete + followup" — marks original done, creates followup

**UX considerations:**
- Prefix should be short (original task text already provides context)
- Could use icon/emoji instead of text prefix
- Consider keyboard shortcut for power users

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

### [ ] Align Settings LED Buttons with Planning View
**Effort:** Small | **Type:** UI Consistency

LED toggle buttons in settings look different from the LED buttons in the planning view "controls" section. They should use the same styling.

**Action:** Unify the LED button component/styles between settings and planning view controls.

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

- **Custom Horizon Colors** — color picker in settings with 12 theme-aware options, applies tint to custom horizon columns
- **Parse #hashtags from Task Text** — hashtags like `#shopping` are now parsed directly from task text and used for custom horizon filtering
- **Simplify Attribute Syntax** — removed `@key(value)` syntax, now Dataview `[key:: value]` only
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

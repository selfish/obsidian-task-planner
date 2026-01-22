# Task Planner

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple)](https://obsidian.md)
[![GitHub release](https://img.shields.io/github/v/release/selfish/obsidian-task-planner)](https://github.com/selfish/obsidian-task-planner/releases)
[![CI](https://github.com/selfish/obsidian-task-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/selfish/obsidian-task-planner/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/selfish/obsidian-task-planner/branch/main/graph/badge.svg)](https://codecov.io/gh/selfish/obsidian-task-planner)
[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html)

Task management for Obsidian. Track tasks across your vault, plan your day with a Kanban-style board, and manage workload with time-based horizons.

---

## Table of Contents

- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [Views](#views)
  - [Planning Board](#planning-board)
  - [Today Focus](#today-focus)
  - [Report](#report)
- [Task Syntax](#task-syntax)
  - [Checkboxes](#checkboxes)
  - [Attributes](#attributes)
  - [Shorthand Notation](#shorthand-notation)
  - [Tags](#tags)
  - [Subtasks](#subtasks)
- [Commands](#commands)
- [Quick Add](#quick-add)
- [Follow-up Tasks](#follow-up-tasks)
- [Configuration](#configuration)
  - [Planning Horizons](#planning-horizons)
  - [Custom Horizons](#custom-horizons)
  - [WIP Limits](#wip-limits)
  - [Folder Filtering](#folder-filtering)
  - [Attribute Names](#attribute-names)
  - [Shorthand Settings](#shorthand-settings)
  - [Quick Add Settings](#quick-add-settings)
  - [Follow-up Settings](#follow-up-settings)
- [License](#license)

---

## Installation

> **Note:** Task Planner is not yet available in the Obsidian Community Plugins directory. Manual installation is required.

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/selfish/obsidian-task-planner/releases)
2. Extract `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/task-planner/` directory
3. Open Obsidian Settings → Community Plugins
4. Enable "Task Planner"

### From Source

```bash
git clone https://github.com/selfish/obsidian-task-planner.git
cd obsidian-task-planner
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin directory.

---

## Core Concepts

Task Planner indexes all tasks in your vault and presents them in organized views. Tasks remain in your markdown files—the plugin reads and writes to your notes directly.

**Tasks are defined by checkboxes.** Any line with a checkbox (`- [ ]`, `- [x]`, etc.) is a task. Metadata like due dates and priorities are stored as inline attributes using the Dataview format.

**Views don't store data.** The Planning Board, Today Focus, and Report views are windows into your tasks. Moving a task on the board updates the underlying markdown file.

---

## Views

### Planning Board

The Planning Board is a Kanban-style view with time-based columns. Open it via:
- Command palette: "Open planning"
- Ribbon icon (calendar)
- URI: `obsidian://task-planner-planning`

**Today Section** displays three columns:
- **Todo** — Tasks due today, not yet started
- **In Progress** — Tasks marked as ongoing
- **Done** — Completed or canceled tasks (hideable)

**Future Section** displays configurable horizons:
- **Backlog** — Tasks without a due date
- **Overdue** — Tasks past their due date
- **Tomorrow through Sunday** — Individual day columns (configurable)
- **Weeks +1 to +4** — Weekly buckets
- **Months +1 to +3** — Monthly buckets
- **Quarters** — Remaining quarters of the year (optional)
- **Next Year** — Tasks due next calendar year (optional)
- **Later** — Everything beyond visible horizons
- **Custom Horizons** — User-defined columns with tag filtering

**Drag and Drop:**
- Drag a single task to move it to a different date
- Drag a file group header to batch-move all incomplete tasks from that file
- Dropping on a column updates the task's due date

**Header Controls:**
- Search field with optional fuzzy matching
- Toggle: hide empty columns
- Toggle: hide completed tasks
- Toggle: Today-only view
- Toggle: Future-only view
- Quick add button
- Refresh button
- Settings access

### Today Focus

A sidebar panel showing tasks relevant to the current day. Automatically opens on the right sidebar (desktop only).

**Sections:**
- **Pinned** — Tasks with `[selected:: true]`
- **Overdue** — Past-due incomplete tasks
- **Today** — Tasks due today
- **Started** — In Progress, Delegated, or Attention Required tasks
- **Done Today** — Completed or canceled today

Each section is collapsible. Collapse states persist across sessions.

### Report

Historical view of completed and canceled tasks grouped by time period.

**Grouping:**
- Recent 4 weeks shown individually
- Older periods grouped by month

**Filtering:**
- Search by text
- Filter by status: All, Completed only, Canceled only

Open via command palette: "Open todo report"

---

## Task Syntax

### Checkboxes

Task Planner recognizes these checkbox markers:

| Marker | Status | Description |
|--------|--------|-------------|
| `[ ]` | Todo | Standard uncompleted task |
| `[x]` | Complete | Finished task |
| `[>]` | In Progress | Currently being worked on |
| `[-]` | Canceled | Decided not to do |
| `[d]` | Delegated | Assigned to someone else |
| `[!]` | Attention Required | Needs immediate attention |

**Examples:**
```markdown
- [ ] Write documentation
- [x] Review pull request
- [>] Implement search feature
- [-] Canceled meeting
- [d] Deploy to staging (assigned to ops team)
- [!] Fix critical bug
```

### Attributes

Attributes use Dataview inline field syntax: `[key:: value]`

This format is compatible with the Dataview plugin and is the community standard.

**Core Attributes:**

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `due` | Due date | `[due:: 2025-03-15]` |
| `completed` | Completion date | `[completed:: 2025-03-14]` |
| `selected` | Pin task | `[selected:: true]` |
| `priority` | Priority level | `[priority:: high]` |

**Priority Levels:** `critical`, `high`, `medium`, `low`, `lowest`

**Example task with attributes:**
```markdown
- [ ] Quarterly report [due:: 2025-03-31] [priority:: high]
```

Attribute names are configurable in settings.

### Shorthand Notation

Type `@` shortcuts and Task Planner converts them to Dataview format when you leave the line.

**Date Shortcuts:**

| Shorthand | Converts To |
|-----------|-------------|
| `@today`, `@tod` | `[due:: YYYY-MM-DD]` (today) |
| `@tomorrow`, `@tom`, `@tmr` | `[due:: YYYY-MM-DD]` (tomorrow) |
| `@monday`, `@mon` | `[due:: YYYY-MM-DD]` (next Monday) |
| `@next week` | `[due:: YYYY-MM-DD]` (next Monday) |
| `@next month` | `[due:: YYYY-MM-DD]` (1st of next month) |
| `@in 3 days` | `[due:: YYYY-MM-DD]` (3 days from now) |
| `@jan 15`, `@15 jan` | `[due:: YYYY-01-15]` |

**Priority Shortcuts:**

| Shorthand | Converts To |
|-----------|-------------|
| `@critical` | `[priority:: critical]` |
| `@high` | `[priority:: high]` |
| `@medium` | `[priority:: medium]` |
| `@low` | `[priority:: low]` |
| `@lowest` | `[priority:: lowest]` |

**Other Shortcuts:**

| Shorthand | Converts To |
|-----------|-------------|
| `@selected` | `[selected:: true]` |

**Example:**
```markdown
# Before leaving the line:
- [ ] Fix login bug @today @high

# After cursor moves away:
- [ ] Fix login bug [due:: 2025-01-22] [priority:: high]
```

Auto-conversion can be disabled in settings. You can also trigger conversion manually with the "Complete line attributes" command.

### Tags

Standard hashtags work as expected:
```markdown
- [ ] Review PR #work #code-review
- [ ] Buy groceries #personal #shopping
```

Tags can be used to filter custom horizons.

### Subtasks

Indent with spaces or tabs to create subtasks:
```markdown
- [ ] Prepare presentation
  - [ ] Create outline
  - [ ] Design slides
  - [ ] Write speaker notes
    - [ ] Introduction
    - [ ] Main points
    - [ ] Conclusion
```

Subtasks display nested under their parent in the Planning Board.

---

## Commands

Access via Command Palette (Cmd/Ctrl + P):

| Command | Description |
|---------|-------------|
| **Open planning** | Opens the Planning Board |
| **Open todo report** | Opens the Report view |
| **Quick add task** | Opens the Quick Add modal |
| **Mark todo as checked / unchecked** | Toggles task completion on current line |
| **Mark todo as ongoing / unchecked** | Toggles In Progress status on current line |
| **Complete line attributes** | Converts `@` shortcuts to Dataview format |

Assign custom hotkeys in Obsidian Settings → Hotkeys.

---

## Quick Add

Rapidly create tasks without navigating to a specific file.

**Open Quick Add:**
- Command: "Quick add task"
- Planning Board header: Plus button
- URI: `obsidian://task-planner-quick-add`

**Features:**
- Type task text with `@` shortcuts (auto-converted)
- Type `[[` for wikilink autocomplete
- Paste URLs to create styled links
- Ctrl/Cmd + Enter to submit

**Task Destination:**
Configure where new tasks are saved:
- **Inbox file** — A designated file (default: `Inbox.md`)
- **Daily note** — Today's daily note (uses Obsidian's Daily Notes or Templater)

**Placement Options:**
- Prepend (after frontmatter)
- Append (end of file)
- Before regex match
- After regex match

**Task Pattern:**
Customize the format of created tasks:
```
- [ ] {task}
```

Available placeholders: `{task}`, `{time}`, `{date}`, `{datetime}`

---

## Follow-up Tasks

Create related tasks from existing ones via right-click context menu.

**Options:**
- Follow-up → Today
- Follow-up → Tomorrow
- Follow-up → Next week
- Follow-up → Backlog

**Behavior:**
- New task is inserted after the original (and its subtasks)
- Text is prefixed (default: "Follow up: ")
- Tags can be copied from the original (configurable)
- Priority can be copied from the original (configurable)

---

## Configuration

Open Settings → Task Planner.

### Planning Horizons

Control which columns appear on the Planning Board.

**Day Columns:**
- Show individual days: Monday through Sunday
- Weekdays enabled by default; weekends disabled

**Range Columns:**
- Weeks to show: 0–4 (default: 4)
- Months to show: 0–3 (default: 3)
- Show quarters: Yes/No (default: No)
- Show next year: Yes/No (default: No)

**Special Columns:**
- Show backlog (tasks without due date)
- Show overdue (past-due tasks)
- Show later (beyond visible horizons)

**First Weekday:**
Set which day starts the week (Monday–Sunday).

### Custom Horizons

Create columns filtered by date and optionally by tag.

**Configuration:**
- **Label** — Display name for the column
- **Date** — ISO date (YYYY-MM-DD)
- **Tag** — Optional tag filter; tasks dropped here receive this tag
- **Color** — Column header color
- **Position** — Before backlog, after backlog, or at end

**Use Cases:**
- Sprint-specific columns
- Project milestones
- Event deadlines

### WIP Limits

Set a daily Work In Progress limit to prevent overcommitment.

**Default:** 5 tasks per day

When exceeded, the column displays a visual warning. Set to 0 to disable.

### Folder Filtering

Exclude folders from task indexing.

**Settings:**
- **Ignored folders** — List of folder paths to skip
- **Ignore archived todos** — When enabled, excluded folders are not indexed

Useful for archive folders or template directories.

### Attribute Names

Customize the attribute names used by Task Planner.

| Setting | Default | Purpose |
|---------|---------|---------|
| Due date attribute | `due` | Task due date |
| Completed date attribute | `completed` | Completion timestamp |
| Selected attribute | `selected` | Pin/selection marker |

Changing these affects how Task Planner reads and writes attributes. Existing tasks with different attribute names won't be recognized until updated.

### Shorthand Settings

Control `@` shortcut behavior.

**Master Toggle:** Enable/disable all `@` shortcuts

**Category Toggles:**
- Date shortcuts (`@today`, `@tomorrow`, etc.)
- Priority shortcuts (`@high`, `@low`, etc.)
- Built-in shortcuts (`@selected`)

**Custom Shortcuts:**
Define your own shortcuts:
```
Keyword: work
Attribute: context
Value: work
```

Result: `@work` → `[context:: work]`

### Quick Add Settings

Configure Quick Add task creation.

| Setting | Options | Default |
|---------|---------|---------|
| Destination | Inbox file, Daily note | Inbox file |
| Inbox file path | Any file path | `Inbox.md` |
| Placement | Prepend, Append, Before regex, After regex | Prepend |
| Task pattern | Template string | `- [ ] {task}` |
| Location regex | Regex pattern | (empty) |
| Templater delay | Milliseconds | 300 |

The Templater delay is used when Daily Notes require Templater processing.

### Follow-up Settings

Configure follow-up task behavior.

| Setting | Default | Description |
|---------|---------|-------------|
| Text prefix | `Follow up: ` | Prepended to follow-up task text |
| Copy tags | Yes | Include original task's tags |
| Copy priority | Yes | Include original task's priority |

---

## License

Task Planner is licensed under the [GNU General Public License v2.0](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html).

### Attribution

This software is a fork of [Proletarian Wizard](https://github.com/cfe84/obsidian-pw) by cfe84 and contributors, licensed under GPL v2.0.

As required by the GPL, this derivative work is also licensed under GPL v2.0 and all source code is freely available.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and contribution guidelines.

## Support

- [GitHub Issues](https://github.com/selfish/obsidian-task-planner/issues) — Report bugs and request features
- [GitHub Discussions](https://github.com/selfish/obsidian-task-planner/discussions) — Questions and community discussion

# Task Planner

[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html)
[![GitHub release](https://img.shields.io/github/v/release/selfish/obsidian-task-planner)](https://github.com/selfish/obsidian-task-planner/releases)
[![CI](https://github.com/selfish/obsidian-task-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/selfish/obsidian-task-planner/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/selfish/obsidian-task-planner/branch/main/graph/badge.svg)](https://codecov.io/gh/selfish/obsidian-task-planner)
[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple)](https://obsidian.md)

A professional task management plugin for Obsidian that helps you track tasks across your vault, organize your day with intelligent planning, and manage your workload effectively.

> **Note:** This plugin is a fork of [Proletarian Wizard](https://github.com/cfe84/obsidian-pw) by cfe84. See [About This Fork](#about-this-fork) for our philosophy and [CREDITS.md](CREDITS.md) for detailed attribution.

## Features

### Planning Board
- Kanban-style planning view with time-based horizons
- Today section with Todo, In Progress, and Done columns
- Future planning with configurable day, week, month, quarter, and year horizons
- Drag and drop tasks between time periods
- Custom horizons filtered by tag or specific dates
- WIP (Work In Progress) limits to manage daily workload

### Task Management
- Track tasks from any markdown file in your vault
- Support for multiple task statuses: Todo, In Progress, Complete, Canceled, Delegated
- Priority levels: Critical, High, Medium, Low, Lowest
- Due date tracking with flexible attribute syntax
- Pin important tasks to keep them visible
- Subtask support with collapsible groups

### Flexible Syntax
Choose between two attribute styles:

**Classic syntax:**
```markdown
- [ ] Buy groceries @due(2025-01-15) @priority(high)
```

**Dataview syntax:**
```markdown
- [ ] Buy groceries [due:: 2025-01-15] [priority:: high]
```

### Smart Date Completion
Type shorthand dates and let Task Planner expand them:
- `@today` expands to today's date
- `@tomorrow` expands to tomorrow's date
- `@monday` expands to next Monday's date
- `01-15` expands to `2025-01-15`

## Installation

### From Obsidian Community Plugins
1. Open Obsidian Settings
2. Navigate to Community Plugins
3. Search for "Task Planner"
4. Click Install, then Enable

### Manual Installation
1. Download the latest release from GitHub
2. Extract to your vault's `.obsidian/plugins/task-planner/` directory
3. Enable the plugin in Obsidian Settings > Community Plugins

## Usage

### Creating Tasks
Add tasks anywhere in your markdown files using standard checkbox syntax:
```markdown
- [ ] Unchecked task
- [x] Completed task
- [>] In progress
- [-] Canceled
- [d] Delegated
- [!] Attention required
```

### Adding Attributes
Add due dates, priorities, and other metadata:
```markdown
- [ ] Review quarterly report @due(2025-03-31) @priority(high)
- [ ] Schedule team meeting @due(tomorrow) @selected
```

### Commands
- **Open planning**: Opens the planning board view
- **Open todo report**: Opens the completed tasks report
- **Mark todo as checked/unchecked**: Toggle task completion
- **Mark todo as ongoing/unchecked**: Toggle in-progress status
- **Complete line attributes**: Expand shorthand dates and priorities

### Settings

Configure Task Planner in Settings > Task Planner:

- **Planning Board**: Configure visible time horizons (days, weeks, months, quarters)
- **Custom Horizons**: Create tag-filtered or date-specific columns
- **Task Attributes**: Customize attribute names (due, completed, selected)
- **Syntax**: Choose between classic (@due) or Dataview ([due::]) syntax
- **Filtering**: Ignore specific folders or archived content

## Development

### Prerequisites

- Node.js 18+
- npm

### Quick Start

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run dev

# Production build
npm run build

# Run all validation (lint, types, format, tests)
npm run validate
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development build with watch mode |
| `npm run build` | Production build |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run typecheck` | TypeScript type checking |
| `npm run validate` | Run all checks |

### Project Structure
```
src/
  commands/       # Editor commands
  core/           # Core business logic
  events/         # Event handling
  lib/            # Shared utilities
  settings/       # Plugin settings
  types/          # TypeScript types
  ui/             # React components
  views/          # Obsidian views
__tests__/        # Test files
  __mocks__/      # Mock implementations
```

### Testing

We use Jest for testing with comprehensive Obsidian API mocks:

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Code Quality

- **Prettier** for code formatting
- **ESLint** with React and TypeScript plugins
- **TypeScript** with gradual strictness
- **Husky** pre-commit hooks
- **Commitlint** for conventional commits

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a Pull Request.

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

```bash
feat(planning): add drag-and-drop reordering
fix(parser): handle empty attributes correctly
docs: update installation instructions
```

Quick start:
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and run `npm run validate`
4. Commit using conventional commits
5. Push and open a Pull Request

## About This Fork

Task Planner is a fork of [Proletarian Wizard](https://github.com/cfe84/obsidian-pw) by cfe84. We're grateful for the excellent foundation that project provided.

### Why We Forked

We forked Proletarian Wizard because:

1. **Different vision** - We wanted to explore different design decisions and features
2. **Independent development** - Our roadmap diverged enough that independent maintenance made sense
3. **Fresh identity** - A rebrand felt appropriate for the direction we wanted to take

This is not a rejection of the original work. Quite the opposite - Proletarian Wizard was good enough that it inspired us to build upon it! Forking is a sign of respect in open source, not competition.

### Our Relationship with the Original

- **We maintain this independently** - Not synchronized with upstream
- **We credit generously** - See [CREDITS.md](CREDITS.md) for detailed attribution
- **We preserve GPL v2** - As required and as we believe is right
- **We're open to collaboration** - Happy to share ideas with the original project

### Why This Matters

Open source thrives when projects can fork and evolve. Different visions lead to different solutions, and users benefit from having choices. We believe:

- **Forking drives innovation** - Multiple approaches solve different problems
- **GPL protects freedom** - Ensuring code stays free benefits everyone
- **Attribution honors creators** - Credit flows to those who deserve it
- **Community beats ego** - Sharing knowledge matters more than controlling it

We're proud to be part of the open source ecosystem, standing on the shoulders of those who came before us.

## License

This project is licensed under the GNU General Public License v2.0 - see the [LICENSE](LICENSE) file for details.

### Attribution

This software is based on [Proletarian Wizard](https://github.com/cfe84/obsidian-pw) by cfe84 and contributors, licensed under GPL v2.0.

**For detailed credits and attribution, see [CREDITS.md](CREDITS.md).**

## Support

- Report issues on [GitHub Issues](https://github.com/selfish/obsidian-task-planner/issues)
- Join the discussion in the Obsidian community forums

# Task Planner

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-purple)](https://obsidian.md)
[![GitHub release](https://img.shields.io/github/v/release/selfish/obsidian-task-planner)](https://github.com/selfish/obsidian-task-planner/releases)
[![CI](https://github.com/selfish/obsidian-task-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/selfish/obsidian-task-planner/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/selfish/obsidian-task-planner/branch/main/graph/badge.svg)](https://codecov.io/gh/selfish/obsidian-task-planner)
[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html)

A professional task management plugin for Obsidian that helps you track tasks across your vault, organize your day with intelligent planning, and manage your workload effectively.

> **Note:** This plugin is a fork of [Proletarian Wizard](https://github.com/cfe84/obsidian-pw) by cfe84. See [LICENSE](LICENSE) for attribution.

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

### Dataview-Compatible Syntax
Task attributes use the Dataview inline field format:

```markdown
- [ ] Buy groceries [due:: 2025-01-15] [priority:: high]
```

This syntax is compatible with the popular Dataview plugin and is the Obsidian community standard.

### Smart Attribute Conversion
Type shorthand attributes and Task Planner automatically converts them to Dataview format when you move to the next line:
- `@today` → `[due:: 2025-01-17]`
- `@tomorrow` → `[due:: 2025-01-18]`
- `@high` → `[priority:: high]`
- `@due(tomorrow)` → `[due:: 2025-01-18]`

This auto-conversion can be disabled in settings if you prefer manual control.

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
- [ ] Review quarterly report [due:: 2025-03-31] [priority:: high]
- [ ] Schedule team meeting [due:: 2025-01-20] [selected:: true]
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
- **Filtering**: Ignore specific folders or archived content

## Development

### Prerequisites

- Node.js 22+
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

| Script                  | Description                       |
|-------------------------|-----------------------------------|
| `npm run dev`           | Development build with watch mode |
| `npm run build`         | Production build                  |
| `npm run test`          | Run tests                         |
| `npm run test:watch`    | Run tests in watch mode           |
| `npm run test:coverage` | Run tests with coverage report    |
| `npm run lint`          | Run ESLint                        |
| `npm run lint:fix`      | Run ESLint with auto-fix          |
| `npm run format`        | Format code with Prettier         |
| `npm run format:check`  | Check code formatting             |
| `npm run typecheck`     | TypeScript type checking          |
| `npm run validate`      | Run all checks                    |

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

## License

This project is licensed under the GNU General Public License v2.0 - see the [LICENSE](LICENSE) file for details.

### Attribution

This software is based on [Proletarian Wizard](https://github.com/cfe84/obsidian-pw) by cfe84 and contributors, licensed under GPL v2.0.

## Support

- Report issues on [GitHub Issues](https://github.com/selfish/obsidian-task-planner/issues)
- Join the discussion in the Obsidian community forums

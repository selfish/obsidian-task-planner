# Contributing to Task Planner

Contributions are welcome. This document covers development setup, project architecture, coding standards, and the contribution workflow.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Types of Contributions](#types-of-contributions)
- [License](#license)

---

## Code of Conduct

Be respectful, professional, and constructive. Focus on the work.

---

## Development Setup

### Prerequisites

- Node.js 22+
- npm
- Obsidian (for manual testing)

### Installation

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/obsidian-task-planner.git
   cd obsidian-task-planner
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up git hooks:
   ```bash
   npm run prepare
   ```

4. Build the plugin:
   ```bash
   npm run build
   ```

### Development Build

For development with file watching:

```bash
npm run dev
```

This rebuilds on file changes. You'll need to reload Obsidian to see changes (Cmd/Ctrl + R in developer mode).

### Deploying to a Vault

Set `OBSIDIAN_PATH` to your test vault and run:

```bash
export OBSIDIAN_PATH="/path/to/your/vault"
npm run deploy
```

This copies `manifest.json`, `main.js`, and `styles.css` to the plugin directory.

### Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development build with watch mode |
| `npm run build` | Production build |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting |
| `npm run typecheck` | TypeScript type checking |
| `npm run validate` | Run all checks (types, lint, format, tests) |
| `npm run deploy` | Copy build artifacts to vault |

Always run `npm run validate` before committing.

---

## Project Architecture

### Directory Structure

```
src/
├── commands/           # Obsidian commands
├── core/               # Core business logic
│   ├── index/          # Task indexing
│   ├── matchers/       # Search matching
│   ├── operations/     # Task operations (parse, update, etc.)
│   ├── parsers/        # Markdown parsing
│   └── services/       # Task creation, follow-ups
├── editor/             # CodeMirror extensions
├── events/             # Event system
├── lib/                # Shared utilities
├── settings/           # Plugin settings
├── styles/             # SCSS stylesheets
├── types/              # TypeScript types
├── ui/                 # Preact components
└── views/              # Obsidian view implementations

__tests__/
├── __mocks__/          # Mock implementations
├── core/               # Core logic tests
└── ui/                 # UI component tests
```

### Key Modules

**Entry Point:** `src/main.ts`
The `TaskPlannerPlugin` class extends Obsidian's `Plugin`. Initializes services, registers commands/views, and sets up event listeners.

**TodoIndex:** `src/core/index/todo-index.ts`
Maintains an in-memory index of all tasks across the vault. Fires update events when tasks change.

**Parsers:** `src/core/parsers/`
- `line-parser.ts` — Parses individual lines for checkbox, attributes, tags
- `file-todo-parser.ts` — Parses entire files, builds subtask trees
- `folder-todo-parser.ts` — Parallelizes file parsing

**Operations:** `src/core/operations/`
- `status-operations.ts` — Status toggling, attribute conversion
- `file-operations.ts` — Attribute/tag updates, writes to files
- `completion.ts` — Natural language date parsing

**UI Components:** `src/ui/`
Preact components for the Planning Board, Today Focus, and Report views. Uses React-like hooks.

**Views:** `src/views/`
Obsidian `ItemView` implementations that mount Preact components.

**Events:** `src/events/task-planner-event.ts`
Generic pub/sub event system. Used by TodoIndex to notify UI of updates.

### Data Flow

```
User action → FileOperations → File write →
Obsidian vault event → TodoIndex.fileUpdated() →
File re-parsed → onUpdateEvent fires →
UI components re-render
```

Tasks are never stored separately. The source markdown files are the single source of truth.

### Technology Stack

- **TypeScript** — Gradual strictness configuration
- **Preact** — Lightweight React alternative (smaller bundle)
- **SCSS** — Modular stylesheets
- **esbuild** — Fast bundling
- **Jest** — Testing with JSDOM
- **ESLint + Prettier** — Code quality and formatting

---

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Avoid `any` when possible (configured as warning)
- Use interfaces for object shapes
- Export types from `src/types/`

### Code Style

- Prettier handles formatting (runs on commit via git hooks)
- ESLint enforces code quality
- Use meaningful names
- Keep functions focused
- Add comments for non-obvious logic only

### Preact Components

- Use functional components with hooks
- Keep components small
- Extract reusable logic into custom hooks
- Props should be well-typed

### File Organization

- Place tests in `__tests__/` mirroring `src/` structure
- Keep modules focused—split large files
- Export from index files when appropriate

### Styling

SCSS files are in `src/styles/`. Uses CSS custom properties for theming compatibility with Obsidian.

Key files:
- `_variables.scss` — SCSS variables
- `_base.scss` — Base styles and CSS custom properties
- `main.scss` — Master import file

---

## Testing

### Running Tests

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Structure

- Tests live in `__tests__/` mirroring source structure
- Name files with `.test.ts` or `.test.tsx`
- Use the Obsidian mock at `__tests__/__mocks__/obsidian.ts`

### Writing Tests

Focus on:
- Core business logic (parsers, operations)
- Edge cases in date parsing
- Attribute extraction
- Status transitions

Mock external dependencies (Obsidian API, file system).

### Coverage

Coverage reports are uploaded to Codecov on CI. Aim for meaningful coverage—don't inflate numbers with trivial tests.

---

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) for consistent history and automatic changelog generation.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Formatting (no code change) |
| `refactor` | Code change (no new feature or fix) |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `build` | Build system or dependencies |
| `ci` | CI configuration |
| `chore` | Other maintenance |
| `revert` | Revert previous commit |

### Scope

Optional. Common scopes: `planning`, `parser`, `settings`, `ui`, `deps`

### Examples

```bash
feat(planning): add quarterly horizon columns
fix(parser): handle empty task attributes
docs: update installation instructions
test(parser): add tests for date parsing edge cases
chore(deps): update typescript to 5.5
```

### Commit Message Validation

The `commit-msg` git hook runs commitlint. Invalid messages are rejected.

---

## Pull Request Process

### Before Opening a PR

1. Run validation:
   ```bash
   npm run validate
   ```
   All checks must pass.

2. Write tests for new functionality

3. Update documentation if needed

4. Keep commits focused and atomic

### Opening a PR

Include in your description:
- What the PR does
- Why the change is needed
- How to test it
- Screenshots/GIFs for UI changes

### Review Process

- Maintainers will review your PR
- Address feedback promptly
- CI checks must pass
- Keep discussion focused on the code

### After Merge

The CI pipeline handles releases. Version bumps are managed through npm scripts.

---

## Types of Contributions

### Bug Fixes

1. Check existing issues for duplicates
2. Provide reproduction steps
3. Include expected vs actual behavior
4. Add regression tests

### New Features

1. Open an issue first to discuss
2. Keep scope manageable
3. Follow existing patterns
4. Add tests
5. Update documentation

### Documentation

- Fix typos and unclear explanations
- Add examples
- Keep it concise

### Refactoring

- Explain the benefit
- Keep changes focused
- Don't mix with feature work
- Ensure tests pass

---

## License

By contributing, you agree that your contributions will be licensed under the [GNU General Public License v2.0](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html).

Task Planner is a fork of [Proletarian Wizard](https://github.com/cfe84/obsidian-pw) by cfe84, licensed under GPL v2.0. All contributions must comply with GPL v2 requirements.

---

## Questions?

- Open an issue for questions
- Check existing issues and PRs first

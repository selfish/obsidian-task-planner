# Contributing to Task Planner

Thank you for your interest in contributing to Task Planner! We welcome contributions from the community.

## Code of Conduct

Be respectful, professional, and constructive in all interactions. We're here to build great software together.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm
- Obsidian (for testing)

### Development Setup

1. Fork the repository

2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/obsidian-task-planner.git
   cd obsidian-task-planner
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up git hooks:
   ```bash
   npm run prepare
   ```

5. Build the plugin:
   ```bash
   npm run build
   ```

6. Link to your Obsidian vault for testing:
   ```bash
   export OBSIDIAN_PATH="/path/to/your/vault"
   npm run deploy
   ```

### Development Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run validation:
   ```bash
   npm run validate
   ```
   This runs type checking, linting, formatting checks, and tests.

4. Test your changes manually in Obsidian

5. Commit your changes using conventional commits (see below)

6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

7. Open a Pull Request

## Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) for our commit messages. This enables automatic changelog generation and semantic versioning.

### Commit Format

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
| `docs` | Documentation only changes |
| `style` | Changes that don't affect code meaning (formatting, etc.) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `build` | Changes to build system or dependencies |
| `ci` | Changes to CI configuration |
| `chore` | Other changes that don't modify src or test files |
| `revert` | Reverts a previous commit |

### Examples

```bash
feat(planning): add drag-and-drop task reordering
fix(parser): handle empty task attributes correctly
docs: update installation instructions
test(parser): add tests for dataview syntax parsing
chore(deps): update typescript to 5.3.0
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development build with watch mode |
| `npm run build` | Build for production |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without changes |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run validate` | Run all checks (types, lint, format, tests) |

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Follow the gradual strictness settings in `tsconfig.json`
- Avoid `any` types when possible (configured as warning)
- Use interfaces for object shapes

### Code Style

- Code is automatically formatted with Prettier
- ESLint enforces code quality rules
- Pre-commit hooks run formatting and linting checks
- Use meaningful variable and function names
- Keep functions focused and single-purpose
- Add comments for complex logic, not obvious code

### React Components

- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use descriptive prop names
- Follow React Hooks rules (enforced by ESLint)

### File Organization

```
src/
  commands/       # Editor commands
  core/           # Core business logic (pure TypeScript)
    index/        # Task indexing
    matchers/     # Pattern matching
    operations/   # Task operations
    parsers/      # Text parsing
  events/         # Event handling
  lib/            # Shared utilities
  settings/       # Plugin settings
  types/          # TypeScript types
  ui/             # React components
  views/          # Obsidian view implementations
__tests__/
  __mocks__/      # Mock implementations (e.g., Obsidian API)
  core/           # Tests for core logic
  ui/             # Tests for UI components
```

## Testing

We use Jest for testing. Tests are located in the `__tests__` directory.

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Place tests in `__tests__/` directory mirroring the `src/` structure
- Name test files with `.test.ts` or `.test.tsx` extension
- Use the Obsidian mock from `__tests__/__mocks__/obsidian.ts`
- Focus on testing business logic in isolation
- Aim for meaningful coverage, not just high numbers

### Coverage

We track code coverage with Codecov. The CI pipeline uploads coverage reports automatically.

## Pull Request Guidelines

### Before Submitting

- [ ] Run `npm run validate` and fix any issues
- [ ] Add tests for new functionality
- [ ] Update documentation if needed
- [ ] Keep commits focused and atomic
- [ ] Use conventional commit messages

### PR Description

Include:
- What the PR does (clear summary)
- Why the change is needed
- How to test it
- Screenshots/GIFs for UI changes

### Review Process

- Maintainers will review your PR
- Address feedback promptly
- Be open to suggestions and changes
- CI checks must pass
- Code coverage should not decrease significantly

## Types of Contributions

### Bug Fixes

- Search existing issues first
- Provide reproduction steps
- Include expected vs actual behavior
- Add tests if applicable

### New Features

- Open an issue to discuss first
- Ensure it aligns with project goals
- Keep scope manageable
- Update documentation
- Add tests

### Documentation

- Fix typos and unclear explanations
- Add examples and use cases
- Improve setup instructions
- Keep it concise and clear

### Refactoring

- Explain the benefit
- Keep changes focused
- Don't mix refactoring with features
- Ensure tests still pass

## License

By contributing, you agree that your contributions will be licensed under the GNU General Public License v2.0, the same license as the project.

Task Planner is a fork of [Proletarian Wizard](https://github.com/cfe84/obsidian-pw) by cfe84, licensed under GPL v2.0. All contributions must comply with GPL v2 requirements.

## Questions?

- Open an issue for questions
- Check existing issues and PRs
- Be patient and respectful

Thank you for contributing!

# Contributing to Task Planner

Thank you for your interest in contributing to Task Planner! We welcome contributions from the community.

## Code of Conduct

Be respectful, professional, and constructive in all interactions. We're here to build great software together.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
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

4. Build the plugin:
   ```bash
   npm run build
   ```

5. Link to your Obsidian vault for testing:
   ```bash
   # Create a symlink or copy files to your vault's plugins folder
   export OBSIDIAN_PATH="/path/to/your/vault"
   npm run deploy
   ```

### Development Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Test your changes:
   - Reload Obsidian (Ctrl/Cmd + R)
   - Test affected features
   - Ensure no console errors

4. Build and verify:
   ```bash
   npm run build
   ```

5. Commit your changes:
   ```bash
   git commit -m "Description of your changes"
   ```

6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

7. Open a Pull Request

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict type checking
- Avoid `any` types when possible
- Use interfaces for object shapes

### Code Style

- Use tabs for indentation (matches Obsidian conventions)
- Use meaningful variable and function names
- Keep functions focused and single-purpose
- Add comments for complex logic, not obvious code

### React Components

- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use descriptive prop names

### File Organization

```
src/
  Commands/       # Editor commands
  domain/         # Core business logic (pure TypeScript)
  events/         # Event handling
  infrastructure/ # Platform integrations (Obsidian API)
  ui/             # React components
  Views/          # Obsidian view implementations
```

## Pull Request Guidelines

### Before Submitting

- Ensure your code builds without errors
- Test your changes thoroughly
- Update documentation if needed
- Keep commits focused and atomic

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

## Testing

Currently, the project doesn't have automated tests. When contributing:

- Manually test your changes
- Test edge cases
- Reload Obsidian to verify
- Check browser console for errors

## License

By contributing, you agree that your contributions will be licensed under the GNU General Public License v2.0, the same license as the project.

Task Planner is a fork of [Proletarian Wizard](https://github.com/cfe84/obsidian-pw) by cfe84, licensed under GPL v2.0. All contributions must comply with GPL v2 requirements.

## Questions?

- Open an issue for questions
- Check existing issues and PRs
- Be patient and respectful

Thank you for contributing!

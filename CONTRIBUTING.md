# Contributing to OrkaJS

Thank you for your interest in contributing to OrkaJS! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all skill levels.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/orkajs.git
   cd orkajs
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Build all packages:
   ```bash
   pnpm build
   ```
5. Run tests:
   ```bash
   pnpm test
   ```

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 9.0.0

### Project Structure

```
orkajs/
├── packages/           # All @orka-js/* packages
│   ├── core/          # @orka-js/core - Types, errors, utils
│   ├── openai/        # @orka-js/openai - OpenAI adapter
│   ├── anthropic/     # @orka-js/anthropic - Anthropic adapter
│   ├── agent/         # @orka-js/agent - Agent system
│   ├── tools/         # @orka-js/tools - Loaders, parsers, etc.
│   ├── cache/         # @orka-js/cache - Caching layer
│   └── ...            # Other packages
├── tests/             # Integration and unit tests
├── examples/          # Example usage
└── .changeset/        # Changesets for versioning
```

## Making Changes

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

Edit the relevant package(s) in `packages/`. Each package has:
- `src/` - Source code
- `tsconfig.json` - TypeScript config
- `tsup.config.ts` - Build config
- `package.json` - Package manifest

### 3. Add Tests

Add or update tests in `tests/` for your changes.

### 4. Build and Test

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

### 5. Create a Changeset

**This is required for any change that affects published packages.**

```bash
pnpm changeset
```

Follow the prompts:
1. Select the packages you modified (use space to select)
2. Choose the bump type:
   - `patch` - Bug fixes, internal refactors
   - `minor` - New features (backward compatible)
   - `major` - Breaking changes
3. Write a summary for the CHANGELOG

### 6. Commit Your Changes

```bash
git add -A
git commit -m "feat: add new feature"
# or
git commit -m "fix: resolve bug in X"
```

Commit message format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

## Pull Request Process

1. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a Pull Request on GitHub

3. Ensure all checks pass:
   - Build succeeds
   - Tests pass
   - No TypeScript errors

4. Request review from maintainers

5. Address any feedback

6. Once approved, your PR will be merged

## Coding Standards

### TypeScript

- Use strict TypeScript (`strict: true`)
- Export types explicitly
- Document public APIs with JSDoc comments

### Code Style

- Use 2-space indentation
- Use single quotes for strings
- No semicolons (unless required)
- Follow existing patterns in the codebase

### Testing

- Write unit tests for new functionality
- Ensure existing tests pass
- Aim for good coverage of edge cases

### Documentation

- Update README if adding new features
- Add JSDoc comments for public APIs
- Include examples for complex features

## Questions?

If you have questions, feel free to:
- Open an issue on GitHub
- Join our Discord community

Thank you for contributing! 🎉

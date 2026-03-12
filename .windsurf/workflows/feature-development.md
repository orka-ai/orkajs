---
description: Complete workflow for developing new features in OrkaJS packages - from code to npm publication
---

# 🚀 Feature Development Workflow

This workflow guides you through the complete process of developing, testing, versioning, and publishing new features in the OrkaJS monorepo.

---

## 📋 Pre-flight Checklist

Before starting any feature development:

```bash
# 1. Ensure you're on the correct branch
git checkout main
git pull origin main

# 2. Create a feature branch
git checkout -b feature/<feature-name>
# or for bug fixes:
git checkout -b fix/<bug-description>

# 3. Verify clean state
git status
pnpm install
```

---

## 🏗️ Phase 1: Development

### 1.1 Identify Target Package(s)

Determine which package(s) will be modified:

| Package | Path | Purpose |
|---------|------|---------|
| `@orka-js/core` | `packages/core/` | Types, errors, utils, chunker, knowledge |
| `@orka-js/openai` | `packages/openai/` | OpenAI adapter |
| `@orka-js/anthropic` | `packages/anthropic/` | Anthropic adapter |
| `@orka-js/mistral` | `packages/mistral/` | Mistral adapter |
| `@orka-js/ollama` | `packages/ollama/` | Ollama adapter |
| `@orka-js/memory` | `packages/memory/` | In-memory VectorDB |
| `@orka-js/pinecone` | `packages/pinecone/` | Pinecone adapter |
| `@orka-js/qdrant` | `packages/qdrant/` | Qdrant adapter |
| `@orka-js/chroma` | `packages/chroma/` | Chroma adapter |
| `@orka-js/agent` | `packages/agent/` | Agents (ReAct, PlanAndExecute, HITL) |
| `@orka-js/tools` | `packages/tools/` | Loaders, splitters, parsers, chains |
| `@orka-js/cache` | `packages/cache/` | Caching (Memory, Redis, CachedLLM) |
| `@orka-js/resilience` | `packages/resilience/` | Retry, fallback, ResilientLLM |
| `@orka-js/orchestration` | `packages/orchestration/` | Router, Consensus, Race, LoadBalancer |
| `@orka-js/workflow` | `packages/workflow/` | Multi-step workflows |
| `@orka-js/graph` | `packages/graph/` | Graph-based workflows |
| `@orka-js/evaluation` | `packages/evaluation/` | Metrics, assertions, reporters |
| `@orka-js/observability` | `packages/observability/` | Tracer, hooks, logging |
| `@orka-js/prompts` | `packages/prompts/` | Prompt versioning, registry |
| `@orka-js/memory-store` | `packages/memory-store/` | Conversation memory |
| `orkajs` | `packages/orkajs/` | Meta-package (re-exports all) |

### 1.2 Implement the Feature

```bash
# Navigate to the package
cd packages/<package-name>/src/

# Create or modify files
# Follow existing code patterns and conventions
```

**Code Standards:**
- ✅ Use TypeScript strict mode
- ✅ Export all public APIs from `index.ts`
- ✅ Add JSDoc comments for public functions/classes
- ✅ Follow existing naming conventions
- ✅ No `any` types unless absolutely necessary
- ✅ Handle errors with `OrkaError` from `@orka-js/core`

### 1.3 Update Exports

If adding new exports, update `packages/<package-name>/src/index.ts`:

```typescript
// Add new exports
export { MyNewClass } from './my-new-class.js';
export type { MyNewType } from './types.js';
```

**⚠️ IMPORTANT:** If the feature should be available in the meta-package `orkajs`, also update `packages/orkajs/src/index.ts`.

---

## 🧪 Phase 2: Testing

### 2.1 Write Unit Tests

Create tests in `tests/unit/<package-name>/`:

```bash
# Create test file
touch tests/unit/<package-name>/<feature-name>.test.ts
```

**Test file structure:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyNewClass } from '@orka-js/<package-name>';

describe('MyNewClass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something expected', async () => {
      // Arrange
      const instance = new MyNewClass();
      
      // Act
      const result = await instance.methodName();
      
      // Assert
      expect(result).toBeDefined();
    });

    it('should handle edge cases', async () => {
      // Test edge cases
    });

    it('should throw on invalid input', async () => {
      // Test error handling
      await expect(instance.methodName(null))
        .rejects.toThrow(OrkaError);
    });
  });
});
```

### 2.2 Run Tests

```bash
# Run all tests
// turbo
pnpm test

# Run tests for specific package
// turbo
pnpm vitest run tests/unit/<package-name>/

# Run tests in watch mode (development)
pnpm vitest tests/unit/<package-name>/

# Run with coverage
pnpm vitest run --coverage
```

**✅ All tests must pass before proceeding.**

### 2.3 Type Check

```bash
# Type check all packages
// turbo
pnpm typecheck

# Or check specific package
// turbo
pnpm --filter @orka-js/<package-name> typecheck
```

---

## 🔨 Phase 3: Build

### 3.1 Build All Packages

```bash
# Build entire monorepo (respects dependency order)
// turbo
pnpm build
```

### 3.2 Verify Build Output

```bash
# Check the built files exist
ls packages/<package-name>/dist/

# Expected files:
# - index.js (ESM)
# - index.cjs (CommonJS)
# - index.d.ts (TypeScript declarations)
# - index.d.cts (CTS declarations)
```

### 3.3 Test Build Locally (Optional)

```bash
# Link package locally for testing in another project
cd packages/<package-name>
pnpm link --global

# In test project
pnpm link --global @orka-js/<package-name>
```

---

## 📝 Phase 4: Versioning (Changesets)

### 4.1 Create a Changeset

**⚠️ REQUIRED for any code changes that will be published.**

```bash
# Interactive changeset creation
pnpm changeset
```

**OR create manually** (recommended for precision):

```bash
# Create changeset file manually
cat > .changeset/<descriptive-name>.md << 'EOF'
---
"@orka-js/<package-name>": <bump-type>
---

<description of changes>
EOF
```

### 4.2 Bump Type Selection

| Type | When to Use | Version Change |
|------|-------------|----------------|
| `patch` | Bug fixes, docs, refactoring (no API changes) | 1.0.0 → 1.0.1 |
| `minor` | New features (backward compatible) | 1.0.0 → 1.1.0 |
| `major` | Breaking changes (API incompatible) | 1.0.0 → 2.0.0 |

### 4.3 Changeset Description Best Practices

**Good examples:**
```markdown
---
"@orka-js/agent": minor
---

feat(agent): add support for streaming responses in ReActAgent

- Added `stream` option to ReActAgent.run()
- New `onToken` callback for real-time token streaming
- Backward compatible with existing code
```

```markdown
---
"@orka-js/core": patch
"@orka-js/openai": patch
---

fix(core): resolve memory leak in Knowledge class

- Fixed event listener cleanup in Knowledge.close()
- Updated OpenAI adapter to properly dispose resources
```

### 4.4 Apply Version Bump

```bash
# Apply all pending changesets
// turbo
pnpm changeset version

# Verify version was bumped correctly
cat packages/<package-name>/package.json | grep '"version"'
```

---

## 🏷️ Phase 5: Git Operations

### 5.1 Stage and Commit

```bash
# Stage all changes
git add -A

# Commit with conventional commit message
git commit -m "<type>(<scope>): <description>"
```

**Commit Message Format:**
```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code refactoring (no feature/fix)
- `test`: Adding/updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

**Examples:**
```bash
git commit -m "feat(agent): add streaming support to ReActAgent"
git commit -m "fix(core): resolve memory leak in Knowledge class"
git commit -m "docs(readme): update installation instructions"
```

### 5.2 Push to Remote

```bash
# Push feature branch
git push origin feature/<feature-name>
```

### 5.3 Create Pull Request

1. Open GitHub/GitLab
2. Create PR from `feature/<feature-name>` → `main`
3. Fill in PR template
4. Request review if needed
5. Wait for CI checks to pass

---

## 📦 Phase 6: Release & Publish

### 6.1 Merge to Main

After PR approval:
```bash
# Merge PR (via GitHub UI or CLI)
git checkout main
git pull origin main
```

### 6.2 Create Git Tag

```bash
# Create annotated tag for the release
git tag -a v<version> -m "Release v<version>"

# Example for meta-package release
git tag -a v3.0.3 -m "Release v3.0.3 - Add streaming support"

# For individual package releases
git tag -a @orka-js/agent@1.1.0 -m "@orka-js/agent v1.1.0 - Add streaming support"
```

### 6.3 Push Tags

```bash
# Push all tags
git push origin --tags

# Or push specific tag
git push origin v<version>
```

### 6.4 Publish to npm

```bash
# Build all packages first
// turbo
pnpm build

# Publish all changed packages
pnpm publish -r --access public --no-git-checks

# You will be prompted for npm OTP (2FA code)
```

### 6.5 Verify Publication

```bash
# Check package on npm
npm view @orka-js/<package-name> version

# Check meta-package
npm view orkajs version

# View README on npm
npm view orkajs readme | head -30
```

---

## 🔄 Quick Reference Commands

```bash
# === DEVELOPMENT ===
git checkout -b feature/<name>     # Create feature branch
pnpm install                        # Install dependencies

# === TESTING ===
pnpm test                           # Run all tests
pnpm typecheck                      # Type check

# === BUILDING ===
pnpm build                          # Build all packages

# === VERSIONING ===
pnpm changeset                      # Create changeset (interactive)
pnpm changeset version              # Apply version bumps

# === GIT ===
git add -A && git commit -m "..."   # Commit changes
git push origin <branch>            # Push branch
git tag -a v<ver> -m "..."          # Create tag
git push origin --tags              # Push tags

# === PUBLISHING ===
pnpm publish -r --access public --no-git-checks  # Publish to npm
```

---

## ⚠️ Common Pitfalls

### 1. Forgetting to update meta-package
If your feature should be accessible via `import { X } from 'orkajs'`, update `packages/orkajs/src/index.ts`.

### 2. Wrong changeset bump type
- Use `patch` for docs/fixes
- Use `minor` for new features
- Use `major` for breaking changes

### 3. Not running tests before commit
Always run `pnpm test && pnpm typecheck` before committing.

### 4. Publishing without building
Always run `pnpm build` before `pnpm publish`.

### 5. Forgetting to copy README to package
The README must exist in `packages/<package-name>/README.md` to appear on npm.

---

## 📊 Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEATURE DEVELOPMENT FLOW                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. CREATE BRANCH                                                │
│     git checkout -b feature/<name>                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. DEVELOP                                                      │
│     - Write code in packages/<pkg>/src/                          │
│     - Update exports in index.ts                                 │
│     - Follow code standards                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. TEST                                                         │
│     pnpm test && pnpm typecheck                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. BUILD                                                        │
│     pnpm build                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. CHANGESET                                                    │
│     pnpm changeset → select packages → select bump type          │
│     pnpm changeset version                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. COMMIT & PUSH                                                │
│     git add -A && git commit -m "feat(<scope>): <desc>"          │
│     git push origin feature/<name>                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. PULL REQUEST                                                 │
│     Create PR → Review → Merge to main                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. TAG & RELEASE                                                │
│     git tag -a v<version> -m "Release v<version>"                │
│     git push origin --tags                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  9. PUBLISH                                                      │
│     pnpm build && pnpm publish -r --access public --no-git-checks│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                           ✅ DONE
```

---

## 🎯 AI Assistant Instructions

When following this workflow, the AI assistant should:

1. **Always verify current state** before making changes (`git status`, `pnpm test`)
2. **Create changesets manually** using file creation (not interactive `pnpm changeset`)
3. **Use `patch` by default** unless explicitly told otherwise
4. **Run tests after every code change**
5. **Build before publishing**
6. **Commit with conventional commit messages**
7. **Never skip the changeset step** for publishable changes
8. **Copy README to package folder** if updating documentation
9. **Update meta-package exports** if adding new public APIs
10. **Verify npm publication** after publishing

---

*Last updated: March 2026*
*OrkaJS Monorepo v3.x*

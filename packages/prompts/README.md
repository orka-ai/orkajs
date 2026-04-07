# @orka-js/prompts

Prompt versioning, registry, diffing, and file persistence for OrkaJS — version, rollback, and diff your prompts like code.

## Installation

```bash
npm install @orka-js/prompts
```

## Quick Start

```typescript
import { PromptRegistry } from '@orka-js/prompts';

const registry = new PromptRegistry();

// Register a prompt (uses {{ variable }} syntax)
registry.register('qa', 'Answer the following question: {{ question }}\n\nContext: {{ context }}');

// Render it with variables
const prompt = registry.render('qa', {
  variables: { question: 'What is OrkaJS?', context: 'OrkaJS is an AI agent framework.' },
});

console.log(prompt);
// "Answer the following question: What is OrkaJS?
//  Context: OrkaJS is an AI agent framework."
```

## API

### `PromptRegistry`

Central registry for all your prompts. Each call to `.register()` creates a new version; the latest is active by default.

```typescript
import { PromptRegistry, FilePromptPersistence } from '@orka-js/prompts';

const registry = new PromptRegistry({
  persistence?: PromptPersistence,  // optional — persist to disk or a database
});

// Load persisted prompts on startup
await registry.load();
```

#### Methods

**`.register(name, template, metadata?): PromptTemplate`**

Register a new version of a prompt. All previous versions are deactivated; the new one becomes active.

```typescript
registry.register('summarize', 'Summarize this in {{ language }}: {{ text }}');
registry.register('summarize', 'Provide a {{ style }} summary in {{ language }}: {{ text }}');
// Now at version 2
```

**`.get(name, version?): PromptTemplate | undefined`**

Retrieve the active version (or a specific version).

```typescript
const prompt = registry.get('summarize');      // active version
const v1     = registry.get('summarize', 1);   // specific version
```

**`.render(name, options): string`**

Render a prompt by substituting `{{ variable }}` placeholders. Throws if any variables are missing.

```typescript
const text = registry.render('summarize', {
  variables: { language: 'English', style: 'bullet-point', text: '...' },
  version: 2,  // optional — defaults to active version
});
```

**`.diff(name, fromVersion, toVersion): PromptDiff`**

Compare two versions of a prompt.

```typescript
const diff = registry.diff('summarize', 1, 2);
// diff.changes → [{ type: 'modified', field: 'template', oldValue: '...', newValue: '...' }]
// diff.changes → [{ type: 'added', field: 'variable', newValue: 'style' }]
```

**`.setActive(name, version): void`**

Activate a specific version (useful for rollback).

```typescript
registry.setActive('summarize', 1);
```

**`.rollback(name): PromptTemplate | undefined`**

Activate the previous version.

```typescript
const prev = registry.rollback('summarize');
```

**`.getVersions(name): PromptTemplate[]`**

Return all registered versions for a prompt.

**`.getActiveVersion(name): number | undefined`**

Return the currently active version number.

**`.list(): string[]`**

List all registered prompt names.

**`.delete(name): boolean`**

Remove all versions of a prompt from the registry.

**`.save(): Promise<void>` / `.load(): Promise<void>`**

Persist or restore the registry (requires a `PromptPersistence` implementation).

---

### `FilePromptPersistence`

Save and load the registry as a JSON file on disk.

```typescript
import { PromptRegistry, FilePromptPersistence } from '@orka-js/prompts';

const persistence = new FilePromptPersistence({ dir: './prompts' });
const registry = new PromptRegistry({ persistence });

await registry.load();      // reads from ./prompts/registry.json

registry.register('greet', 'Hello, {{ name }}!');

await registry.save();      // writes to ./prompts/registry.json
```

---

## Types

```typescript
import type {
  PromptTemplate,
  PromptRenderOptions,
  PromptDiff,
  PromptChange,
  PromptRegistryConfig,
  PromptPersistence,
} from '@orka-js/prompts';
```

**`PromptTemplate`**

```typescript
interface PromptTemplate {
  id: string;
  version: number;
  name: string;
  template: string;
  variables: string[];      // auto-extracted {{ var }} names
  metadata?: Record<string, unknown>;
  createdAt: number;
  isActive: boolean;
}
```

**`PromptDiff`**

```typescript
interface PromptDiff {
  fromVersion: number;
  toVersion: number;
  changes: PromptChange[];
}

interface PromptChange {
  type: 'added' | 'removed' | 'modified';
  field: string;        // 'template' | 'variable'
  oldValue?: string;
  newValue?: string;
}
```

**Custom `PromptPersistence`**

Implement this interface to store prompts anywhere (database, S3, etc.):

```typescript
interface PromptPersistence {
  save(prompts: Map<string, PromptTemplate[]>): Promise<void>;
  load(): Promise<Map<string, PromptTemplate[]>>;
}
```

## Related Packages

- [`@orka-js/core`](../core) — Core types
- [`@orka-js/tools`](../tools) — `PromptTemplate`, `ChatPromptTemplate`, `FewShotPromptTemplate` (runtime rendering)
- [`orkajs`](../orkajs) — Full OrkaJS bundle

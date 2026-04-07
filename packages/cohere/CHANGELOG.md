# @orka-js/cohere

## 1.0.6

### Patch Changes

- chore: update packages
- Updated dependencies
  - @orka-js/core@1.5.1

## 1.0.5

### Patch Changes

- Fix: Replace workspace:\* dependencies with actual npm versions

  This fixes a critical bug where packages were published with workspace:\*
  dependencies that cannot be resolved when installed from npm.

## 1.0.4

### Patch Changes

- Updated dependencies
  - @orka-js/core@1.3.2

## 1.0.3

### Patch Changes

- Updated dependencies [93651a4]
  - @orka-js/core@1.3.1

## 1.0.2

### Patch Changes

- Updated dependencies [674e66d]
  - @orka-js/core@1.3.0

## 1.0.1

### Patch Changes

- feat: add new LLM providers and streaming RAG

  - @orka-js/google: Google AI (Gemini) adapter with streaming support
  - @orka-js/cohere: Cohere adapter with streaming support
  - @orka-js/replicate: Replicate adapter with streaming support
  - @orka-js/core: Add Orka class with ask(), streamAsk(), streamAskComplete() for streaming RAG

- Updated dependencies
  - @orka-js/core@1.2.1

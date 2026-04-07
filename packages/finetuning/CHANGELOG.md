# @orka-js/finetuning

## 1.1.3

### Patch Changes

- chore: update packages
- Updated dependencies
  - @orka-js/core@1.5.1

## 1.1.2

### Patch Changes

- Fix: Replace workspace:\* dependencies with actual npm versions

  This fixes a critical bug where packages were published with workspace:\*
  dependencies that cannot be resolved when installed from npm.

## 1.1.1

### Patch Changes

- Updated dependencies
  - @orka-js/core@1.3.2

## 1.1.0

### Minor Changes

- 93651a4: feat(finetuning): Add Fine-tuning Orchestration package

  - DatasetValidator: Validate JSONL datasets for fine-tuning compatibility
  - FineTuningOrchestrator: Create, monitor, and manage fine-tuning jobs
  - FeedbackCollector: Collect user feedback and convert to training datasets
  - Multi-provider support: OpenAI, Anthropic, Mistral, Together, Anyscale
  - Cost estimation before training
  - Model versioning and tracking

### Patch Changes

- Updated dependencies [93651a4]
  - @orka-js/core@1.3.1

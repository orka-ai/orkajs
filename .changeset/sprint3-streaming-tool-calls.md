---
"@orka-js/core": minor
"@orka-js/anthropic": minor
"@orka-js/openai": minor
"@orka-js/agent": minor
---

feat(streaming): streaming tool call support across adapters + StreamingToolAgent

- `@orka-js/core`: new `StreamToolDefinition` interface + `tools`/`toolChoice` on `StreamGenerateOptions`
- `@orka-js/anthropic`: accumulate `content_block` deltas and emit `tool_call` events during stream
- `@orka-js/openai`: accumulate incremental `tool_calls` deltas and emit `tool_call` events before `done`
- `@orka-js/agent`: new `StreamingToolAgent` — streams tokens in real time, executes tools in parallel, yields `tool_result` events, continues streaming

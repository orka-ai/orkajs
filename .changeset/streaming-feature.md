---
"@orka-js/core": minor
"@orka-js/openai": minor
"@orka-js/anthropic": minor
"@orka-js/mistral": minor
"@orka-js/ollama": minor
---

feat: Add real-time token streaming for all LLM adapters

- Add streaming types and utilities in @orka-js/core (StreamingLLMAdapter, LLMStreamEvent, StreamResult, etc.)
- Implement stream() and streamGenerate() methods for OpenAI, Anthropic, Mistral, and Ollama adapters
- Support for token-by-token streaming with onToken and onEvent callbacks
- Time to First Token (TTFT) tracking for performance monitoring
- AbortController support for stream cancellation
- Extended thinking support for Claude models (ThinkingEvent)
- Event types: token, content, tool_call, thinking, usage, done, error
- Helper functions: isStreamingAdapter(), createStreamEvent(), consumeStream(), parseSSEStream()

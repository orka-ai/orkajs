---
'@orka-js/agent': minor
---

Add compact_conversation tool for autonomous context compression

- Add `createCompactConversationTool()` factory function
- Agents can now autonomously decide when to compress conversation history
- Add `COMPACT_CONVERSATION_PROMPT_ADDITION` for system prompt guidance
- Tool returns detailed metrics: messages compressed, tokens saved, summary
- Includes comprehensive documentation and usage examples

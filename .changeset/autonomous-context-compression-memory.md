---
'@orka-js/memory-store': minor
---

Add autonomous context compression with compress() method

- Add `compress()` method to SummaryMemory for on-demand compression
- Add `CompressResult` interface with detailed compression metrics
- Returns success status, summary, messages compressed, and tokens saved
- Supports progressive compression with existing summaries
- Handles edge cases (not enough messages, compression in progress, errors)

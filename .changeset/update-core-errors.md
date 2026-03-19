---
"@orka-js/core": patch
---

feat(core): Add new error codes for MCP and fine-tuning

- NOT_FOUND: Resource not found errors
- INVALID_INPUT: Invalid input validation errors
- INVALID_STATE: Invalid state errors
- NETWORK_ERROR: Network connectivity errors
- EXTERNAL_SERVICE_ERROR: External service errors
- Add isRetryable() instance method to OrkaError

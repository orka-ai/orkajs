---
"@orka-js/core": minor
---

feat(core): add PII Guard - Data Protection Layer for RGPD compliance

- Added `PIIGuard` class for detecting and redacting sensitive information
- Detects: emails, phone numbers, credit cards, SSN, IBAN, IP addresses, dates of birth
- Configurable detection types and confidence thresholds
- Type-specific placeholders: `[EMAIL]`, `[PHONE]`, `[CREDIT_CARD]`, etc.
- Custom patterns support for organization-specific PII
- Allow list to exclude specific patterns from redaction
- `redactBeforeLLM` option for automatic protection before API calls
- `throwOnPII` option for strict mode (throws error instead of redacting)
- Callback `onPIIDetected` for logging/monitoring
- Convenience functions: `redactPII()`, `detectPII()`, `createPIIGuard()`
- New error code: `PII_DETECTED`

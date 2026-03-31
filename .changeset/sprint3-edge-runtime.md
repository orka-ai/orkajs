---
"@orka-js/core": minor
"@orka-js/cache": patch
"@orka-js/agent": minor
"@orka-js/tools": patch
---

feat(edge): replace Node.js crypto/Buffer with Web APIs for Edge runtime compatibility

- `@orka-js/core` utils: `crypto.getRandomValues` instead of `randomBytes`
- `@orka-js/cache` cached-llm: FNV-1a hash instead of `createHash('sha256')`
- `@orka-js/agent` hitl-agent: `crypto.getRandomValues` instead of `crypto.randomBytes`
- `@orka-js/tools` github-loader: `atob` + `TextDecoder` instead of `Buffer.from`

All four packages now run in Vercel Edge and Cloudflare Workers without Node.js polyfills.

# @orka-js/realtime

Real-time voice agents for OrkaJS — speech-to-text, text-to-speech, and live conversation processing.

## Installation

```bash
npm install @orka-js/realtime
```

## Quick Start

```typescript
import { RealtimeAgent, OpenAISTTAdapter, OpenAITTSAdapter } from '@orka-js/realtime';
import { OpenAIAdapter } from '@orka-js/openai';
import { readFileSync } from 'fs';

const apiKey = process.env.OPENAI_API_KEY!;

const agent = new RealtimeAgent({
  config: {
    goal: 'You are a helpful voice assistant. Answer questions clearly and concisely.',
    tts: true,
  },
  llm: new OpenAIAdapter({ apiKey }),
  stt: new OpenAISTTAdapter({ apiKey }),
  tts: new OpenAITTSAdapter({ apiKey, voice: 'nova' }),
});

// Process a single audio buffer
const audioBuffer = readFileSync('question.wav');
const result = await agent.process(audioBuffer, 'audio/wav');

console.log('User said:', result.transcript);
console.log('Agent replied:', result.response);
// result.audio contains the synthesized response as a Buffer

// Stream events as they happen
for await (const event of agent.processStream(audioBuffer)) {
  if (event.type === 'transcript') console.log('Heard:', event.text);
  if (event.type === 'token') process.stdout.write(event.content);
  if (event.type === 'audio_chunk') sendToClient(event.data);
  if (event.type === 'done') console.log('Finished:', event.response);
  if (event.type === 'error') console.error('Error:', event.message);
}
```

### WebSocket server

```typescript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', agent.wsHandler());
// Clients send binary audio frames; the agent streams back JSON RealtimeEvent objects
```

## API

### `RealtimeAgent`

The core voice agent. Wires together an STT adapter, an LLM (via `StreamingToolAgent`), and an optional TTS adapter into a single pipeline.

```typescript
new RealtimeAgent(options: RealtimeAgentOptions)
```

**`RealtimeAgentOptions`**

| Field | Type | Description |
|-------|------|-------------|
| `config` | `RealtimeAgentConfig` | Agent behaviour (goal, language, TTS on/off) |
| `llm` | `LLMAdapter` | LLM adapter for generating responses |
| `stt` | `STTAdapter` | Speech-to-text adapter |
| `tts` | `TTSAdapter` | *(optional)* Text-to-speech adapter |
| `tools` | `Tool[]` | *(optional)* Tools the LLM can call during conversation |

**`RealtimeAgentConfig`**

| Field | Type | Description |
|-------|------|-------------|
| `goal` | `string` | System goal / personality for the voice agent |
| `systemPrompt` | `string` | *(optional)* Custom system prompt injected into the LLM |
| `language` | `string` | *(optional)* Language hint for STT (ISO-639-1, e.g. `'en'`, `'fr'`) |
| `tts` | `boolean` | *(optional)* Whether to synthesize audio output (default `true` when a TTS adapter is provided) |

**Methods**

#### `agent.process(audio, audioFormat?)`

Full pipeline — transcribe, run LLM, synthesize. Returns `RealtimeProcessResult`.

```typescript
const result: RealtimeProcessResult = await agent.process(audioBuffer, 'audio/wav');
// result.transcript  — what the user said
// result.response    — the LLM's text reply
// result.audio       — synthesized audio Buffer (if TTS enabled)
```

#### `agent.processStream(audio, audioFormat?)`

Returns an `AsyncIterable<RealtimeEvent>` that yields events as the pipeline progresses. Useful for low-latency streaming to clients.

#### `agent.wsHandler()`

Returns a WebSocket connection handler (compatible with the `ws` package). Clients send binary audio; the server streams back JSON-serialized `RealtimeEvent` objects.

---

### `OpenAISTTAdapter`

Speech-to-text using the OpenAI Whisper API.

```typescript
new OpenAISTTAdapter({
  apiKey: string,
  model?: string,       // default: 'whisper-1'
  baseURL?: string,     // default: 'https://api.openai.com/v1'
  timeoutMs?: number,   // default: 120000
})
```

Implements `STTAdapter`:

```typescript
interface STTAdapter {
  transcribe(audio: Buffer | ArrayBuffer, format?: string): Promise<string>;
}
```

---

### `OpenAITTSAdapter`

Text-to-speech using the OpenAI TTS API. Supports both buffered and streamed (sentence-by-sentence) synthesis.

```typescript
new OpenAITTSAdapter({
  apiKey: string,
  model?: string,  // default: 'tts-1'  |  'tts-1-hd'
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',  // default: 'alloy'
  baseURL?: string,
  timeoutMs?: number,  // default: 60000
})
```

Implements `TTSAdapter`:

```typescript
interface TTSAdapter {
  synthesize(text: string, options?: TTSSynthesizeOptions): Promise<Buffer>;
  synthesizeStream?(text: string, options?: TTSSynthesizeOptions): AsyncIterable<Buffer>;
}

interface TTSSynthesizeOptions {
  voice?: string;
  speed?: number;
  format?: string;  // 'mp3' | 'opus' | 'aac' | 'flac' | 'wav'
}
```

`synthesizeStream` splits the input on sentence boundaries for lower first-audio latency.

---

### Types

#### `RealtimeEvent`

Discriminated union emitted by `processStream`:

| `type` | Extra fields | Description |
|--------|--------------|-------------|
| `'transcript'` | `text: string` | STT result — what the user said |
| `'token'` | `content: string` | Streaming LLM token |
| `'tool_call'` | `name, args` | LLM invoked a tool |
| `'tool_result'` | `name, result` | Tool returned a result |
| `'audio_chunk'` | `data: Buffer` | TTS audio chunk |
| `'done'` | `transcript, response, audio?` | Pipeline complete |
| `'error'` | `error: Error, message` | An error occurred |

#### `RealtimeProcessResult`

```typescript
interface RealtimeProcessResult {
  transcript: string;   // transcribed user speech
  response: string;     // LLM text response
  audio?: Buffer;       // synthesized audio (if TTS enabled)
}
```

## Related Packages

- [`@orka-js/core`](../core) — Core types and LLM adapter interfaces
- [`@orka-js/agent`](../agent) — `StreamingToolAgent` used internally
- [`@orka-js/multimodal`](../multimodal) — Vision and audio utilities
- [`orkajs`](../orkajs) — Full bundle

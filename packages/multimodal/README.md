# @orka-js/multimodal

Multimodal agents and utilities for vision and audio processing in OrkaJS.

## Installation

```bash
npm install @orka-js/multimodal
```

## Quick Start

```typescript
import { VisionAgent, analyzeImage, transcribeAudio } from '@orka-js/multimodal';
import { OpenAIAdapter } from '@orka-js/openai';

const llm = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY });

// Standalone vision utility
const result = await analyzeImage(llm, {
  type: 'url',
  url: 'https://example.com/chart.png',
}, {
  prompt: 'Describe the trends shown in this chart.',
});
console.log(result.analysis);

// Vision agent for repeated tasks
const agent = new VisionAgent({ llm });

const description = await agent.describe({ type: 'url', url: 'https://example.com/photo.jpg' });
console.log(description.result);
// { description: '...', objects: ['car', 'tree'], colors: ['blue', 'green'], scene: 'outdoor' }

const text = await agent.extractText({ type: 'url', url: 'https://example.com/invoice.png' });
console.log(text.result); // extracted OCR text

// Multimodal agent combining vision + audio
import { MultimodalAgent } from '@orka-js/multimodal';

const multiAgent = new MultimodalAgent({ llm, audioAdapter: myAudioAdapter });

const response = await multiAgent.ask('What is happening in this image?', {
  images: [{ type: 'url', url: 'https://example.com/scene.jpg' }],
});
console.log(response);
```

## API

### Vision utilities

#### `analyzeImage(llm, image, options?)`

Analyze an image using a vision-capable LLM. Returns a `VisionAnalysisResult` with `analysis`, `usage`, `model`, and `latencyMs`.

```typescript
const result = await analyzeImage(llm, { type: 'url', url: '...' }, {
  prompt: 'What objects are in this image?',
  detail: 'high',       // 'auto' | 'low' | 'high'
  maxTokens: 1024,
  temperature: 0.3,
});
```

#### `describeImage(llm, image, options?)`

Returns a structured `ImageDescription` with `description`, `objects`, `text`, `colors`, `scene`, and `confidence`.

#### `extractTextFromImage(llm, image, options?)`

Performs OCR on an image. Returns an `OCRResult` with `text`, `language`, `blocks`, and `latencyMs`.

#### `compareImages(llm, image1, image2, options?)`

Compares two images and describes their similarities and differences. Returns a `VisionAnalysisResult`.

#### `isVisionCapable(llm)`

Type guard — returns `true` if the LLM adapter supports vision (e.g. GPT-4o, Claude 3+).

---

### Audio utilities

#### `transcribeAudio(adapter, audio, options?)`

Transcribes audio to text. Returns an `AudioProcessingResult` with `text`, `language`, `duration`, `words`, `segments`, and `latencyMs`.

```typescript
const result = await transcribeAudio(audioAdapter, {
  type: 'url',
  url: 'https://example.com/recording.mp3',
}, {
  language: 'en',
  includeTimestamps: true,
});
```

#### `synthesizeSpeech(adapter, text, options?)`

Converts text to speech. Returns a `SpeechSynthesisResult` with `audio` (ArrayBuffer), `format`, and `latencyMs`.

```typescript
const speech = await synthesizeSpeech(audioAdapter, 'Hello, world!', {
  voice: 'nova',   // 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  format: 'mp3',
  speed: 1.0,
});
```

#### `isAudioCapable(adapter)`

Type guard — returns `true` if the adapter implements the `AudioLLMAdapter` interface (has `transcribe` method).

---

### Agents

#### `VisionAgent`

Specialized agent for image understanding tasks. Requires a vision-capable LLM.

```typescript
const agent = new VisionAgent({
  llm,                          // required — must be vision-capable
  systemPrompt?: string,
  detail?: 'auto' | 'low' | 'high',
  maxTokens?: number,
  temperature?: number,
});

await agent.analyze(image, prompt?)  // → VisionTaskResult
await agent.describe(image)          // → VisionTaskResult (structured ImageDescription)
await agent.extractText(image)       // → VisionTaskResult (OCR)
await agent.ask(image, question)     // → string
await agent.runTasks(tasks)          // → VisionTaskResult[]
```

#### `AudioAgent`

Specialized agent for audio processing tasks.

```typescript
const agent = new AudioAgent({
  adapter,                        // required — AudioLLMAdapter
  defaultLanguage?: string,
  defaultVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
  defaultFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm',
});

await agent.transcribe(audio, options?)     // → AudioTaskResult
await agent.speak(text, options?)           // → AudioTaskResult
await agent.runTasks(tasks)                 // → AudioTaskResult[]
await agent.transcribeAndProcess(audio, fn) // → { transcription, processed, latencyMs }
```

#### `MultimodalAgent`

Combines vision and audio in a single agent. Accepts mixed text, image, and audio inputs in one call.

```typescript
const agent = new MultimodalAgent({
  llm,                    // required
  audioAdapter?,          // optional — enables audio transcription
  systemPrompt?,
  maxTokens?,
  temperature?,
});

agent.supportsVision   // boolean
agent.supportsAudio    // boolean

await agent.process({ text?, images?, audio? })         // → MultimodalResult
await agent.ask(question, { images?, audio? })          // → string
await agent.analyzeImages(images, question)             // → string
await agent.processAudio(audio, question?)              // → MultimodalResult
await agent.analyzeMultimodal(images, audio, question)  // → MultimodalResult
```

---

### Types

| Type | Description |
|------|-------------|
| `ImageInput` | `{ type: 'url', url }` \| `{ type: 'base64', data, mimeType }` \| `{ type: 'file', path }` |
| `AudioInput` | `{ type: 'url', url }` \| `{ type: 'base64', data, format? }` \| `{ type: 'buffer', data }` \| `{ type: 'blob', data }` |
| `VisionAnalysisResult` | `{ analysis, usage, model, latencyMs }` |
| `ImageDescription` | `{ description, objects?, text?, colors?, scene?, confidence? }` |
| `OCRResult` | `{ text, language?, blocks?, latencyMs }` |
| `AudioProcessingResult` | `{ text, language?, duration?, words?, segments?, latencyMs }` |
| `MultimodalResult` | `{ response, transcriptions?, usage, latencyMs }` |
| `CrossModalRetrievalResult` | `{ results: Array<{ id, content, modality, score, metadata? }>, latencyMs }` |

## Related Packages

- [`@orka-js/core`](../core) — Core types and LLM adapter interfaces
- [`@orka-js/agent`](../agent) — Base agent primitives
- [`@orka-js/realtime`](../realtime) — Real-time voice agents (STT/TTS pipeline)
- [`orkajs`](../orkajs) — Full bundle

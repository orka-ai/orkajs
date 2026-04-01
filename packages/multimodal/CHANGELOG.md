# @orka-js/multimodal

## 3.0.0

### Patch Changes

- Updated dependencies [e4c8e29]
- Updated dependencies [e4c8e29]
  - @orka-js/core@1.5.0
  - @orka-js/anthropic@1.2.0
  - @orka-js/openai@1.3.0

## 2.0.3

### Patch Changes

- Fix: Replace workspace:\* dependencies with actual npm versions

  This fixes a critical bug where packages were published with workspace:\*
  dependencies that cannot be resolved when installed from npm.

- Updated dependencies
  - @orka-js/anthropic@1.1.5
  - @orka-js/openai@1.2.3

## 2.0.2

### Patch Changes

- Updated dependencies
  - @orka-js/core@1.3.2
  - @orka-js/anthropic@1.1.4
  - @orka-js/openai@1.2.2

## 2.0.1

### Patch Changes

- Updated dependencies [93651a4]
  - @orka-js/core@1.3.1
  - @orka-js/anthropic@1.1.3
  - @orka-js/openai@1.2.1

## 2.0.0

### Minor Changes

- 19905d4: feat: Add multimodal support with Vision and Audio capabilities

  ## @orka-js/multimodal (NEW PACKAGE)

  New package for advanced multimodal workflows:

  ### Vision Utilities

  - `analyzeImage()` - Analyze images with custom prompts
  - `describeImage()` - Get structured image descriptions
  - `extractTextFromImage()` - OCR text extraction
  - `compareImages()` - Compare two images
  - `isVisionCapable()` - Check adapter vision support

  ### Audio Utilities

  - `transcribeAudio()` - Transcribe audio with Whisper
  - `synthesizeSpeech()` - Text-to-speech generation
  - `isAudioCapable()` - Check adapter audio support

  ### Agents

  - `VisionAgent` - Specialized agent for image understanding tasks
  - `AudioAgent` - Specialized agent for audio processing
  - `MultimodalAgent` - Combined vision + audio agent for cross-modal workflows

  ### Types

  - `ImageInput`, `AudioInput` - Unified input types
  - `VisionAnalysisResult`, `OCRResult` - Result types
  - `MultimodalMessage` - Cross-modal message type
  - `VisionLLMAdapter`, `AudioLLMAdapter` - Capability interfaces

  ## @orka-js/openai

  ### Audio API Support

  - `adapter.transcribe()` - Whisper transcription with timestamps
  - `adapter.textToSpeech()` - TTS with multiple voices (alloy, echo, fable, onyx, nova, shimmer)
  - New config options: `whisperModel`, `ttsModel`, `ttsVoice`

### Patch Changes

- Updated dependencies [19905d4]
  - @orka-js/openai@1.2.0

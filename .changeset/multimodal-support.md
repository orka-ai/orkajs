---
"@orka-js/multimodal": minor
"@orka-js/openai": minor
---

feat: Add multimodal support with Vision and Audio capabilities

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

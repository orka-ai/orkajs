/**
 * @orka-js/multimodal
 * Multimodal utilities and agents for OrkaJS
 */

// Types
export type {
  ImageInput,
  AudioInput,
  VisionAnalysisOptions,
  VisionAnalysisResult,
  ImageDescription,
  OCRResult,
  AudioProcessingOptions,
  AudioProcessingResult,
  MultimodalMessage,
  CrossModalRetrievalOptions,
  CrossModalRetrievalResult,
} from './types.js';

// Vision utilities
export {
  analyzeImage,
  describeImage,
  extractTextFromImage,
  compareImages,
  isVisionCapable,
} from './vision.js';

// Audio utilities
export {
  transcribeAudio,
  synthesizeSpeech,
  isAudioCapable,
} from './audio.js';

// Multimodal agents
export {
  VisionAgent,
  type VisionAgentConfig,
} from './agents/vision-agent.js';

export {
  AudioAgent,
  type AudioAgentConfig,
} from './agents/audio-agent.js';

export {
  MultimodalAgent,
  type MultimodalAgentConfig,
} from './agents/multimodal-agent.js';

/**
 * Audio utilities for multimodal processing
 */

import type {
  AudioInput,
  AudioProcessingOptions,
  AudioProcessingResult,
  AudioLLMAdapter,
} from './types.js';

/**
 * Check if an adapter supports audio processing
 */
export function isAudioCapable(adapter: unknown): adapter is AudioLLMAdapter {
  return (
    typeof adapter === 'object' &&
    adapter !== null &&
    'transcribe' in adapter &&
    typeof (adapter as AudioLLMAdapter).transcribe === 'function'
  );
}

/**
 * Convert AudioInput to appropriate format for transcription
 */
async function audioInputToBlob(audio: AudioInput): Promise<Blob> {
  switch (audio.type) {
    case 'url': {
      const response = await fetch(audio.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio from URL: ${response.status}`);
      }
      return response.blob();
    }
    case 'base64': {
      const binaryString = atob(audio.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const mimeType = audio.format ? `audio/${audio.format}` : 'audio/wav';
      return new Blob([bytes], { type: mimeType });
    }
    case 'buffer':
      return new Blob([audio.data], { type: 'audio/wav' });
    case 'blob':
      return audio.data;
    default:
      throw new Error('Unknown audio input type');
  }
}

/**
 * Transcribe audio to text using an audio-capable adapter
 */
export async function transcribeAudio(
  adapter: AudioLLMAdapter,
  audio: AudioInput,
  options: AudioProcessingOptions = {}
): Promise<AudioProcessingResult> {
  if (!isAudioCapable(adapter)) {
    throw new Error('Adapter does not support audio transcription');
  }

  const startTime = Date.now();
  const audioBlob = await audioInputToBlob(audio);

  const result = await adapter.transcribe(audioBlob, {
    language: options.language,
    prompt: options.prompt,
    responseFormat: options.includeTimestamps ? 'verbose_json' : 'json',
    temperature: options.temperature,
  });

  return {
    text: result.text,
    language: result.language,
    duration: result.duration,
    words: result.words,
    segments: result.segments,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Text-to-Speech options
 */
export interface SpeechSynthesisOptions {
  /** Voice to use */
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  /** Output format */
  format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  /** Speed (0.25 to 4.0) */
  speed?: number;
}

/**
 * Text-to-Speech result
 */
export interface SpeechSynthesisResult {
  /** Audio data as ArrayBuffer */
  audio: ArrayBuffer;
  /** Format of the audio */
  format: string;
  /** Processing time in ms */
  latencyMs: number;
}

/**
 * Convert text to speech using an audio-capable adapter
 */
export async function synthesizeSpeech(
  adapter: AudioLLMAdapter,
  text: string,
  options: SpeechSynthesisOptions = {}
): Promise<SpeechSynthesisResult> {
  if (!('textToSpeech' in adapter) || typeof adapter.textToSpeech !== 'function') {
    throw new Error('Adapter does not support text-to-speech');
  }

  const startTime = Date.now();
  const format = options.format ?? 'mp3';

  const audio = await adapter.textToSpeech(text, {
    voice: options.voice,
    responseFormat: format,
    speed: options.speed,
  });

  return {
    audio,
    format,
    latencyMs: Date.now() - startTime,
  };
}

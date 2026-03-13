/**
 * AudioAgent - Agent specialized for audio processing tasks
 */

import type { AudioInput, AudioProcessingOptions, AudioLLMAdapter } from '../types.js';
import { transcribeAudio, synthesizeSpeech, isAudioCapable, type SpeechSynthesisOptions } from '../audio.js';

export interface AudioAgentConfig {
  /** Audio adapter (must support transcription/TTS) */
  adapter: AudioLLMAdapter;
  /** Default language for transcription */
  defaultLanguage?: string;
  /** Default voice for TTS */
  defaultVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  /** Default audio format for TTS */
  defaultFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
}

export interface TranscriptionTask {
  type: 'transcribe';
  audio: AudioInput;
  options?: AudioProcessingOptions;
}

export interface SpeechTask {
  type: 'speak';
  text: string;
  options?: SpeechSynthesisOptions;
}

export type AudioTask = TranscriptionTask | SpeechTask;

export interface AudioTaskResult {
  task: 'transcribe' | 'speak';
  result: string | ArrayBuffer;
  metadata?: {
    language?: string;
    duration?: number;
    format?: string;
  };
  latencyMs: number;
}

/**
 * AudioAgent - Specialized agent for audio processing
 */
export class AudioAgent {
  private adapter: AudioLLMAdapter;
  private defaultLanguage?: string;
  private defaultVoice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  private defaultFormat: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

  constructor(config: AudioAgentConfig) {
    if (!isAudioCapable(config.adapter)) {
      throw new Error('Adapter does not support audio processing');
    }

    this.adapter = config.adapter;
    this.defaultLanguage = config.defaultLanguage;
    this.defaultVoice = config.defaultVoice ?? 'alloy';
    this.defaultFormat = config.defaultFormat ?? 'mp3';
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(audio: AudioInput, options?: AudioProcessingOptions): Promise<AudioTaskResult> {
    const startTime = Date.now();
    const result = await transcribeAudio(this.adapter, audio, {
      language: options?.language ?? this.defaultLanguage,
      prompt: options?.prompt,
      includeTimestamps: options?.includeTimestamps,
      temperature: options?.temperature,
    });

    return {
      task: 'transcribe',
      result: result.text,
      metadata: {
        language: result.language,
        duration: result.duration,
      },
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Convert text to speech
   */
  async speak(text: string, options?: SpeechSynthesisOptions): Promise<AudioTaskResult> {
    const startTime = Date.now();
    const format = options?.format ?? this.defaultFormat;
    
    const result = await synthesizeSpeech(this.adapter, text, {
      voice: options?.voice ?? this.defaultVoice,
      format,
      speed: options?.speed,
    });

    return {
      task: 'speak',
      result: result.audio,
      metadata: {
        format: result.format,
      },
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Run a batch of audio tasks
   */
  async runTasks(tasks: AudioTask[]): Promise<AudioTaskResult[]> {
    const results: AudioTaskResult[] = [];

    for (const task of tasks) {
      switch (task.type) {
        case 'transcribe':
          results.push(await this.transcribe(task.audio, task.options));
          break;
        case 'speak':
          results.push(await this.speak(task.text, task.options));
          break;
        default:
          throw new Error(`Unknown task type`);
      }
    }

    return results;
  }

  /**
   * Transcribe and summarize audio
   */
  async transcribeAndProcess(
    audio: AudioInput,
    processor: (text: string) => Promise<string>
  ): Promise<{ transcription: string; processed: string; latencyMs: number }> {
    const startTime = Date.now();
    
    const transcriptionResult = await this.transcribe(audio);
    const transcription = transcriptionResult.result as string;
    const processed = await processor(transcription);

    return {
      transcription,
      processed,
      latencyMs: Date.now() - startTime,
    };
  }
}

import type { TTSAdapter, TTSSynthesizeOptions } from '../types.js';

export interface OpenAITTSConfig {
  apiKey: string;
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  baseURL?: string;
  timeoutMs?: number;
}

/**
 * TTS adapter using OpenAI TTS API.
 */
export class OpenAITTSAdapter implements TTSAdapter {
  private apiKey: string;
  private model: string;
  private defaultVoice: string;
  private baseURL: string;
  private timeoutMs: number;

  constructor(config: OpenAITTSConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'tts-1';
    this.defaultVoice = config.voice ?? 'alloy';
    this.baseURL = config.baseURL ?? 'https://api.openai.com/v1';
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  async synthesize(text: string, options: TTSSynthesizeOptions = {}): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/audio/speech`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          voice: options.voice ?? this.defaultVoice,
          response_format: options.format ?? 'mp3',
          speed: options.speed ?? 1.0,
        }),
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`TTS API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`TTS API error: ${response.status} - ${err}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async *synthesizeStream(text: string, options: TTSSynthesizeOptions = {}): AsyncIterable<Buffer> {
    // Split text into sentences for lower latency
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    for (const sentence of sentences) {
      const audio = await this.synthesize(sentence.trim(), options);
      yield audio;
    }
  }
}

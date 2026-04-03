import type { STTAdapter } from '../types.js';

export interface OpenAISTTConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
  timeoutMs?: number;
}

/**
 * STT adapter using OpenAI Whisper API.
 */
export class OpenAISTTAdapter implements STTAdapter {
  private apiKey: string;
  private model: string;
  private baseURL: string;
  private timeoutMs: number;

  constructor(config: OpenAISTTConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'whisper-1';
    this.baseURL = config.baseURL ?? 'https://api.openai.com/v1';
    this.timeoutMs = config.timeoutMs ?? 120_000;
  }

  async transcribe(audio: Buffer | ArrayBuffer, format = 'audio/wav'): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const ext = format.includes('webm') ? 'webm'
      : format.includes('mp3') ? 'mp3'
      : format.includes('ogg') ? 'ogg'
      : 'wav';

    const audioData = audio instanceof Buffer ? audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) : audio;
    const blob = new Blob([audioData as BlobPart], { type: format });
    const formData = new FormData();
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', this.model);
    formData.append('response_format', 'text');

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/audio/transcriptions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        body: formData,
      });
    } catch (error) {
      clearTimeout(timeout);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Whisper API request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Whisper API error: ${response.status} - ${err}`);
    }

    return response.text();
  }
}

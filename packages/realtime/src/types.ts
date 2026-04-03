/**
 * Adapter for Speech-to-Text (audio transcription).
 */
export interface STTAdapter {
  /**
   * Transcribe audio buffer to text.
   * @param audio Raw audio bytes
   * @param format Audio MIME type (e.g. 'audio/webm', 'audio/wav', 'audio/mp3')
   */
  transcribe(audio: Buffer | ArrayBuffer, format?: string): Promise<string>;
}

/**
 * Adapter for Text-to-Speech (audio synthesis).
 */
export interface TTSAdapter {
  /**
   * Synthesize text to audio buffer.
   */
  synthesize(text: string, options?: TTSSynthesizeOptions): Promise<Buffer>;

  /**
   * Synthesize text to audio as a stream of chunks (optional).
   */
  synthesizeStream?(text: string, options?: TTSSynthesizeOptions): AsyncIterable<Buffer>;
}

export interface TTSSynthesizeOptions {
  voice?: string;
  speed?: number;
  /** Output format: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' */
  format?: string;
}

/**
 * Events emitted by RealtimeAgent during a voice interaction.
 */
export type RealtimeEvent =
  | { type: 'transcript'; text: string }
  | { type: 'token'; content: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'audio_chunk'; data: Buffer }
  | { type: 'done'; transcript: string; response: string; audio?: Buffer }
  | { type: 'error'; error: Error; message: string };

export interface RealtimeAgentConfig {
  /** System goal / personality for the voice agent */
  goal: string;
  /** Custom system prompt injected into the LLM */
  systemPrompt?: string;
  /** Language for STT (ISO-639-1, e.g. 'en', 'fr') */
  language?: string;
  /** Whether to synthesize audio output */
  tts?: boolean;
}

export interface RealtimeProcessResult {
  /** Transcribed user speech */
  transcript: string;
  /** LLM text response */
  response: string;
  /** Synthesized audio (if tts is enabled) */
  audio?: Buffer;
}

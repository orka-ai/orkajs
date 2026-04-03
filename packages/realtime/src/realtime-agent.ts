import type { LLMAdapter } from '@orka-js/core';
import { StreamingToolAgent } from '@orka-js/agent';
import type { Tool } from '@orka-js/agent';
import type {
  STTAdapter,
  TTSAdapter,
  RealtimeAgentConfig,
  RealtimeEvent,
  RealtimeProcessResult,
} from './types.js';

export interface RealtimeAgentOptions {
  config: RealtimeAgentConfig;
  llm: LLMAdapter;
  stt: STTAdapter;
  tts?: TTSAdapter;
  tools?: Tool[];
}

/**
 * A voice agent that processes audio through the STT → LLM → TTS pipeline.
 *
 * @example
 * ```typescript
 * const agent = new RealtimeAgent({
 *   config: { goal: 'Answer questions', tts: true },
 *   llm: new OpenAIAdapter({ apiKey }),
 *   stt: new OpenAISTTAdapter({ apiKey }),
 *   tts: new OpenAITTSAdapter({ apiKey }),
 * });
 *
 * const result = await agent.process(audioBuffer);
 * console.log(result.transcript); // what the user said
 * console.log(result.response);   // the LLM's reply
 * ```
 */
export class RealtimeAgent {
  private config: RealtimeAgentConfig;
  private stt: STTAdapter;
  private tts?: TTSAdapter;
  private innerAgent: StreamingToolAgent;

  constructor(options: RealtimeAgentOptions) {
    this.config = options.config;
    this.stt = options.stt;
    this.tts = options.tts;

    this.innerAgent = new StreamingToolAgent(
      {
        goal: options.config.goal,
        systemPrompt: options.config.systemPrompt,
        tools: options.tools ?? [],
      },
      options.llm,
    );
  }

  /**
   * Process audio: transcribe → run LLM → synthesize.
   * Returns final transcript, response text and audio buffer.
   */
  async process(audio: Buffer | ArrayBuffer, audioFormat = 'audio/wav'): Promise<RealtimeProcessResult> {
    const transcript = await this.stt.transcribe(audio, audioFormat);

    let response = '';
    for await (const event of this.innerAgent.runStream(transcript)) {
      if (event.type === 'done') {
        response = event.content;
      }
    }

    let audioOutput: Buffer | undefined;
    if (this.config.tts !== false && this.tts && response) {
      audioOutput = await this.tts.synthesize(response);
    }

    return { transcript, response, audio: audioOutput };
  }

  /**
   * Process audio as a stream of events — yields transcript, tokens, audio chunks, and done.
   */
  async *processStream(
    audio: Buffer | ArrayBuffer,
    audioFormat = 'audio/wav',
  ): AsyncIterable<RealtimeEvent> {
    let transcript: string;
    try {
      transcript = await this.stt.transcribe(audio, audioFormat);
    } catch (error) {
      yield { type: 'error', error: error as Error, message: (error as Error).message };
      return;
    }

    yield { type: 'transcript', text: transcript };

    let fullResponse = '';

    for await (const event of this.innerAgent.runStream(transcript)) {
      switch (event.type) {
        case 'token':
          fullResponse += event.token;
          yield { type: 'token', content: event.token };
          break;
        case 'tool_call':
          yield { type: 'tool_call', name: event.name, args: event.arguments };
          break;
        case 'tool_result':
          yield { type: 'tool_result', name: String(event.toolCallId), result: event.result };
          break;
        case 'done':
          fullResponse = event.content || fullResponse;
          break;
        case 'error':
          yield { type: 'error', error: event.error, message: event.error.message };
          return;
      }
    }

    // Synthesize audio
    let audioOutput: Buffer | undefined;
    if (this.config.tts !== false && this.tts && fullResponse) {
      if (this.tts.synthesizeStream) {
        for await (const chunk of this.tts.synthesizeStream(fullResponse)) {
          yield { type: 'audio_chunk', data: chunk };
          if (!audioOutput) audioOutput = chunk;
          else audioOutput = Buffer.concat([audioOutput, chunk]);
        }
      } else {
        audioOutput = await this.tts.synthesize(fullResponse);
        yield { type: 'audio_chunk', data: audioOutput };
      }
    }

    yield { type: 'done', transcript, response: fullResponse, audio: audioOutput };
  }

  /**
   * Returns an Express/Node.js-compatible WebSocket message handler.
   * Expects binary audio messages from the client, sends back JSON events.
   *
   * @example
   * ```typescript
   * import { WebSocketServer } from 'ws';
   * const wss = new WebSocketServer({ port: 8080 });
   * wss.on('connection', agent.wsHandler());
   * ```
   */
  wsHandler() {
    return (ws: {
      on(event: string, listener: (...args: unknown[]) => void): void;
      send(data: string): void;
    }) => {
      ws.on('message', async (data: unknown) => {
        const audio = data instanceof Buffer ? data
          : data instanceof ArrayBuffer ? Buffer.from(data)
          : Buffer.from(data as Uint8Array);

        try {
          for await (const event of this.processStream(audio)) {
            ws.send(JSON.stringify(event));
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: { message: (error as Error).message },
            message: (error as Error).message,
          }));
        }
      });
    };
  }
}

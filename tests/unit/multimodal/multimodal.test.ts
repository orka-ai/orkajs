import { describe, it, expect, vi } from 'vitest';
import {
  isVisionCapable,
  analyzeImage,
  describeImage,
  extractTextFromImage,
  isAudioCapable,
  transcribeAudio,
  synthesizeSpeech,
  VisionAgent,
  AudioAgent,
  MultimodalAgent,
} from '../../../packages/multimodal/src/index.js';

// Mock LLM adapter
const createMockLLM = () => ({
  name: 'openai',
  generate: vi.fn().mockResolvedValue({
    content: 'This is a test image showing a cat.',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    model: 'gpt-4o',
    finishReason: 'stop',
  }),
  embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
});

// Mock Audio adapter
const createMockAudioAdapter = () => ({
  transcribe: vi.fn().mockResolvedValue({
    text: 'Hello, this is a test transcription.',
    language: 'en',
    duration: 5.5,
  }),
  textToSpeech: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
  supportsAudio: true,
});

describe('@orka-js/multimodal', () => {
  describe('Vision utilities', () => {
    it('should check if adapter supports vision', () => {
      const openaiAdapter = { name: 'openai', generate: vi.fn(), embed: vi.fn() };
      const anthropicAdapter = { name: 'anthropic', generate: vi.fn(), embed: vi.fn() };
      const customAdapter = { name: 'custom-llm', generate: vi.fn(), embed: vi.fn() };
      
      expect(isVisionCapable(openaiAdapter)).toBe(true);
      expect(isVisionCapable(anthropicAdapter)).toBe(true);
      expect(isVisionCapable(customAdapter)).toBe(false);
    });

    it('should analyze image with URL input', async () => {
      const mockLLM = createMockLLM();
      
      const result = await analyzeImage(mockLLM, {
        type: 'url',
        url: 'https://example.com/image.jpg',
      });
      
      expect(result.analysis).toBe('This is a test image showing a cat.');
      expect(result.usage.totalTokens).toBe(150);
      expect(result.model).toBe('gpt-4o');
      expect(mockLLM.generate).toHaveBeenCalled();
    });

    it('should analyze image with base64 input', async () => {
      const mockLLM = createMockLLM();
      
      const result = await analyzeImage(mockLLM, {
        type: 'base64',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        mimeType: 'image/png',
      });
      
      expect(result.analysis).toBeDefined();
      expect(mockLLM.generate).toHaveBeenCalled();
    });

    it('should describe image with structured output', async () => {
      const mockLLM = createMockLLM();
      mockLLM.generate.mockResolvedValueOnce({
        content: JSON.stringify({
          description: 'A cute cat sitting on a couch',
          objects: ['cat', 'couch'],
          colors: ['orange', 'brown'],
          scene: 'indoor',
          confidence: 0.95,
        }),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });
      
      const result = await describeImage(mockLLM, {
        type: 'url',
        url: 'https://example.com/cat.jpg',
      });
      
      expect(result.description).toBe('A cute cat sitting on a couch');
      expect(result.objects).toContain('cat');
      expect(result.scene).toBe('indoor');
    });

    it('should extract text from image (OCR)', async () => {
      const mockLLM = createMockLLM();
      mockLLM.generate.mockResolvedValueOnce({
        content: 'Hello World\nThis is extracted text',
        usage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });
      
      const result = await extractTextFromImage(mockLLM, {
        type: 'url',
        url: 'https://example.com/document.jpg',
      });
      
      expect(result.text).toBe('Hello World\nThis is extracted text');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for non-vision adapter', async () => {
      const nonVisionLLM = { name: 'custom-llm', generate: vi.fn(), embed: vi.fn() };
      
      await expect(analyzeImage(nonVisionLLM, {
        type: 'url',
        url: 'https://example.com/image.jpg',
      })).rejects.toThrow('does not support vision');
    });
  });

  describe('Audio utilities', () => {
    it('should check if adapter supports audio', () => {
      const audioAdapter = createMockAudioAdapter();
      const nonAudioAdapter = { name: 'openai', generate: vi.fn() };
      
      expect(isAudioCapable(audioAdapter)).toBe(true);
      expect(isAudioCapable(nonAudioAdapter)).toBe(false);
    });

    it('should transcribe audio', async () => {
      const mockAdapter = createMockAudioAdapter();
      
      const result = await transcribeAudio(mockAdapter, {
        type: 'base64',
        data: 'SGVsbG8gV29ybGQ=',
        format: 'wav',
      });
      
      expect(result.text).toBe('Hello, this is a test transcription.');
      expect(result.language).toBe('en');
      expect(result.duration).toBe(5.5);
      expect(mockAdapter.transcribe).toHaveBeenCalled();
    });

    it('should synthesize speech', async () => {
      const mockAdapter = createMockAudioAdapter();
      
      const result = await synthesizeSpeech(mockAdapter, 'Hello world', {
        voice: 'nova',
        format: 'mp3',
      });
      
      expect(result.audio).toBeInstanceOf(ArrayBuffer);
      expect(result.format).toBe('mp3');
      expect(mockAdapter.textToSpeech).toHaveBeenCalledWith('Hello world', expect.objectContaining({
        voice: 'nova',
        responseFormat: 'mp3',
      }));
    });
  });

  describe('VisionAgent', () => {
    it('should create vision agent', () => {
      const mockLLM = createMockLLM();
      const agent = new VisionAgent({ llm: mockLLM });
      expect(agent).toBeDefined();
    });

    it('should analyze image via agent', async () => {
      const mockLLM = createMockLLM();
      const agent = new VisionAgent({ llm: mockLLM });
      const result = await agent.analyze({
        type: 'url',
        url: 'https://example.com/image.jpg',
      }, 'What is in this image?');
      
      expect(result.task).toBe('analyze');
      expect(result.result).toBeDefined();
    });

    it('should answer questions about images', async () => {
      const mockLLM = createMockLLM();
      const agent = new VisionAgent({ llm: mockLLM });
      const answer = await agent.ask({
        type: 'url',
        url: 'https://example.com/image.jpg',
      }, 'What color is the cat?');
      
      expect(typeof answer).toBe('string');
    });

    it('should run batch tasks', async () => {
      const mockLLM = createMockLLM();
      const agent = new VisionAgent({ llm: mockLLM });
      const results = await agent.runTasks([
        { type: 'analyze', image: { type: 'url', url: 'https://example.com/1.jpg' } },
        { type: 'ocr', image: { type: 'url', url: 'https://example.com/2.jpg' } },
      ]);
      
      expect(results).toHaveLength(2);
      expect(results[0].task).toBe('analyze');
      expect(results[1].task).toBe('ocr');
    });
  });

  describe('AudioAgent', () => {
    it('should create audio agent', () => {
      const mockAdapter = createMockAudioAdapter();
      const agent = new AudioAgent({ adapter: mockAdapter });
      expect(agent).toBeDefined();
    });

    it('should transcribe via agent', async () => {
      const mockAdapter = createMockAudioAdapter();
      const agent = new AudioAgent({ adapter: mockAdapter });
      const result = await agent.transcribe({
        type: 'base64',
        data: 'SGVsbG8=',
      });
      
      expect(result.task).toBe('transcribe');
      expect(result.result).toBe('Hello, this is a test transcription.');
    });

    it('should speak via agent', async () => {
      const mockAdapter = createMockAudioAdapter();
      const agent = new AudioAgent({ adapter: mockAdapter });
      const result = await agent.speak('Hello world');
      
      expect(result.task).toBe('speak');
      expect(result.result).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('MultimodalAgent', () => {
    it('should create multimodal agent', () => {
      const mockLLM = createMockLLM();
      const agent = new MultimodalAgent({ llm: mockLLM });
      expect(agent).toBeDefined();
      expect(agent.supportsVision).toBe(true);
    });

    it('should process text input', async () => {
      const mockLLM = createMockLLM();
      const agent = new MultimodalAgent({ llm: mockLLM });
      const result = await agent.process({ text: 'Hello world' });
      
      expect(result.response).toBeDefined();
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should process image + text input', async () => {
      const mockLLM = createMockLLM();
      const agent = new MultimodalAgent({ llm: mockLLM });
      const result = await agent.process({
        text: 'What is in this image?',
        images: [{ type: 'url', url: 'https://example.com/image.jpg' }],
      });
      
      expect(result.response).toBeDefined();
    });

    it('should process audio + text with transcription', async () => {
      const mockLLM = createMockLLM();
      const mockAudio = createMockAudioAdapter();
      const agent = new MultimodalAgent({
        llm: mockLLM,
        audioAdapter: mockAudio,
      });
      
      const result = await agent.process({
        text: 'Summarize this audio',
        audio: [{ type: 'base64', data: 'SGVsbG8=' }],
      });
      
      expect(result.response).toBeDefined();
      expect(result.transcriptions).toHaveLength(1);
      expect(result.transcriptions![0]).toBe('Hello, this is a test transcription.');
    });

    it('should ask questions with context', async () => {
      const mockLLM = createMockLLM();
      const agent = new MultimodalAgent({ llm: mockLLM });
      const answer = await agent.ask('Describe this image', {
        images: [{ type: 'url', url: 'https://example.com/image.jpg' }],
      });
      
      expect(typeof answer).toBe('string');
    });

    it('should throw error when no input provided', async () => {
      const mockLLM = createMockLLM();
      const agent = new MultimodalAgent({ llm: mockLLM });
      
      await expect(agent.process({})).rejects.toThrow('No input provided');
    });
  });

  describe('Type exports', () => {
    it('should export all utilities and agents', () => {
      // Vision utilities
      expect(analyzeImage).toBeDefined();
      expect(describeImage).toBeDefined();
      expect(extractTextFromImage).toBeDefined();
      expect(isVisionCapable).toBeDefined();
      
      // Audio utilities
      expect(transcribeAudio).toBeDefined();
      expect(synthesizeSpeech).toBeDefined();
      expect(isAudioCapable).toBeDefined();
      
      // Agents
      expect(VisionAgent).toBeDefined();
      expect(AudioAgent).toBeDefined();
      expect(MultimodalAgent).toBeDefined();
    });
  });
});

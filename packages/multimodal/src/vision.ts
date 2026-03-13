/**
 * Vision utilities for multimodal processing
 */

import type { LLMAdapter, ContentPart } from '@orka-js/core';
import type {
  ImageInput,
  VisionAnalysisOptions,
  VisionAnalysisResult,
  ImageDescription,
  OCRResult,
  VisionLLMAdapter,
} from './types.js';

/**
 * Check if an LLM adapter supports vision
 */
export function isVisionCapable(llm: LLMAdapter): llm is VisionLLMAdapter {
  // GPT-4V, GPT-4o, Claude 3 all support vision
  const visionModels = [
    'gpt-4-vision', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini',
    'claude-3', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku',
    'claude-3-5-sonnet', 'claude-3-5-haiku',
  ];
  
  const adapterName = llm.name.toLowerCase();
  if (adapterName === 'openai' || adapterName === 'anthropic') {
    return true; // Modern OpenAI and Anthropic adapters support vision
  }
  
  return visionModels.some(model => adapterName.includes(model));
}

/**
 * Convert ImageInput to ContentPart
 */
function imageInputToContentPart(image: ImageInput): ContentPart {
  switch (image.type) {
    case 'url':
      return {
        type: 'image_url',
        image_url: { url: image.url, detail: image.detail ?? 'auto' },
      };
    case 'base64':
      return {
        type: 'image_base64',
        data: image.data,
        mimeType: image.mimeType,
      };
    case 'file':
      throw new Error('File-based images must be converted to base64 before processing');
    default:
      throw new Error(`Unknown image input type`);
  }
}

/**
 * Analyze an image using a vision-capable LLM
 */
export async function analyzeImage(
  llm: LLMAdapter,
  image: ImageInput,
  options: VisionAnalysisOptions = {}
): Promise<VisionAnalysisResult> {
  if (!isVisionCapable(llm)) {
    throw new Error(`LLM adapter "${llm.name}" does not support vision`);
  }

  const startTime = Date.now();
  const prompt = options.prompt ?? 'Analyze this image in detail. Describe what you see, including objects, people, text, colors, and any notable features.';

  const content: ContentPart[] = [
    { type: 'text', text: prompt },
    imageInputToContentPart(image),
  ];

  const result = await llm.generate('', {
    messages: [
      ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
      { role: 'user' as const, content },
    ],
    maxTokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.3,
  });

  return {
    analysis: result.content,
    usage: result.usage,
    model: result.model,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Get a structured description of an image
 */
export async function describeImage(
  llm: LLMAdapter,
  image: ImageInput,
  options: VisionAnalysisOptions = {}
): Promise<ImageDescription> {
  const systemPrompt = `You are an image analysis assistant. Analyze the image and respond with a JSON object containing:
- description: A brief description of the image (1-2 sentences)
- objects: An array of main objects/subjects detected
- text: An array of any text visible in the image (empty if none)
- colors: An array of dominant colors
- scene: The type of scene (e.g., "indoor", "outdoor", "portrait", "landscape", "document")
- confidence: Your confidence in the analysis (0.0 to 1.0)

Respond ONLY with valid JSON, no other text.`;

  const result = await analyzeImage(llm, image, {
    ...options,
    systemPrompt,
    prompt: 'Analyze this image and provide a structured description.',
  });

  try {
    const parsed = JSON.parse(result.analysis);
    return {
      description: parsed.description ?? result.analysis,
      objects: parsed.objects,
      text: parsed.text,
      colors: parsed.colors,
      scene: parsed.scene,
      confidence: parsed.confidence,
    };
  } catch {
    // If JSON parsing fails, return basic description
    return {
      description: result.analysis,
    };
  }
}

/**
 * Extract text from an image (OCR)
 */
export async function extractTextFromImage(
  llm: LLMAdapter,
  image: ImageInput,
  options: VisionAnalysisOptions = {}
): Promise<OCRResult> {
  const startTime = Date.now();

  const systemPrompt = `You are an OCR (Optical Character Recognition) assistant. Your task is to extract ALL text visible in the image.
- Extract text exactly as it appears, preserving formatting where possible
- Include all text, even if partially visible or small
- If there's no text, respond with "NO_TEXT_FOUND"
- Respond with ONLY the extracted text, nothing else`;

  const result = await analyzeImage(llm, image, {
    ...options,
    systemPrompt,
    prompt: 'Extract all text from this image.',
  });

  const text = result.analysis.trim();
  
  return {
    text: text === 'NO_TEXT_FOUND' ? '' : text,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Compare two images and describe differences
 */
export async function compareImages(
  llm: LLMAdapter,
  image1: ImageInput,
  image2: ImageInput,
  options: VisionAnalysisOptions = {}
): Promise<VisionAnalysisResult> {
  if (!isVisionCapable(llm)) {
    throw new Error(`LLM adapter "${llm.name}" does not support vision`);
  }

  const startTime = Date.now();
  const prompt = options.prompt ?? 'Compare these two images. Describe the similarities and differences between them.';

  const content: ContentPart[] = [
    { type: 'text', text: prompt },
    imageInputToContentPart(image1),
    imageInputToContentPart(image2),
  ];

  const result = await llm.generate('', {
    messages: [
      ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
      { role: 'user' as const, content },
    ],
    maxTokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.3,
  });

  return {
    analysis: result.content,
    usage: result.usage,
    model: result.model,
    latencyMs: Date.now() - startTime,
  };
}

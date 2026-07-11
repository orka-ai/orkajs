/**
 * OpenAI Vision OCR Engine - Cloud-based high-precision OCR
 * Uses GPT-4 Vision for document understanding
 */

import type {
  OCREngine,
  OCRResult,
  OCROptions,
  OCRPage,
  OCRBlock,
  OpenAIVisionConfig,
} from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dns from 'dns';
import * as net from 'net';

/**
 * OpenAI Vision OCR Engine
 * 
 * @example
 * ```typescript
 * import { OpenAIVisionEngine } from '@orka-js/ocr';
 * 
 * const engine = new OpenAIVisionEngine({
 *   apiKey: process.env.OPENAI_API_KEY!,
 * });
 * 
 * const result = await engine.process('./document.png');
 * console.log(result.text);
 * ```
 */
export class OpenAIVisionEngine implements OCREngine {
  readonly name = 'openai-vision' as const;
  private config: OpenAIVisionConfig;

  constructor(config: OpenAIVisionConfig) {
    this.config = {
      model: 'gpt-4o',
      maxTokens: 4096,
      ...config,
    };

    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required for OpenAIVisionEngine');
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  async process(input: string | Buffer, options: OCROptions = {}): Promise<OCRResult> {
    const startTime = Date.now();

    // Convert input to base64
    const imageData = await this.prepareImage(input);

    // Build the prompt based on options
    const prompt = this.buildPrompt(options);

    // Call OpenAI Vision API
    const response = await this.callOpenAI(imageData, prompt);

    // Parse the response
    const result = this.parseResponse(response, options, startTime);

    return result;
  }

  private async prepareImage(input: string | Buffer): Promise<{ base64: string; mimeType: string }> {
    let buffer: Buffer;
    let mimeType = 'image/png';

    if (Buffer.isBuffer(input)) {
      buffer = input;
      // Detect mime type from buffer magic bytes
      mimeType = this.detectMimeType(buffer);
    } else if (input.startsWith('data:')) {
      // Already base64 data URL
      const match = input.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return { base64: match[2], mimeType: match[1] };
      }
      throw new Error('Invalid data URL format');
    } else if (input.startsWith('http://') || input.startsWith('https://')) {
      // URL - fetch the image with SSRF protections
      const fetched = await this.fetchRemoteImage(input);
      buffer = fetched.buffer;
      mimeType = fetched.mimeType;
    } else {
      // File path
      buffer = fs.readFileSync(input);
      const ext = path.extname(input).toLowerCase();
      mimeType = this.getMimeTypeFromExtension(ext);
    }

    return {
      base64: buffer.toString('base64'),
      mimeType,
    };
  }

  /**
   * Fetch an image from a remote URL while guarding against SSRF.
   *
   * Rejects non-http(s) schemes, enforces an optional host allowlist, refuses
   * any host that resolves to a private/loopback/link-local/metadata address,
   * disallows redirects (which could otherwise re-target an internal host), and
   * caps the downloaded body size.
   */
  private async fetchRemoteImage(input: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const url = new URL(input);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Unsupported URL protocol for image fetch: ${url.protocol}`);
    }

    const allowedHosts = this.config.allowedImageHosts;
    if (allowedHosts && !allowedHosts.includes(url.hostname)) {
      throw new Error(`Host not allowed for image fetch: ${url.hostname}`);
    }

    await this.assertPublicHost(url.hostname);

    // `redirect: 'error'` prevents an initially-public host from redirecting the
    // request to an internal address after the allowlist/DNS checks have passed.
    const response = await fetch(input, { redirect: 'error' });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const maxBytes = this.config.maxImageBytes ?? 10 * 1024 * 1024;
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error(`Remote image exceeds maximum size of ${maxBytes} bytes`);
    }

    const buffer = await this.readCappedBody(response, maxBytes);
    const mimeType = response.headers.get('content-type') || this.detectMimeType(buffer);
    return { buffer, mimeType };
  }

  /**
   * Resolve a hostname and reject it if any resolved address is in a
   * private/loopback/link-local/metadata range.
   */
  private async assertPublicHost(hostname: string): Promise<void> {
    let addresses: string[];
    if (net.isIP(hostname)) {
      addresses = [hostname];
    } else {
      const resolved = await dns.promises.lookup(hostname, { all: true });
      addresses = resolved.map((entry) => entry.address);
    }

    if (addresses.length === 0) {
      throw new Error(`Could not resolve host: ${hostname}`);
    }

    for (const address of addresses) {
      if (this.isPrivateAddress(address)) {
        throw new Error(`Refusing to fetch image from non-public address: ${address}`);
      }
    }
  }

  private isPrivateAddress(address: string): boolean {
    const type = net.isIP(address);
    if (type === 4) {
      const [a, b] = address.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127) return true;
      if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
      return false;
    }
    if (type === 6) {
      const addr = address.toLowerCase();
      if (addr === '::' || addr === '::1') return true;
      if (addr.startsWith('fe80')) return true; // link-local
      if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // unique local (fc00::/7)
      const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
      if (mapped) return this.isPrivateAddress(mapped[1]);
      return false;
    }
    // Unknown / unparseable address - treat as unsafe.
    return true;
  }

  private async readCappedBody(response: Response, maxBytes: number): Promise<Buffer> {
    const reader = response.body?.getReader();
    if (!reader) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > maxBytes) {
        throw new Error(`Remote image exceeds maximum size of ${maxBytes} bytes`);
      }
      return buffer;
    }

    const chunks: Buffer[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Remote image exceeds maximum size of ${maxBytes} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  private detectMimeType(buffer: Buffer): string {
    // Check magic bytes
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
    if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
    if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp';
    if (buffer[0] === 0x25 && buffer[1] === 0x50) return 'application/pdf';
    return 'image/png';
  }

  private getMimeTypeFromExtension(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };
    return mimeTypes[ext] || 'image/png';
  }

  private buildPrompt(options: OCROptions): string {
    const parts: string[] = [
      'Extract all text from this image/document accurately.',
      'Preserve the original formatting and structure as much as possible.',
      'Include all visible text, numbers, and symbols.',
    ];

    if (options.extractTables) {
      parts.push('If there are tables, format them clearly with | separators.');
    }

    if (options.extractFields) {
      parts.push('Identify and extract any form fields as key: value pairs.');
    }

    parts.push('Return only the extracted text, no explanations.');

    return parts.join(' ');
  }

  private async callOpenAI(
    imageData: { base64: string; mimeType: string },
    prompt: string
  ): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageData.mimeType};base64,${imageData.base64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content || '';
  }

  private parseResponse(text: string, _options: OCROptions, startTime: number): OCRResult {
    // Build blocks from paragraphs
    const paragraphs = text.split(/\n\n+/);
    const blocks: OCRBlock[] = paragraphs.map((para) => ({
      text: para.trim(),
      lines: para.split('\n').map(line => ({
        text: line.trim(),
        words: line.split(/\s+/).map(word => ({
          text: word,
          confidence: 0.95, // High confidence for GPT-4V
        })),
        confidence: 0.95,
      })),
      confidence: 0.95,
      type: 'text' as const,
    })).filter(block => block.text.length > 0);

    const page: OCRPage = {
      pageNumber: 1,
      text,
      blocks,
      confidence: 0.95,
    };

    return {
      text,
      pages: [page],
      confidence: 0.95,
      metadata: {
        engine: 'openai-vision',
        processingTimeMs: Date.now() - startTime,
        pageCount: 1,
      },
    };
  }
}

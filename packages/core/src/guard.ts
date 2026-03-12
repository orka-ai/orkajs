/**
 * PII Guard - Data Protection Layer for OrkaJS
 * Detects and redacts sensitive information before sending to LLM APIs
 */

import { OrkaError, OrkaErrorCode } from './errors.js';

/**
 * Types of PII that can be detected
 */
export type PIIType =
  | 'email'
  | 'phone'
  | 'credit_card'
  | 'ssn'
  | 'iban'
  | 'ip_address'
  | 'date_of_birth'
  | 'passport'
  | 'driver_license'
  | 'name'
  | 'address'
  | 'custom';

/**
 * A detected PII match
 */
export interface PIIMatch {
  type: PIIType;
  value: string;
  start: number;
  end: number;
  confidence: number;
  redactedValue: string;
}

/**
 * Result of PII detection
 */
export interface PIIDetectionResult {
  originalText: string;
  redactedText: string;
  matches: PIIMatch[];
  hasMatches: boolean;
}

/**
 * Custom pattern definition for detecting PII
 */
export interface CustomPIIPattern {
  name: string;
  pattern: RegExp;
  redactWith?: string;
  confidence?: number;
}

/**
 * Configuration for PIIGuard
 */
export interface PIIGuardConfig {
  /** Enable PII detection (default: true) */
  enabled?: boolean;
  /** Types of PII to detect (default: all) */
  detectTypes?: PIIType[];
  /** Automatically redact before LLM calls (default: true) */
  redactBeforeLLM?: boolean;
  /** Custom redaction placeholder (default: [REDACTED]) */
  redactionPlaceholder?: string;
  /** Use type-specific placeholders like [EMAIL], [PHONE] (default: true) */
  useTypedPlaceholders?: boolean;
  /** Custom patterns to detect */
  customPatterns?: CustomPIIPattern[];
  /** Callback when PII is detected */
  onPIIDetected?: (matches: PIIMatch[]) => void;
  /** Throw error if PII is detected instead of redacting (default: false) */
  throwOnPII?: boolean;
  /** Minimum confidence threshold (0-1) for detection (default: 0.8) */
  minConfidence?: number;
  /** Allow list - patterns that should NOT be redacted */
  allowList?: RegExp[];
}

/**
 * Default PII patterns with their regex and confidence levels
 */
const DEFAULT_PATTERNS: Record<PIIType, { pattern: RegExp; confidence: number }[]> = {
  email: [
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi, confidence: 0.95 },
  ],
  phone: [
    // International format
    { pattern: /\+?[1-9]\d{1,14}/g, confidence: 0.7 },
    // US format
    { pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, confidence: 0.9 },
    // French format
    { pattern: /\b0[1-9](?:[\s.-]?\d{2}){4}\b/g, confidence: 0.9 },
    // Generic with country code
    { pattern: /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, confidence: 0.85 },
  ],
  credit_card: [
    // Visa
    { pattern: /\b4[0-9]{12}(?:[0-9]{3})?\b/g, confidence: 0.95 },
    // Mastercard
    { pattern: /\b5[1-5][0-9]{14}\b/g, confidence: 0.95 },
    // Amex
    { pattern: /\b3[47][0-9]{13}\b/g, confidence: 0.95 },
    // Generic with spaces/dashes
    { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, confidence: 0.85 },
  ],
  ssn: [
    // US SSN
    { pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, confidence: 0.85 },
  ],
  iban: [
    // IBAN format
    { pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/gi, confidence: 0.9 },
  ],
  ip_address: [
    // IPv4
    { pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, confidence: 0.95 },
    // IPv6 (simplified)
    { pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, confidence: 0.95 },
  ],
  date_of_birth: [
    // DD/MM/YYYY or MM/DD/YYYY
    { pattern: /\b(?:0?[1-9]|[12][0-9]|3[01])[\/\-](?:0?[1-9]|1[0-2])[\/\-](?:19|20)\d{2}\b/g, confidence: 0.7 },
    // YYYY-MM-DD
    { pattern: /\b(?:19|20)\d{2}[-\/](?:0?[1-9]|1[0-2])[-\/](?:0?[1-9]|[12][0-9]|3[01])\b/g, confidence: 0.7 },
  ],
  passport: [
    // Generic passport number (alphanumeric, 6-9 chars)
    { pattern: /\b[A-Z]{1,2}\d{6,8}\b/gi, confidence: 0.6 },
  ],
  driver_license: [
    // Generic driver license (varies by country)
    { pattern: /\b[A-Z]{1,2}\d{6,8}\b/gi, confidence: 0.5 },
  ],
  name: [
    // This is intentionally empty - name detection requires NER or context
  ],
  address: [
    // This is intentionally empty - address detection requires NER or context
  ],
  custom: [],
};

/**
 * Type-specific redaction placeholders
 */
const TYPE_PLACEHOLDERS: Record<PIIType, string> = {
  email: '[EMAIL]',
  phone: '[PHONE]',
  credit_card: '[CREDIT_CARD]',
  ssn: '[SSN]',
  iban: '[IBAN]',
  ip_address: '[IP_ADDRESS]',
  date_of_birth: '[DOB]',
  passport: '[PASSPORT]',
  driver_license: '[LICENSE]',
  name: '[NAME]',
  address: '[ADDRESS]',
  custom: '[REDACTED]',
};

/**
 * PIIGuard - Detects and redacts PII from text
 *
 * @example
 * ```typescript
 * const guard = new PIIGuard({
 *   detectTypes: ['email', 'phone', 'credit_card'],
 *   redactBeforeLLM: true,
 * });
 *
 * const result = guard.detect("Contact me at john@example.com");
 * console.log(result.redactedText); // "Contact me at [EMAIL]"
 * ```
 */
export class PIIGuard {
  private config: Required<Omit<PIIGuardConfig, 'customPatterns' | 'onPIIDetected' | 'allowList'>> & {
    customPatterns: CustomPIIPattern[];
    onPIIDetected?: (matches: PIIMatch[]) => void;
    allowList: RegExp[];
  };

  constructor(config: PIIGuardConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      detectTypes: config.detectTypes ?? [
        'email',
        'phone',
        'credit_card',
        'ssn',
        'iban',
        'ip_address',
      ],
      redactBeforeLLM: config.redactBeforeLLM ?? true,
      redactionPlaceholder: config.redactionPlaceholder ?? '[REDACTED]',
      useTypedPlaceholders: config.useTypedPlaceholders ?? true,
      customPatterns: config.customPatterns ?? [],
      onPIIDetected: config.onPIIDetected,
      throwOnPII: config.throwOnPII ?? false,
      minConfidence: config.minConfidence ?? 0.8,
      allowList: config.allowList ?? [],
    };
  }

  /**
   * Detect PII in text
   */
  detect(text: string): PIIDetectionResult {
    if (!this.config.enabled) {
      return {
        originalText: text,
        redactedText: text,
        matches: [],
        hasMatches: false,
      };
    }

    const matches: PIIMatch[] = [];

    // Detect built-in PII types
    for (const type of this.config.detectTypes) {
      if (type === 'custom') continue;

      const patterns = DEFAULT_PATTERNS[type] || [];
      for (const { pattern, confidence } of patterns) {
        if (confidence < this.config.minConfidence) continue;

        const regex = new RegExp(pattern.source, pattern.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
          const value = match[0];

          // Check allow list
          if (this.isAllowed(value)) continue;

          // Avoid duplicates
          if (this.isDuplicate(matches, match.index, match.index + value.length)) continue;

          const redactedValue = this.getRedactedValue(type, value);

          matches.push({
            type,
            value,
            start: match.index,
            end: match.index + value.length,
            confidence,
            redactedValue,
          });
        }
      }
    }

    // Detect custom patterns
    for (const customPattern of this.config.customPatterns) {
      const regex = new RegExp(customPattern.pattern.source, customPattern.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const value = match[0];
        const confidence = customPattern.confidence ?? 0.9;

        if (confidence < this.config.minConfidence) continue;
        if (this.isAllowed(value)) continue;
        if (this.isDuplicate(matches, match.index, match.index + value.length)) continue;

        const redactedValue = customPattern.redactWith ?? `[${customPattern.name.toUpperCase()}]`;

        matches.push({
          type: 'custom',
          value,
          start: match.index,
          end: match.index + value.length,
          confidence,
          redactedValue,
        });
      }
    }

    // Sort matches by position (descending) for safe replacement
    matches.sort((a, b) => b.start - a.start);

    // Build redacted text
    let redactedText = text;
    for (const match of matches) {
      redactedText =
        redactedText.slice(0, match.start) +
        match.redactedValue +
        redactedText.slice(match.end);
    }

    // Re-sort matches by position (ascending) for output
    matches.sort((a, b) => a.start - b.start);

    const result: PIIDetectionResult = {
      originalText: text,
      redactedText,
      matches,
      hasMatches: matches.length > 0,
    };

    // Callback
    if (result.hasMatches && this.config.onPIIDetected) {
      this.config.onPIIDetected(matches);
    }

    // Throw if configured
    if (result.hasMatches && this.config.throwOnPII) {
      throw new OrkaError(
        `PII detected in text: ${matches.map((m) => m.type).join(', ')}`,
        OrkaErrorCode.VALIDATION_ERROR,
        'PIIGuard',
        undefined,
        { matchCount: matches.length, types: matches.map((m) => m.type) },
      );
    }

    return result;
  }

  /**
   * Redact PII from text (convenience method)
   */
  redact(text: string): string {
    return this.detect(text).redactedText;
  }

  /**
   * Check if text contains PII
   */
  containsPII(text: string): boolean {
    return this.detect(text).hasMatches;
  }

  /**
   * Process text for LLM - redacts if configured
   */
  processForLLM(text: string): string {
    if (!this.config.redactBeforeLLM) {
      return text;
    }
    return this.redact(text);
  }

  /**
   * Add a custom pattern
   */
  addPattern(pattern: CustomPIIPattern): void {
    this.config.customPatterns.push(pattern);
  }

  /**
   * Add to allow list
   */
  addToAllowList(pattern: RegExp): void {
    this.config.allowList.push(pattern);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PIIGuardConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): PIIGuardConfig {
    return { ...this.config };
  }

  private getRedactedValue(type: PIIType, _value: string): string {
    if (this.config.useTypedPlaceholders) {
      return TYPE_PLACEHOLDERS[type] || this.config.redactionPlaceholder;
    }
    return this.config.redactionPlaceholder;
  }

  private isAllowed(value: string): boolean {
    return this.config.allowList.some((pattern) => pattern.test(value));
  }

  private isDuplicate(matches: PIIMatch[], start: number, end: number): boolean {
    return matches.some(
      (m) =>
        (start >= m.start && start < m.end) ||
        (end > m.start && end <= m.end) ||
        (start <= m.start && end >= m.end),
    );
  }
}

/**
 * Create a PIIGuard instance with default configuration
 */
export function createPIIGuard(config?: PIIGuardConfig): PIIGuard {
  return new PIIGuard(config);
}

/**
 * Quick redact function for simple use cases
 */
export function redactPII(text: string, options?: PIIGuardConfig): string {
  const guard = new PIIGuard(options);
  return guard.redact(text);
}

/**
 * Quick detect function for simple use cases
 */
export function detectPII(text: string, options?: PIIGuardConfig): PIIDetectionResult {
  const guard = new PIIGuard(options);
  return guard.detect(text);
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PIIGuard,
  createPIIGuard,
  redactPII,
  detectPII,
  OrkaError,
} from '@orka-js/core';

describe('PIIGuard', () => {
  let guard: PIIGuard;

  beforeEach(() => {
    guard = new PIIGuard();
  });

  describe('email detection', () => {
    it('should detect and redact email addresses', () => {
      const text = 'Contact me at john.doe@example.com for more info';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].type).toBe('email');
      expect(result.matches[0].value).toBe('john.doe@example.com');
      expect(result.redactedText).toBe('Contact me at [EMAIL] for more info');
    });

    it('should detect multiple emails', () => {
      const text = 'Send to alice@test.com and bob@company.org';
      const result = guard.detect(text);

      expect(result.matches).toHaveLength(2);
      expect(result.redactedText).toBe('Send to [EMAIL] and [EMAIL]');
    });
  });

  describe('phone detection', () => {
    it('should detect US phone numbers', () => {
      const text = 'Call me at (555) 123-4567';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
      expect(result.matches.some((m) => m.type === 'phone')).toBe(true);
      expect(result.redactedText).toContain('[PHONE]');
    });

    it('should detect French phone numbers', () => {
      const text = 'Mon numéro est 06 12 34 56 78';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
      expect(result.matches.some((m) => m.type === 'phone')).toBe(true);
    });

    it('should detect international format', () => {
      const text = 'Call +33 6 12 34 56 78';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
    });
  });

  describe('credit card detection', () => {
    it('should detect Visa card numbers', () => {
      const text = 'My card is 4111111111111111';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
      expect(result.matches[0].type).toBe('credit_card');
      expect(result.redactedText).toBe('My card is [CREDIT_CARD]');
    });

    it('should detect Mastercard numbers', () => {
      const text = 'Pay with 5500000000000004';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
      expect(result.matches.some((m) => m.type === 'credit_card')).toBe(true);
    });

    it('should detect card numbers with spaces', () => {
      const text = 'Card: 4111 1111 1111 1111';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
      expect(result.redactedText).toContain('[CREDIT_CARD]');
    });
  });

  describe('SSN detection', () => {
    it('should detect US SSN format', () => {
      const text = 'SSN: 123-45-6789';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
      expect(result.matches.some((m) => m.type === 'ssn')).toBe(true);
      expect(result.redactedText).toContain('[SSN]');
    });
  });

  describe('IBAN detection', () => {
    it('should detect IBAN numbers', () => {
      const text = 'Transfer to FR7630006000011234567890189';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
      expect(result.matches.some((m) => m.type === 'iban')).toBe(true);
      expect(result.redactedText).toContain('[IBAN]');
    });
  });

  describe('IP address detection', () => {
    it('should detect IPv4 addresses', () => {
      const text = 'Server IP: 192.168.1.100';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
      expect(result.matches[0].type).toBe('ip_address');
      expect(result.redactedText).toBe('Server IP: [IP_ADDRESS]');
    });
  });

  describe('multiple PII types', () => {
    it('should detect multiple types in same text', () => {
      const text = 'Email: test@example.com, Phone: (555) 123-4567, Card: 4111111111111111';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
      expect(result.matches.length).toBeGreaterThanOrEqual(3);

      const types = result.matches.map((m) => m.type);
      expect(types).toContain('email');
      expect(types).toContain('credit_card');
    });
  });

  describe('configuration', () => {
    it('should respect detectTypes filter', () => {
      const guard = new PIIGuard({
        detectTypes: ['email'],
      });

      const text = 'Email: test@example.com, Phone: (555) 123-4567';
      const result = guard.detect(text);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].type).toBe('email');
    });

    it('should use custom redaction placeholder', () => {
      const guard = new PIIGuard({
        useTypedPlaceholders: false,
        redactionPlaceholder: '***',
      });

      const text = 'Email: test@example.com';
      const result = guard.detect(text);

      expect(result.redactedText).toBe('Email: ***');
    });

    it('should disable detection when enabled is false', () => {
      const guard = new PIIGuard({ enabled: false });

      const text = 'Email: test@example.com';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(false);
      expect(result.redactedText).toBe(text);
    });

    it('should call onPIIDetected callback', () => {
      const callback = vi.fn();
      const guard = new PIIGuard({
        onPIIDetected: callback,
      });

      guard.detect('Email: test@example.com');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'email' }),
        ]),
      );
    });

    it('should throw when throwOnPII is true', () => {
      const guard = new PIIGuard({ throwOnPII: true });

      expect(() => guard.detect('Email: test@example.com')).toThrow(OrkaError);
    });

    it('should respect minConfidence threshold', () => {
      const guard = new PIIGuard({
        minConfidence: 0.99,
      });

      const text = 'Email: test@example.com';
      const result = guard.detect(text);

      // Email has 0.95 confidence, should not match with 0.99 threshold
      expect(result.hasMatches).toBe(false);
    });
  });

  describe('allow list', () => {
    it('should not redact values matching allow list', () => {
      const guard = new PIIGuard({
        allowList: [/support@company\.com/],
      });

      const text = 'Contact support@company.com or personal@example.com';
      const result = guard.detect(text);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].value).toBe('personal@example.com');
      expect(result.redactedText).toBe('Contact support@company.com or [EMAIL]');
    });
  });

  describe('custom patterns', () => {
    it('should detect custom patterns', () => {
      const guard = new PIIGuard({
        customPatterns: [
          {
            name: 'employee_id',
            pattern: /EMP-\d{6}/g,
            redactWith: '[EMPLOYEE_ID]',
          },
        ],
      });

      const text = 'Employee EMP-123456 reported the issue';
      const result = guard.detect(text);

      expect(result.hasMatches).toBe(true);
      expect(result.matches[0].type).toBe('custom');
      expect(result.redactedText).toBe('Employee [EMPLOYEE_ID] reported the issue');
    });
  });

  describe('convenience methods', () => {
    it('redact() should return only redacted text', () => {
      const result = guard.redact('Email: test@example.com');
      expect(result).toBe('Email: [EMAIL]');
    });

    it('containsPII() should return boolean', () => {
      expect(guard.containsPII('Email: test@example.com')).toBe(true);
      expect(guard.containsPII('No sensitive data here')).toBe(false);
    });

    it('processForLLM() should redact when configured', () => {
      const guard = new PIIGuard({ redactBeforeLLM: true });
      const result = guard.processForLLM('Email: test@example.com');
      expect(result).toBe('Email: [EMAIL]');
    });

    it('processForLLM() should not redact when disabled', () => {
      const guard = new PIIGuard({ redactBeforeLLM: false });
      const text = 'Email: test@example.com';
      const result = guard.processForLLM(text);
      expect(result).toBe(text);
    });
  });

  describe('addPattern()', () => {
    it('should add custom pattern dynamically', () => {
      guard.addPattern({
        name: 'order_id',
        pattern: /ORD-\d{8}/g,
      });

      const result = guard.detect('Order ORD-12345678 shipped');
      expect(result.hasMatches).toBe(true);
      expect(result.redactedText).toBe('Order [ORDER_ID] shipped');
    });
  });

  describe('addToAllowList()', () => {
    it('should add to allow list dynamically', () => {
      guard.addToAllowList(/noreply@system\.com/);

      const result = guard.detect('From noreply@system.com');
      expect(result.hasMatches).toBe(false);
    });
  });
});

describe('createPIIGuard()', () => {
  it('should create a PIIGuard instance', () => {
    const guard = createPIIGuard({ detectTypes: ['email'] });
    expect(guard).toBeInstanceOf(PIIGuard);
  });
});

describe('redactPII()', () => {
  it('should redact PII from text', () => {
    const result = redactPII('Email: test@example.com');
    expect(result).toBe('Email: [EMAIL]');
  });

  it('should accept options', () => {
    const result = redactPII('Email: test@example.com', {
      useTypedPlaceholders: false,
      redactionPlaceholder: '[HIDDEN]',
    });
    expect(result).toBe('Email: [HIDDEN]');
  });
});

describe('detectPII()', () => {
  it('should return detection result', () => {
    const result = detectPII('Email: test@example.com');
    expect(result.hasMatches).toBe(true);
    expect(result.matches).toHaveLength(1);
  });
});

describe('RGPD compliance scenarios', () => {
  it('should handle typical customer data', () => {
    const customerData = `
      Nom: Jean Dupont
      Email: jean.dupont@email.fr
      Téléphone: 06 12 34 56 78
      IBAN: FR7630006000011234567890189
      IP: 192.168.1.50
    `;

    const result = detectPII(customerData);

    expect(result.hasMatches).toBe(true);
    expect(result.matches.length).toBeGreaterThanOrEqual(4);

    // Verify all sensitive data is redacted
    expect(result.redactedText).not.toContain('jean.dupont@email.fr');
    expect(result.redactedText).not.toContain('FR7630006000011234567890189');
    expect(result.redactedText).not.toContain('192.168.1.50');
  });

  it('should handle payment information', () => {
    const paymentInfo = 'Carte: 4111 1111 1111 1111, CVV: 123';

    const result = detectPII(paymentInfo);

    expect(result.hasMatches).toBe(true);
    expect(result.redactedText).toContain('[CREDIT_CARD]');
    expect(result.redactedText).not.toContain('4111');
  });
});

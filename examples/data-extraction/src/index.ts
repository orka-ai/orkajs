/**
 * Structured Data Extraction example.
 *
 * Demonstrates: llm.generateObject() with Zod schema validation.
 * Extracts structured invoice data from unstructured text.
 *
 * Usage:
 *   OPENAI_API_KEY=... pnpm start
 */
import { OpenAIAdapter } from '@orka-js/openai';
import { orkaInvoiceSchema, orkaContractSchema } from './schemas.js';
import type { Invoice, Contract } from './schemas.js';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('OPENAI_API_KEY is required'); process.exit(1); }

const llm = new OpenAIAdapter({ apiKey, model: 'gpt-4o-mini' });

// ─── Example 1: Extract invoice from text ───────────────────────────────────
const invoiceText = `
INVOICE #INV-2024-001
Date: January 15, 2024
Vendor: Acme Software Inc., 123 Tech Street, San Francisco CA 94105, billing@acme.com

Items:
- Professional License x3 @ $299.00/unit = $897.00
- Support Package x1 @ $150.00/unit = $150.00

Subtotal: $1,047.00
Tax (8.5%): $88.99
TOTAL DUE: $1,135.99 USD
`;

console.log('Extracting invoice data…\n');
const invoice = await llm.generateObject<Invoice>(
  orkaInvoiceSchema,
  `Extract all invoice data from this text:\n\n${invoiceText}`,
);
console.log('Extracted Invoice:');
console.log(JSON.stringify(invoice, null, 2));

// ─── Example 2: Extract contract data ───────────────────────────────────────
const contractText = `
SERVICE AGREEMENT
Between: TechCorp Inc. (Client) and DevAgency LLC (Service Provider)
Effective: March 1, 2024 — Expires: February 28, 2025
Contract Value: $120,000 USD

Key Terms:
1. Service Provider will deliver monthly software development services
2. Payment is due within 30 days of invoice
3. Either party may terminate with 30 days notice
4. All deliverables remain property of the Client
`;

console.log('\n\nExtracting contract data…\n');
const contract = await llm.generateObject<Contract>(
  orkaContractSchema,
  `Extract all contract information from this text:\n\n${contractText}`,
);
console.log('Extracted Contract:');
console.log(JSON.stringify(contract, null, 2));

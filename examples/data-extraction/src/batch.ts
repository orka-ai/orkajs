/**
 * Batch document extraction example.
 * Processes multiple documents concurrently using generateObject().
 *
 * Usage:
 *   OPENAI_API_KEY=... pnpm batch
 */
import { OpenAIAdapter } from '@orka-js/openai';
import { orkaInvoiceSchema } from './schemas.js';
import type { Invoice } from './schemas.js';
import fs from 'fs/promises';
import path from 'path';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error('OPENAI_API_KEY is required'); process.exit(1); }

const llm = new OpenAIAdapter({ apiKey, model: 'gpt-4o-mini' });

// Simulated batch of invoice texts
const BATCH_INVOICES = [
  { id: 'inv-1', text: 'Invoice #100, Date: 2024-01-01, Vendor: AlphaVendor, 2x Widget @ $50 = $100, Total: $100 USD' },
  { id: 'inv-2', text: 'Invoice #101, Date: 2024-01-02, Vendor: BetaCorp, 1x Service @ $500, Total: $500 USD' },
  { id: 'inv-3', text: 'Invoice #102, Date: 2024-01-03, Vendor: GammaTech, 5x License @ $99 = $495, Tax: $42, Total: $537 USD' },
];

console.log(`Processing ${BATCH_INVOICES.length} invoices concurrently…\n`);

const results = await Promise.allSettled(
  BATCH_INVOICES.map(async ({ id, text }) => {
    const invoice = await llm.generateObject<Invoice>(
      orkaInvoiceSchema,
      `Extract invoice data from: ${text}`,
    );
    return { id, invoice };
  })
);

const extracted: Array<{ id: string; invoice: Invoice }> = [];
const failures: Array<{ id: string; error: string }> = [];

for (let i = 0; i < results.length; i++) {
  const result = results[i];
  if (result.status === 'fulfilled') {
    extracted.push(result.value);
    console.log(`✓ ${result.value.id}: Invoice #${result.value.invoice.invoiceNumber}, Total: ${result.value.invoice.total} ${result.value.invoice.currency}`);
  } else {
    failures.push({ id: BATCH_INVOICES[i].id, error: result.reason.message });
    console.log(`✗ ${BATCH_INVOICES[i].id}: ${result.reason.message}`);
  }
}

console.log(`\nProcessed: ${extracted.length}/${BATCH_INVOICES.length} invoices`);

// Save results to JSON
const outputPath = path.join(process.cwd(), 'extracted-invoices.json');
await fs.writeFile(outputPath, JSON.stringify(extracted.map(e => e.invoice), null, 2));
console.log(`Results saved to ${outputPath}`);

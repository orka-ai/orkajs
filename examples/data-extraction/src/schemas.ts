import { z } from 'zod';
import type { OrkaSchema } from '@orka-js/core';

/**
 * Helper to wrap a Zod schema in an OrkaSchema.
 * This bridges Zod's API with OrkaJS's LLMAdapter.generateObject() interface.
 */
export function zodSchema<T>(schema: z.ZodType<T>, jsonSchema?: object): OrkaSchema<T> {
  return {
    jsonSchema,
    parse: (data: unknown) => schema.parse(data),
    safeParse: (data: unknown) => {
      const result = schema.safeParse(data);
      if (result.success) return { success: true as const, data: result.data };
      return { success: false as const, error: result.error };
    },
  };
}

// Invoice schema
export const InvoiceSchema = z.object({
  invoiceNumber: z.string(),
  date: z.string(),
  vendor: z.object({
    name: z.string(),
    address: z.string().optional(),
    email: z.string().optional(),
  }),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    total: z.number(),
  })),
  subtotal: z.number(),
  tax: z.number().optional(),
  total: z.number(),
  currency: z.string().default('USD'),
});

export type Invoice = z.infer<typeof InvoiceSchema>;

export const orkaInvoiceSchema = zodSchema(InvoiceSchema, {
  type: 'object',
  properties: {
    invoiceNumber: { type: 'string' },
    date: { type: 'string' },
    vendor: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['name'],
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          total: { type: 'number' },
        },
        required: ['description', 'quantity', 'unitPrice', 'total'],
      },
    },
    subtotal: { type: 'number' },
    tax: { type: 'number' },
    total: { type: 'number' },
    currency: { type: 'string' },
  },
  required: ['invoiceNumber', 'date', 'vendor', 'items', 'subtotal', 'total'],
});

// Contract schema
export const ContractSchema = z.object({
  title: z.string(),
  parties: z.array(z.object({
    name: z.string(),
    role: z.string(),
    address: z.string().optional(),
  })),
  effectiveDate: z.string(),
  expirationDate: z.string().optional(),
  keyTerms: z.array(z.string()),
  value: z.number().optional(),
  currency: z.string().optional(),
});

export type Contract = z.infer<typeof ContractSchema>;

export const orkaContractSchema = zodSchema(ContractSchema, {
  type: 'object',
  properties: {
    title: { type: 'string' },
    parties: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } }, required: ['name', 'role'] } },
    effectiveDate: { type: 'string' },
    expirationDate: { type: 'string' },
    keyTerms: { type: 'array', items: { type: 'string' } },
    value: { type: 'number' },
    currency: { type: 'string' },
  },
  required: ['title', 'parties', 'effectiveDate', 'keyTerms'],
});

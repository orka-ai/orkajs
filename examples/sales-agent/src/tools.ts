import type { Tool } from '@orka-js/agent';

export const searchCompanyTool: Tool = {
  name: 'search_company',
  description: 'Look up company information — size, industry, funding, tech stack',
  parameters: [
    { name: 'name', type: 'string', description: 'Company name to look up', required: true },
  ],
  execute: async ({ name }: { name: string }) => {
    // Mock database — in production, connect to Clearbit, Apollo, or similar
    const companies: Record<string, object> = {
      'Acme Corp': { employees: 500, industry: 'SaaS', funding: 'Series B', tech: ['React', 'Node.js'] },
      'TechStartup': { employees: 50, industry: 'Fintech', funding: 'Seed', tech: ['Python', 'Django'] },
    };
    const data = companies[name] ?? { employees: 'unknown', industry: 'unknown', funding: 'unknown' };
    return JSON.stringify({ company: name, ...data });
  },
};

export const sendEmailTool: Tool = {
  name: 'send_email',
  description: 'Send a prospecting or follow-up email',
  parameters: [
    { name: 'to', type: 'string', description: 'Recipient email', required: true },
    { name: 'subject', type: 'string', description: 'Email subject', required: true },
    { name: 'body', type: 'string', description: 'Email body (plain text)', required: true },
  ],
  execute: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
    // Mock — in production, use SendGrid, Mailgun, etc.
    console.error(`[Email] To: ${to} | Subject: ${subject}`);
    return `Email queued successfully to ${to}`;
  },
};

export const scheduleDemoTool: Tool = {
  name: 'schedule_demo',
  description: 'Schedule a product demo meeting',
  parameters: [
    { name: 'contact', type: 'string', description: 'Contact name', required: true },
    { name: 'company', type: 'string', description: 'Company name', required: true },
    { name: 'preferred_time', type: 'string', description: 'Preferred meeting time', required: false },
  ],
  execute: async ({ contact, company }: { contact: string; company: string }) => {
    const meetingId = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `Demo scheduled! Meeting ID: ${meetingId} — ${contact} from ${company}`;
  },
};

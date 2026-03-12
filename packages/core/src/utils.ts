import { randomBytes } from 'crypto';

let counter = 0;

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(6).toString('hex');
  const seq = (counter++ & 0xFFFF).toString(36);
  return `${timestamp}_${random}_${seq}`;
}

let counter = 0;

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const random = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const seq = (counter++ & 0xFFFF).toString(36);
  return `${timestamp}_${random}_${seq}`;
}

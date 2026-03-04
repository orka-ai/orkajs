import type { Chunk, Document } from '../types/index.js';

export interface ChunkerOptions {
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
}

const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

export function chunkDocument(doc: Document, options: ChunkerOptions): Chunk[] {
  const { chunkSize, chunkOverlap, separators = DEFAULT_SEPARATORS } = options;
  const chunks: Chunk[] = [];
  
  const textChunks = splitText(doc.content, chunkSize, chunkOverlap, separators);
  
  for (let i = 0; i < textChunks.length; i++) {
    chunks.push({
      id: `${doc.id}_chunk_${i}`,
      content: textChunks[i],
      documentId: doc.id,
      index: i,
      metadata: { ...doc.metadata },
    });
  }
  
  return chunks;
}

function splitText(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  separators: string[]
): string[] {
  const chunks: string[] = [];
  
  if (text.length <= chunkSize) {
    return [text.trim()].filter(Boolean);
  }
  
  const separator = findBestSeparator(text, separators);
  const splits = separator ? text.split(separator) : [text];
  
  let currentChunk = '';
  
  for (const split of splits) {
    const piece = split.trim();
    if (!piece) continue;
    
    const potentialChunk = currentChunk 
      ? currentChunk + separator + piece 
      : piece;
    
    if (potentialChunk.length <= chunkSize) {
      currentChunk = potentialChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
        currentChunk = currentChunk.slice(overlapStart) + separator + piece;
        
        if (currentChunk.length > chunkSize) {
          currentChunk = piece;
        }
      } else {
        if (piece.length > chunkSize && separators.length > 1) {
          const subChunks = splitText(piece, chunkSize, chunkOverlap, separators.slice(1));
          chunks.push(...subChunks);
        } else {
          chunks.push(piece.slice(0, chunkSize));
          currentChunk = piece.slice(chunkSize - chunkOverlap);
        }
      }
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(Boolean);
}

function findBestSeparator(text: string, separators: string[]): string {
  for (const sep of separators) {
    if (sep && text.includes(sep)) {
      return sep;
    }
  }
  return '';
}

export function chunkDocuments(docs: Document[], options: ChunkerOptions): Chunk[] {
  return docs.flatMap(doc => chunkDocument(doc, options));
}

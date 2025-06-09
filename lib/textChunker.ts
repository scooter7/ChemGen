// lib/textChunker.ts
/**
 * Split a long string into smaller chunks.
 * @param text — the full text to split
 * @param chunkSize — max chars per chunk (default: 1000)
 */
export function chunkText(text: string, chunkSize = 1000): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

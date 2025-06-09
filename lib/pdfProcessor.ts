// lib/pdfProcessor.ts
import pdfParse from 'pdf-parse';

/**
 * Extracts text from a PDF buffer.
 *
 * ONLY accepts a Buffer; never reads from disk.
 */
export async function extractPdfData(
  input: Buffer
): Promise<{ text: string }> {
  if (!Buffer.isBuffer(input)) {
    throw new Error(`extractPdfData(): expected a Buffer, got ${typeof input}`);
  }
  const { text } = await pdfParse(input);
  return { text };
}

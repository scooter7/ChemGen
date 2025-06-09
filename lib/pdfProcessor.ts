// lib/pdfProcessor.ts

import pdfParse from 'pdf-parse';

/**
 * Extract text from a PDF buffer.
 *
 * Only accepts a Buffer. Will never try to read from disk.
 */
export async function extractPdfData(
  input: Buffer
): Promise<{ text: string }> {
  if (!Buffer.isBuffer(input)) {
    throw new Error(
      `extractPdfData(): expected a Buffer, got ${typeof input}`
    );
  }

  const { text } = await pdfParse(input);
  return { text };
}

// lib/pdfProcessor.ts

import pdfParse from 'pdf-parse';

/**
 * Extracts text from a PDF buffer.
 *
 * @param input – A Buffer containing PDF bytes (e.g. from Supabase.download)
 * @returns     – An object with the extracted `text`
 */
export async function extractPdfData(
  input: Buffer
): Promise<{ text: string }> {
  if (!Buffer.isBuffer(input)) {
    throw new Error(
      'extractPdfData(): expected a Buffer, got ' + typeof input
    );
  }

  const { text } = await pdfParse(input);
  return { text };
}

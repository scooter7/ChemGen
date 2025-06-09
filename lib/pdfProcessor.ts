// lib/pdfProcessor.ts

import pdf from 'pdf-parse';

export interface PdfData {
  text: string;
  numpages: number;
  numrender: number;
  info: Record<string, unknown>;
  metadata: Record<string, unknown>;
  version: string;
}

/**
 * Parse a PDF file buffer and return its extracted text and metadata.
 *
 * @param buffer - A Buffer containing the raw PDF bytes.
 * @returns A PdfData object with text, page count, and metadata.
 */
export async function extractPdfData(buffer: Buffer): Promise<PdfData> {
  try {
    const data = (await pdf(buffer)) as PdfData;
    return data;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF');
  }
}

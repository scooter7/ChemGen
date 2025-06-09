// lib/pdfProcessor.ts

import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';

/**
 * Extracts text from a PDF buffer or file-path.
 *
 * @param input  – Buffer (e.g. from Supabase.download) or string path to PDF.
 * @returns      – { text: string } from pdf-parse
 */
export async function extractPdfData(
  input: Buffer | string
): Promise<{ text: string }> {
  let dataBuffer: Buffer;

  if (Buffer.isBuffer(input)) {
    // direct buffer (production route)
    dataBuffer = input;
  } else {
    // string path (e.g. manual tests or debug)
    // resolve relative to project root
    const filePath = path.isAbsolute(input)
      ? input
      : path.join(process.cwd(), input);

    dataBuffer = await fs.promises.readFile(filePath);
  }

  const { text } = await pdfParse(dataBuffer);
  return { text };
}

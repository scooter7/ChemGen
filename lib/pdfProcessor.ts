// lib/pdfProcessor.ts
import { createClient } from '@supabase/supabase-js';
// Using require for pdf-parse as it's more stable in Node.js environments
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse');

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

const BUCKET = 'source-materials';

interface SourceInfo {
  storagePath: string;
  fileType: string | null;
}

export async function extractTextFromSource(source: SourceInfo): Promise<string> {
  const { data: fileData, error } = await supabaseAdmin
    .storage.from(BUCKET).download(source.storagePath);

  if (error || !fileData) {
    throw new Error(`Download failed: ${error?.message}`);
  }

  const fileBuffer = Buffer.from(await fileData.arrayBuffer());

  let text = '';
  if (source.fileType === 'application/pdf') {
    const pdfData = await pdf(fileBuffer);
    text = pdfData.text;
  } else if (source.fileType?.startsWith('text/')) {
    text = fileBuffer.toString('utf-8');
  } else {
    throw new Error(`Unsupported file type: ${source.fileType}`);
  }

  if (!text.trim()) {
    throw new Error('No text could be extracted from the document.');
  }

  return text;
}
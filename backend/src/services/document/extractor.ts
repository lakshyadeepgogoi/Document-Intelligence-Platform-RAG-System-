import fs from 'fs';
import path from 'path';

// pdf-parse types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mammoth = require('mammoth');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const OfficeParser = require('officeparser');

export interface ExtractedContent {
  text: string;
  pages?: number;
  metadata?: Record<string, unknown>;
}

export async function extractText(
  filePath: string,
  mimeType: string
): Promise<ExtractedContent> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  switch (mimeType) {
    case 'application/pdf':
      return extractPdf(filePath);

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/msword':
      return extractDocx(filePath);

    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'application/vnd.ms-powerpoint':
      return extractPptx(filePath);

    case 'text/plain':
      return extractTxt(filePath);

    default:
      throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}

async function extractPdf(filePath: string): Promise<ExtractedContent> {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    pages: data.numpages,
    metadata: data.info,
  };
}

async function extractDocx(filePath: string): Promise<ExtractedContent> {
  const result = await mammoth.extractRawText({ path: filePath });
  if (result.messages.length > 0) {
    console.warn('[DOCX Extractor] Warnings:', result.messages);
  }
  return {
    text: result.value,
    pages: undefined,
  };
}

async function extractPptx(filePath: string): Promise<ExtractedContent> {
  return new Promise((resolve, reject) => {
    OfficeParser.parseOffice(filePath, (text: string, err: Error) => {
      if (err) {
        reject(new Error(`Failed to parse PPTX: ${err.message}`));
        return;
      }
      resolve({ text: text || '', pages: undefined });
    });
  });
}

async function extractTxt(filePath: string): Promise<ExtractedContent> {
  const text = fs.readFileSync(filePath, 'utf-8');
  return { text };
}

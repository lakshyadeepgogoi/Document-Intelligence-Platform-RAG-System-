export interface TextChunk {
  content: string;
  startChar: number;
  endChar: number;
  chunkIndex: number;
  totalChunks: number;
}

const DEFAULT_CHUNK_SIZE = 800;      // characters (~200 tokens)
const DEFAULT_CHUNK_OVERLAP = 150;   // characters
const MIN_CHUNK_LENGTH = 50;         // skip trivially short chunks

/**
 * Recursive character-based text splitter.
 * Tries to split on paragraph breaks → sentence ends → words → characters.
 */
export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  chunkOverlap = DEFAULT_CHUNK_OVERLAP
): TextChunk[] {
  // Normalize whitespace
  const normalised = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  const rawChunks = recursiveSplit(normalised, chunkSize, chunkOverlap);

  // Filter trivial chunks and rebuild with positional metadata
  const filtered: string[] = rawChunks.filter((c) => c.trim().length >= MIN_CHUNK_LENGTH);

  const result: TextChunk[] = [];
  let searchFrom = 0;

  for (let i = 0; i < filtered.length; i++) {
    const content = filtered[i].trim();
    const startChar = normalised.indexOf(content, searchFrom);
    const endChar = startChar + content.length;

    result.push({
      content,
      startChar: Math.max(0, startChar),
      endChar,
      chunkIndex: i,
      totalChunks: filtered.length, // will update after loop
    });

    // Advance search position with overlap look-back
    searchFrom = Math.max(searchFrom, endChar - chunkOverlap);
  }

  // Fix totalChunks now we know the final count
  result.forEach((c) => (c.totalChunks = result.length));

  return result;
}

function recursiveSplit(text: string, chunkSize: number, overlap: number): string[] {
  if (text.length <= chunkSize) return [text];

  const separators = ['\n\n', '\n', '. ', ' ', ''];

  for (const sep of separators) {
    if (sep === '' || text.includes(sep)) {
      const parts = sep ? text.split(sep) : text.split('');
      const chunks: string[] = [];
      let current = '';

      for (const part of parts) {
        const candidate = current ? current + sep + part : part;

        if (candidate.length <= chunkSize) {
          current = candidate;
        } else {
          if (current) chunks.push(current);
          // Start new chunk with overlap from previous
          const prevWords = current.split(' ');
          const overlapText = prevWords
            .slice(Math.max(0, prevWords.length - Math.ceil(overlap / 5)))
            .join(' ');
          current = overlapText ? overlapText + sep + part : part;
        }
      }

      if (current) chunks.push(current);
      if (chunks.length > 1) return chunks;
    }
  }

  // Hard split as last resort
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

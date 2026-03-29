/**
 * Document Chunker
 * Splits documents into overlapping chunks for RAG.
 */

export interface Chunk {
  content: string;
  index: number;
  tokenCount: number;
}

/** Rough token count estimation (1 token ≈ 4 chars for English, ~2 chars for Japanese) */
function estimateTokens(text: string): number {
  const japaneseChars = (text.match(/[\u3000-\u9fff\uff00-\uffef]/g) || []).length;
  const otherChars = text.length - japaneseChars;
  return Math.ceil(japaneseChars / 2 + otherChars / 4);
}

/**
 * Split text into chunks with overlap.
 * @param text - Source text
 * @param maxTokens - Maximum tokens per chunk (default: 512)
 * @param overlapTokens - Overlap tokens between chunks (default: 128)
 */
export function chunkText(
  text: string,
  maxTokens: number = 512,
  overlapTokens: number = 128
): Chunk[] {
  if (!text.trim()) return [];

  // Split by paragraphs first, then by sentences
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const chunks: Chunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    // If single paragraph exceeds max, split by sentences
    if (paragraphTokens > maxTokens) {
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex++,
          tokenCount: estimateTokens(currentChunk.trim()),
        });
        currentChunk = '';
      }

      const sentences = paragraph.split(/(?<=[。．.!！?？\n])/);
      for (const sentence of sentences) {
        if (estimateTokens(currentChunk + sentence) > maxTokens && currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex++,
            tokenCount: estimateTokens(currentChunk.trim()),
          });
          // Overlap: keep last portion
          const words = currentChunk.split(/\s+/);
          const overlapWords = Math.ceil(words.length * (overlapTokens / maxTokens));
          currentChunk = words.slice(-overlapWords).join(' ') + ' ';
        }
        currentChunk += sentence;
      }
    } else if (estimateTokens(currentChunk + '\n\n' + paragraph) > maxTokens) {
      // Current chunk is full, start new one
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex++,
          tokenCount: estimateTokens(currentChunk.trim()),
        });
        // Overlap
        const words = currentChunk.split(/\s+/);
        const overlapWords = Math.ceil(words.length * (overlapTokens / maxTokens));
        currentChunk = words.slice(-overlapWords).join(' ') + '\n\n';
      }
      currentChunk += paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  // Final chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      tokenCount: estimateTokens(currentChunk.trim()),
    });
  }

  return chunks;
}

/**
 * Extract text from different file types
 */
export async function extractText(buffer: Buffer, fileType: string): Promise<string> {
  switch (fileType) {
    case 'pdf': {
      // Dynamic import for pdf-parse
      const pdfModule = await import('pdf-parse');
      const pdfParse = (pdfModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default || pdfModule;
      const result = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buffer);
      return result.text;
    }
    case 'txt':
      return buffer.toString('utf-8');
    case 'csv': {
      // Treat each row as a paragraph
      const lines = buffer.toString('utf-8').split('\n').filter(l => l.trim());
      return lines.join('\n\n');
    }
    case 'json': {
      // Try to extract text from JSON (FAQ format: [{question, answer}])
      const data = JSON.parse(buffer.toString('utf-8'));
      if (Array.isArray(data)) {
        return data.map(item => {
          if (item.question && item.answer) {
            return `Q: ${item.question}\nA: ${item.answer}`;
          }
          return JSON.stringify(item);
        }).join('\n\n');
      }
      return JSON.stringify(data, null, 2);
    }
    default:
      return buffer.toString('utf-8');
  }
}

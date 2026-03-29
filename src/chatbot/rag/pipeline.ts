/**
 * RAG Pipeline
 * Orchestrates document processing: upload → extract → chunk → embed → store
 */
import { extractText, chunkText } from './chunker.js';
import { embedBatch } from './embedder.js';
import { insertChunks, updateDocumentStatus } from '../storage.js';

/**
 * Process an uploaded document through the full RAG pipeline.
 * Runs asynchronously after upload response is sent.
 */
export async function processDocument(
  documentId: string,
  chatbotId: string,
  workspaceId: string,
  fileBuffer: Buffer,
  fileType: string
): Promise<void> {
  try {
    // 1. Extract text from document
    const text = await extractText(fileBuffer, fileType);
    if (!text.trim()) {
      await updateDocumentStatus(documentId, 'error', 0, 'No text content found in document');
      return;
    }

    // 2. Split into chunks
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      await updateDocumentStatus(documentId, 'error', 0, 'Failed to create chunks from document');
      return;
    }

    // 3. Generate embeddings for all chunks
    const texts = chunks.map(c => c.content);
    const embeddings = await embedBatch(texts);

    // 4. Store chunks with embeddings
    const chunkRecords = chunks.map((chunk, i) => ({
      document_id: documentId,
      chatbot_id: chatbotId,
      workspace_id: workspaceId,
      content: chunk.content,
      chunk_index: chunk.index,
      token_count: chunk.tokenCount,
      embedding: embeddings[i],
    }));

    await insertChunks(chunkRecords);

    // 5. Update document status
    await updateDocumentStatus(documentId, 'ready', chunks.length);

    console.log(`[RAG Pipeline] Document ${documentId} processed: ${chunks.length} chunks`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during processing';
    console.error(`[RAG Pipeline] Error processing document ${documentId}:`, message);
    await updateDocumentStatus(documentId, 'error', 0, message);
  }
}

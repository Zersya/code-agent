import axios from 'axios';
import dotenv from 'dotenv';
import { CodeFile, CodeEmbedding } from '../models/embedding.js';

dotenv.config();

const QODO_EMBED_API_URL = process.env.QODO_EMBED_API_URL || 'http://localhost:8000/v1/embeddings';

const qodoApi = axios.create({
  baseURL: QODO_EMBED_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export class EmbeddingService {
  /**
   * Generate embeddings for a single code file with retry logic
   */
  async generateEmbedding(text: string, maxRetries: number = 3): Promise<number[]> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries <= maxRetries) {
      try {
        const response = await qodoApi.post('', {
          model: 'qodo-embed-1',
          input: text,
        });

        return response.data.data[0].embedding;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Error generating embedding (attempt ${retries + 1}/${maxRetries + 1}):`, error);

        // Check if we should retry
        if (retries >= maxRetries) {
          break;
        }

        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, retries) * 1000;
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        console.log(`Retrying embedding generation in ${Math.round(delay)}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));

        retries++;
      }
    }

    // If we've exhausted all retries, throw the last error
    throw lastError || new Error('Failed to generate embedding after multiple attempts');
  }

  /**
   * Generate embeddings for multiple code files in batches with improved concurrency control
   */
  async generateEmbeddings(
    files: CodeFile[],
    projectId: number,
    commitId: string,
    branch: string,
    batchSize: number = 3, // Reduced batch size for better stability
    maxRetries: number = 3
  ): Promise<CodeEmbedding[]> {
    const embeddings: CodeEmbedding[] = [];
    const failedFiles: { file: CodeFile, error: string }[] = [];

    console.log(`Starting embedding generation for ${files.length} files with batch size ${batchSize}`);

    // Filter out binary files, large files, or files without content first
    const validFiles = files.filter(file =>
      file.content &&
      file.content.length <= 100000 &&
      !this.isBinaryContent(file.content)
    );

    console.log(`Found ${validFiles.length} valid files for embedding after filtering`);

    // Process files in batches
    for (let i = 0; i < validFiles.length; i += batchSize) {
      const batch = validFiles.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(validFiles.length / batchSize);

      console.log(`Processing batch ${batchNumber} of ${totalBatches} (${batch.length} files)`);

      try {
        // Process each file in the batch sequentially to avoid overwhelming the API
        for (const file of batch) {
          try {
            console.log(`Generating embedding for file: ${file.path}`);

            const embedding = await this.generateEmbedding(file.content, maxRetries);

            embeddings.push({
              projectId,
              repositoryUrl: '',  // Will be filled in by the caller
              filePath: file.path,
              content: file.content,
              embedding,
              language: file.language,
              commitId,
              branch,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            console.log(`Successfully generated embedding for file: ${file.path}`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Failed to generate embedding for file ${file.path} after retries:`, error);
            failedFiles.push({ file, error: errorMessage });
          }

          // Add a small delay between files to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Add a delay between batches to avoid rate limiting
        if (i + batchSize < validFiles.length) {
          const delay = 2000; // 2 seconds between batches
          console.log(`Waiting ${delay}ms before processing next batch`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (batchError) {
        console.error(`Error processing batch ${batchNumber}:`, batchError);
        // Continue with the next batch even if this one failed
      }
    }

    // Log summary
    console.log(`Embedding generation complete. Generated ${embeddings.length} embeddings.`);
    if (failedFiles.length > 0) {
      console.warn(`Failed to generate embeddings for ${failedFiles.length} files.`);
    }

    return embeddings;
  }

  /**
   * Simple check to detect binary content
   */
  private isBinaryContent(content: string): boolean {
    // Check for null bytes or a high ratio of non-printable characters
    if (content.includes('\0')) {
      return true;
    }

    const nonPrintableCount = content.split('').filter(char => {
      const code = char.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13; // Exclude tabs, newlines, and carriage returns
    }).length;

    // If more than 10% of characters are non-printable, consider it binary
    return nonPrintableCount > content.length * 0.1;
  }

  /**
   * Chunk large files into smaller segments for embedding
   * This is useful for very large files that might exceed token limits
   */
  chunkCodeFile(file: CodeFile, maxChunkSize: number = 8000): CodeFile[] {
    if (!file.content || file.content.length <= maxChunkSize) {
      return [file];
    }

    const chunks: CodeFile[] = [];
    const lines = file.content.split('\n');
    let currentChunk = '';
    let chunkIndex = 0;

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxChunkSize) {
        chunks.push({
          ...file,
          path: `${file.path}#chunk${chunkIndex}`,
          content: currentChunk,
        });

        currentChunk = line + '\n';
        chunkIndex++;
      } else {
        currentChunk += line + '\n';
      }
    }

    if (currentChunk) {
      chunks.push({
        ...file,
        path: `${file.path}#chunk${chunkIndex}`,
        content: currentChunk,
      });
    }

    return chunks;
  }
}

export const embeddingService = new EmbeddingService();

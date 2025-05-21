import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { CodeFile, CodeEmbedding } from '../models/embedding.js';

dotenv.config();

const QODO_EMBED_API_URL = process.env.QODO_EMBED_API_URL || 'http://localhost:8000/v1/embeddings';

// Default list of allowed file extensions if not specified in environment variables
const DEFAULT_ALLOWED_EXTENSIONS = [
  // JavaScript/TypeScript
  'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs',
  // Web
  'html', 'css', 'scss', 'less', 'vue', 'svelte',
  // Backend
  'php', 'py', 'rb', 'java', 'go', 'cs', 'rs', 'swift', 'kt',
  // Data/Config
  'json', 'xml', 'yaml', 'yml', 'toml', 'ini',
  // Documentation
  'md', 'txt',
  // Shell/Scripts
  'sh', 'bash', 'zsh', 'ps1',
  // SQL
  'sql',
  // C/C++
  'c', 'cpp', 'h', 'hpp'
];

// Parse allowed file extensions from environment variable or use defaults
const ALLOWED_FILE_EXTENSIONS = process.env.ALLOWED_FILE_EXTENSIONS
  ? process.env.ALLOWED_FILE_EXTENSIONS.split(',').map(ext => ext.trim().toLowerCase())
  : DEFAULT_ALLOWED_EXTENSIONS;

const qodoApi = axios.create({
  baseURL: QODO_EMBED_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export class EmbeddingService {
  /**
   * Check if a file should be processed based on its extension
   * @param filePath The path of the file to check
   * @returns True if the file should be processed, false otherwise
   */
  isAllowedFileExtension(filePath: string): boolean {
    // Extract the file extension (without the dot)
    const extension = path.extname(filePath).toLowerCase().replace(/^\./, '');

    // If no extension, don't process the file
    if (!extension) {
      return false;
    }

    // Check if the extension is in the allowed list
    return ALLOWED_FILE_EXTENSIONS.includes(extension);
  }

  /**
   * Get the list of allowed file extensions
   * @returns Array of allowed file extensions
   */
  getAllowedFileExtensions(): string[] {
    return [...ALLOWED_FILE_EXTENSIONS];
  }
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

    // Log file extension statistics
    const extensionStats = this.getFileExtensionStats(files);
    console.log('File extension statistics:', JSON.stringify(extensionStats, null, 2));

    // First, filter by file extension
    const extensionFilteredFiles = files.filter(file => {
      const isAllowed = this.isAllowedFileExtension(file.path);
      if (!isAllowed) {
        console.log(`Skipping file with unsupported extension: ${file.path}`);
      }
      return isAllowed;
    });

    console.log(`Found ${extensionFilteredFiles.length} files with allowed extensions out of ${files.length} total files`);

    // Then filter out binary files, large files, or files without content
    const validFiles = extensionFilteredFiles.filter(file => {
      if (!file.content) {
        console.log(`Skipping file with no content: ${file.path}`);
        return false;
      }

      if (file.content.length > 100000) {
        console.log(`Skipping file that exceeds size limit (${file.content.length} chars): ${file.path}`);
        return false;
      }

      if (this.isBinaryContent(file.content)) {
        console.log(`Skipping binary file: ${file.path}`);
        return false;
      }

      return true;
    });

    console.log(`Found ${validFiles.length} valid files for embedding after all filtering steps`);

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
   * Get statistics about file extensions in a repository
   * This is useful for debugging and monitoring
   * @param files List of files to analyze
   * @returns Object with statistics about file extensions
   */
  getFileExtensionStats(files: CodeFile[]): {
    totalFiles: number;
    extensionCounts: Record<string, number>;
    allowedExtensions: string[];
    allowedFileCount: number;
    skippedFileCount: number;
  } {
    const stats = {
      totalFiles: files.length,
      extensionCounts: {} as Record<string, number>,
      allowedExtensions: ALLOWED_FILE_EXTENSIONS,
      allowedFileCount: 0,
      skippedFileCount: 0
    };

    // Count files by extension
    for (const file of files) {
      const extension = path.extname(file.path).toLowerCase().replace(/^\./, '');

      // Count by extension
      if (extension) {
        stats.extensionCounts[extension] = (stats.extensionCounts[extension] || 0) + 1;
      } else {
        stats.extensionCounts['no-extension'] = (stats.extensionCounts['no-extension'] || 0) + 1;
      }

      // Count allowed vs skipped
      if (this.isAllowedFileExtension(file.path)) {
        stats.allowedFileCount++;
      } else {
        stats.skippedFileCount++;
      }
    }

    return stats;
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

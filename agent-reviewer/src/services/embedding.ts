import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { gitlabService } from './gitlab.js';
import { dbService } from './database.js';
import { queueService } from './queue.js';
import { repositoryService } from './repository.js';
import { JobStatus } from '../models/queue.js';
import { v4 as uuidv4 } from 'uuid';
import { CodeFile, CodeEmbedding } from '../models/embedding.js';

dotenv.config();

const QODO_EMBED_API_URL = process.env.QODO_EMBED_API_URL || 'http://localhost:8000/v1/embeddings';

// Default list of allowed file extensions if not specified in environment variables
const DEFAULT_ALLOWED_EXTENSIONS = [
  // JavaScript/TypeScript
  'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs', 'd.ts',
  // Web
  'html', 'css', 'scss', 'less', 'vue', 'svelte', 'astro',
  // Backend
  'php', 'py', 'rb', 'java', 'go', 'cs', 'rs', 'swift', 'kt', 'scala', 'clj', 'ex', 'exs',
  // Data/Config
  'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'env', 'properties', 'conf', 'config',
  // Documentation
  'md', 'txt', 'rst', 'adoc', 'asciidoc',
  // Shell/Scripts
  'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
  // SQL
  'sql', 'prisma', 'graphql', 'gql',
  // C/C++
  'c', 'cpp', 'h', 'hpp', 'cc', 'hh',
  // API/Testing
  'bru', 'http', 'rest', 'spec', 'test',
  // Mobile
  'dart', 'kotlin', 'swift', 'xcodeproj',
  // Other
  'lock', 'gradle', 'plist', 'editorconfig', 'gitignore'
];

// Parse allowed file extensions from environment variable or use defaults
const ALLOWED_FILE_EXTENSIONS = process.env.ALLOWED_FILE_EXTENSIONS
  ? process.env.ALLOWED_FILE_EXTENSIONS.split(',').map(ext => ext.trim().toLowerCase())
  : DEFAULT_ALLOWED_EXTENSIONS;

  const AUTO_EMBED_PROJECTS = process.env.AUTO_EMBED_PROJECTS === 'true';
const EMBEDDING_WAIT_TIMEOUT = Number(process.env.EMBEDDING_WAIT_TIMEOUT) || 300; // 5 minutes default

// Special files without extensions that should be processed
const SPECIAL_FILES_WITHOUT_EXTENSIONS = [
  'dockerfile', 'makefile', 'jenkinsfile', 'vagrantfile', 'procfile',
  'gemfile', 'rakefile', 'brewfile', 'fastfile',
  '.gitignore', '.dockerignore', '.env', '.npmrc', '.yarnrc', '.babelrc',
  '.eslintrc', '.prettierrc', '.editorconfig', 'license', 'readme',
  'changelog', 'contributing', 'authors', 'codeowners'
];

const qodoApi = axios.create({
  baseURL: QODO_EMBED_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export class EmbeddingService {
  /**
   * Check if a file should be processed based on its extension or name
   * @param filePath The path of the file to check
   * @returns True if the file should be processed, false otherwise
   */
  isAllowedFileExtension(filePath: string): boolean {
    // Extract the file extension (without the dot)
    const extension = path.extname(filePath).toLowerCase().replace(/^\./, '');

    // If there's an extension, check if it's in the allowed list
    if (extension) {
      return ALLOWED_FILE_EXTENSIONS.includes(extension);
    }

    // For files without extensions, check if it's a special file
    const fileName = path.basename(filePath).toLowerCase();

    // Check if it's in our special files list
    if (SPECIAL_FILES_WITHOUT_EXTENSIONS.includes(fileName)) {
      return true;
    }

    // Check for files with dot prefixes (hidden files)
    if (fileName.startsWith('.') && SPECIAL_FILES_WITHOUT_EXTENSIONS.includes(fileName)) {
      return true;
    }

    // For merge request diffs, we might want to process files without extensions
    // if they appear to contain code. Let's check the first part of the path
    // to see if it might be a source code file
    const pathParts = filePath.toLowerCase().split('/');
    const sourceDirs = ['src', 'lib', 'app', 'source', 'core', 'api', 'server', 'client', 'components'];

    // If the file is in a source directory, it's likely code even without an extension
    for (const dir of sourceDirs) {
      if (pathParts.includes(dir)) {
        console.log(`Processing file without extension in source directory: ${filePath}`);
        return true;
      }
    }

    // By default, skip files without extensions
    return false;
  }

  /**
   * Get the list of allowed file extensions
   * @returns Array of allowed file extensions
   */
  getAllowedFileExtensions(): string[] {
    return [...ALLOWED_FILE_EXTENSIONS];
  }

  /**
   * Get the list of special files without extensions that are allowed
   * @returns Array of special files without extensions
   */
  getSpecialFilesWithoutExtensions(): string[] {
    return [...SPECIAL_FILES_WITHOUT_EXTENSIONS];
  }
   /**
     * Check if a project has embeddings and trigger embedding process if needed
     * @param projectId The ID of the project
     * @param waitForCompletion Whether to wait for the embedding process to complete
     * @returns True if the project has embeddings or embedding was triggered, false otherwise
     */
    async checkAndEmbedProject(projectId: number, waitForCompletion: boolean = false): Promise<boolean> {
      try {

        // Check if the project has embeddings
        const hasEmbeddings = await dbService.hasEmbeddings(projectId);

        if (hasEmbeddings) {
          console.log(`Project ${projectId} already has embeddings`);
          return true;
        }

        // If auto-embedding is disabled, just return false
        if (!AUTO_EMBED_PROJECTS) {
          console.log(`Project ${projectId} has no embeddings, but auto-embedding is disabled`);
          return false;
        }

        console.log(`Project ${projectId} has no embeddings, triggering embedding process`);

        // Get project details from GitLab
        const project = await gitlabService.getProject(projectId);

        if (!project) {
          console.error(`Could not find project ${projectId} in GitLab`);
          return false;
        }

        // Queue the project for embedding with high priority
        const processingId = uuidv4();
        await queueService.addJob(projectId, project.web_url, processingId, 10);

        console.log(`Project ${projectId} queued for embedding (processingId: ${processingId})`);

        // If we don't need to wait for completion, return true
        if (!waitForCompletion) {
          return true;
        }

        // Wait for the embedding process to complete with a timeout
        console.log(`Waiting for embedding process to complete for project ${projectId}`);
        const job = await queueService.waitForJobCompletion(processingId, EMBEDDING_WAIT_TIMEOUT);

        if (!job) {
          console.warn(`Could not get job status for project ${projectId}`);
          return false;
        }

        if (job.status === JobStatus.COMPLETED) {
          console.log(`Embedding process completed successfully for project ${projectId}`);
          return true;
        } else {
          console.warn(`Embedding process did not complete successfully for project ${projectId}: ${job.status}`);
          return false;
        }
      } catch (error) {
        console.error(`Error checking and embedding project ${projectId}:`, error);
        return false;
      }
    }

  /**
   * Trigger re-embedding for a project after a merge
   * This clears existing embeddings and queues a new embedding job
   * @param projectId The ID of the project
   * @param repositoryUrl The URL of the repository
   * @param targetBranch The target branch that was merged into (usually main/master)
   * @returns True if re-embedding was successfully queued, false otherwise
   */
  async triggerProjectReEmbedding(projectId: number, repositoryUrl: string, targetBranch: string): Promise<boolean> {
    try {
      console.log(`Triggering re-embedding for project ${projectId} after merge to ${targetBranch}`);

      // Queue the project for re-embedding with high priority
      const processingId = uuidv4();
      await queueService.addJob(projectId, repositoryUrl, processingId, 10); // High priority

      console.log(`Project ${projectId} queued for re-embedding after merge (processingId: ${processingId})`);

      return true;
    } catch (error) {
      console.error(`Error triggering re-embedding for project ${projectId}:`, error);
      return false;
    }
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

    // First, filter by file extension or special handling for files without extensions
    const extensionFilteredFiles = files.filter(file => {
      // Check if the file has an allowed extension or is a special file
      const isAllowed = this.isAllowedFileExtension(file.path);

      if (isAllowed) {
        return true;
      }

      // For files that didn't pass the extension check, try content-based detection
      // but only if the file has content
      if (file.content && file.content.length > 0) {
        // Extract the extension (if any)
        const extension = path.extname(file.path).toLowerCase().replace(/^\./, '');

        // If the file has no extension, check if it might contain code
        if (!extension && this.mightContainCode(file.content)) {
          console.log(`Processing file without extension that appears to contain code: ${file.path}`);
          return true;
        }
      }

      console.log(`Skipping file with unsupported extension: ${file.path}`);
      return false;
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
   * Check if a file might contain code based on its content
   * This is useful for files without extensions
   * @param content The content of the file
   * @returns True if the file might contain code, false otherwise
   */
  private mightContainCode(content: string): boolean {
    if (!content || content.length < 10) {
      return false;
    }

    // Check for common code patterns
    const codePatterns = [
      // Function definitions
      /function\s+\w+\s*\(/i,
      // Class definitions
      /class\s+\w+/i,
      // Import/require statements
      /import\s+|require\s*\(/i,
      // Variable declarations
      /const\s+|let\s+|var\s+/i,
      // Control structures
      /if\s*\(|for\s*\(|while\s*\(|switch\s*\(/i,
      // HTML tags
      /<[a-z]+[^>]*>/i,
      // CSS selectors
      /\.\w+\s*{|\#\w+\s*{/i,
      // SQL queries
      /SELECT\s+|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM/i,
      // Shell commands
      /^#!/,
      // JSON-like structures
      /{\s*"\w+"\s*:/i
    ];

    // Check if any code pattern matches
    for (const pattern of codePatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    // Check for a reasonable ratio of special characters that are common in code
    const codeChars = content.split('').filter(char =>
      ['(', ')', '{', '}', '[', ']', ';', '=', '+', '-', '*', '/', '<', '>', ':', '"', "'"].includes(char)
    ).length;

    const codeCharRatio = codeChars / content.length;
    if (codeCharRatio > 0.05) {
      return true;
    }

    return false;
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
    filesWithoutExtension: number;
    filesWithoutExtensionPaths: string[];
    specialFilesCount: number;
    specialFilesPaths: string[];
  } {
    const stats = {
      totalFiles: files.length,
      extensionCounts: {} as Record<string, number>,
      allowedExtensions: ALLOWED_FILE_EXTENSIONS,
      allowedFileCount: 0,
      skippedFileCount: 0,
      filesWithoutExtension: 0,
      filesWithoutExtensionPaths: [] as string[],
      specialFilesCount: 0,
      specialFilesPaths: [] as string[]
    };

    // Count files by extension
    for (const file of files) {
      const extension = path.extname(file.path).toLowerCase().replace(/^\./, '');
      const fileName = path.basename(file.path).toLowerCase();

      // Count by extension
      if (extension) {
        stats.extensionCounts[extension] = (stats.extensionCounts[extension] || 0) + 1;
      } else {
        stats.extensionCounts['no-extension'] = (stats.extensionCounts['no-extension'] || 0) + 1;
        stats.filesWithoutExtension++;
        stats.filesWithoutExtensionPaths.push(file.path);

        // Check if it's a special file
        if (SPECIAL_FILES_WITHOUT_EXTENSIONS.includes(fileName) ||
            (fileName.startsWith('.') && SPECIAL_FILES_WITHOUT_EXTENSIONS.includes(fileName))) {
          stats.specialFilesCount++;
          stats.specialFilesPaths.push(file.path);
        }
      }

      // Count allowed vs skipped
      if (this.isAllowedFileExtension(file.path)) {
        stats.allowedFileCount++;
      } else {
        // For files without extensions, check if they might contain code
        if (!extension && file.content && this.mightContainCode(file.content)) {
          // This will be counted as allowed in the next filter step
          console.log(`File without extension might contain code: ${file.path}`);
        } else {
          stats.skippedFileCount++;
        }
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

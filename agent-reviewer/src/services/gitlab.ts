import axios from 'axios';
import dotenv from 'dotenv';
import { CodeFile } from '../models/embedding.js';
import { MergeRequestChange, MergeRequestComment } from '../types/review.js';

dotenv.config();

const GITLAB_API_URL = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4';
const GITLAB_API_TOKEN = process.env.GITLAB_API_TOKEN;

if (!GITLAB_API_TOKEN) {
  console.error('GITLAB_API_TOKEN is not set');
  process.exit(1);
}

const gitlabApi = axios.create({
  baseURL: GITLAB_API_URL,
  headers: {
    'PRIVATE-TOKEN': GITLAB_API_TOKEN,
    'Content-Type': 'application/json',
  },
});

export class GitLabService {
  /**
   * Get repository tree (list of files) for a specific commit
   */
  async getRepositoryTree(projectId: number | string, ref: string, recursive: boolean = true): Promise<any[]> {
    try {
      const response = await gitlabApi.get(`/projects/${encodeURIComponent(projectId.toString())}/repository/tree`, {
        params: {
          ref,
          recursive,
          per_page: 100,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching repository tree:', error);
      throw error;
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(projectId: number | string, filePath: string, ref: string): Promise<string> {
    try {
      const response = await gitlabApi.get(`/projects/${encodeURIComponent(projectId.toString())}/repository/files/${encodeURIComponent(filePath)}/raw`, {
        params: { ref },
        responseType: 'text',
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching file content for ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Get all files from a repository at a specific commit
   */
  async getAllFiles(projectId: number | string, ref: string): Promise<CodeFile[]> {
    try {
      const tree = await this.getRepositoryTree(projectId, ref, true);
      const files: CodeFile[] = [];

      // Filter only files (not directories)
      const fileEntries = tree.filter(item => item.type === 'blob');

      // Process files in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < fileEntries.length; i += batchSize) {
        const batch = fileEntries.slice(i, i + batchSize);
        const batchPromises = batch.map(async (file) => {
          try {
            // Skip binary files to avoid database issues with null bytes
            if (this.isBinaryFile(file.path)) {
              console.log(`Skipping binary file: ${file.path}`);
              return {
                path: file.path,
                content: '[BINARY FILE CONTENT SKIPPED]',
                language: 'binary',
                lastModified: new Date(),
              };
            }

            const content = await this.getFileContent(projectId, file.path, ref);
            const language = this.detectLanguage(file.path);

            return {
              path: file.path,
              content,
              language,
              lastModified: new Date(),
            };
          } catch (error) {
            console.error(`Error processing file ${file.path}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        files.push(...batchResults.filter(Boolean) as CodeFile[]);
      }

      return files;
    } catch (error) {
      console.error('Error fetching all files:', error);
      throw error;
    }
  }

  /**
   * Get project details
   */
  async getProject(projectId: number | string): Promise<any> {
    try {
      const response = await gitlabApi.get(`/projects/${encodeURIComponent(projectId.toString())}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching project details:', error);
      throw error;
    }
  }

  /**
   * Get commit details
   */
  async getCommit(projectId: number | string, commitSha: string): Promise<any> {
    try {
      const response = await gitlabApi.get(`/projects/${encodeURIComponent(projectId.toString())}/repository/commits/${commitSha}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching commit details:', error);
      throw error;
    }
  }

  /**
   * Get merge request details
   */
  async getMergeRequest(projectId: number | string, mergeRequestIid: number): Promise<any> {
    try {
      const response = await gitlabApi.get(`/projects/${encodeURIComponent(projectId.toString())}/merge_requests/${mergeRequestIid}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching merge request details:', error);
      throw error;
    }
  }

  /**
   * Get merge request changes (diffs)
   */
  async getMergeRequestChanges(projectId: number | string, mergeRequestIid: number): Promise<MergeRequestChange[]> {
    try {
      console.log(`Fetching changes for merge request !${mergeRequestIid} in project ${projectId}`);

      // Get the list of changed files
      const response = await gitlabApi.get(`/projects/${encodeURIComponent(projectId.toString())}/merge_requests/${mergeRequestIid}/changes`);
      const changes = response.data.changes || [];

      const result: MergeRequestChange[] = [];

      for (const change of changes) {
        const oldPath = change.old_path;
        const newPath = change.new_path;
        const diffContent = change.diff;

        // Get the language based on the file extension
        const language = this.detectLanguage(newPath);

        // Check if this is a binary file
        const isBinary = this.isBinaryFile(newPath) || this.isBinaryFile(oldPath);

        if (isBinary) {
          console.log(`Skipping binary file content for ${newPath}`);
          result.push({
            oldPath,
            newPath,
            oldContent: '[BINARY FILE CONTENT SKIPPED]',
            newContent: '[BINARY FILE CONTENT SKIPPED]',
            diffContent,
            language: 'binary',
          });
          continue;
        }

        // Get the old and new content if available
        let oldContent = '';
        let newContent = '';

        if (change.deleted_file) {
          // File was deleted, try to get the old content
          try {
            oldContent = await this.getFileContent(projectId, oldPath, response.data.source_branch);
          } catch (error) {
            console.error(`Error fetching old content for deleted file ${oldPath}:`, error);
          }
        } else if (change.new_file) {
          // File was added, get the new content
          try {
            newContent = await this.getFileContent(projectId, newPath, response.data.source_branch);
          } catch (error) {
            console.error(`Error fetching new content for added file ${newPath}:`, error);
          }
        } else {
          // File was modified, get both old and new content
          try {
            // For old content, we need to get it from the target branch
            oldContent = await this.getFileContent(projectId, oldPath, response.data.target_branch);
            // For new content, we get it from the source branch
            newContent = await this.getFileContent(projectId, newPath, response.data.source_branch);
          } catch (error) {
            console.error(`Error fetching content for modified file ${newPath}:`, error);
          }
        }

        result.push({
          oldPath,
          newPath,
          oldContent,
          newContent,
          diffContent,
          language,
        });
      }

      return result;
    } catch (error) {
      console.error('Error fetching merge request changes:', error);
      throw error;
    }
  }

  /**
   * Get merge request comments (notes)
   */
  async getMergeRequestComments(projectId: number | string, mergeRequestIid: number): Promise<MergeRequestComment[]> {
    try {
      console.log(`Fetching comments for merge request !${mergeRequestIid} in project ${projectId}`);

      const response = await gitlabApi.get(`/projects/${encodeURIComponent(projectId.toString())}/merge_requests/${mergeRequestIid}/notes`, {
        params: {
          sort: 'asc',
          order_by: 'created_at',
          per_page: 100,
        },
      });

      return response.data.map((note: any) => ({
        id: note.id,
        body: note.body,
        author: {
          id: note.author.id,
          username: note.author.username,
        },
        createdAt: note.created_at,
      }));
    } catch (error) {
      console.error('Error fetching merge request comments:', error);
      throw error;
    }
  }

  /**
   * Add a comment to a merge request
   */
  async addMergeRequestComment(projectId: number | string, mergeRequestIid: number, body: string): Promise<any> {
    try {
      console.log(`Adding comment to merge request !${mergeRequestIid} in project ${projectId}`);

      const response = await gitlabApi.post(`/projects/${encodeURIComponent(projectId.toString())}/merge_requests/${mergeRequestIid}/notes`, {
        body,
      });

      return response.data;
    } catch (error) {
      console.error('Error adding comment to merge request:', error);
      throw error;
    }
  }

  /**
   * Approve a merge request
   */
  async approveMergeRequest(projectId: number | string, mergeRequestIid: number): Promise<any> {
    try {
      console.log(`Approving merge request !${mergeRequestIid} in project ${projectId}`);

      const response = await gitlabApi.post(`/projects/${encodeURIComponent(projectId.toString())}/merge_requests/${mergeRequestIid}/approve`);

      return response.data;
    } catch (error) {
      console.error('Error approving merge request:', error);
      throw error;
    }
  }

  /**
   * Simple language detection based on file extension
   */
  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';

    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'java': 'java',
      'go': 'go',
      'php': 'php',
      'cs': 'csharp',
      'cpp': 'cpp',
      'c': 'c',
      'h': 'c',
      'hpp': 'cpp',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'sh': 'shell',
      'bash': 'shell',
      'sql': 'sql',
      'swift': 'swift',
      'kt': 'kotlin',
      'rs': 'rust',
    };

    return languageMap[extension] || 'text';
  }

  /**
   * Check if a file is likely binary based on its extension
   */
  private isBinaryFile(filePath: string): boolean {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';

    // List of common binary file extensions
    const binaryExtensions = [
      'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'tiff', 'svg',
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
      'zip', 'tar', 'gz', 'rar', '7z',
      'exe', 'dll', 'so', 'dylib',
      'ttf', 'otf', 'woff', 'woff2',
      'mp3', 'mp4', 'avi', 'mov', 'wmv', 'flv',
      'bin', 'dat'
    ];

    return binaryExtensions.includes(extension);
  }
}

export const gitlabService = new GitLabService();

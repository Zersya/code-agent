import axios from 'axios';
import dotenv from 'dotenv';
import { CodeFile } from '../models/embedding.js';

dotenv.config();

const GITHUB_API_URL = process.env.GITHUB_API_URL || 'https://api.github.com';
const GITHUB_API_TOKEN = process.env.GITHUB_API_TOKEN;

if (!GITHUB_API_TOKEN) {
  console.warn('GITHUB_API_TOKEN is not set. GitHub functionality will be limited.');
}

const githubApi = axios.create({
  baseURL: GITHUB_API_URL,
  headers: {
    'Authorization': `Bearer ${GITHUB_API_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  },
});

export class GitHubService {
  /**
   * Get repository tree (list of files) for a specific commit
   */
  async getRepositoryTree(owner: string, repo: string, ref: string, recursive: boolean = true): Promise<any[]> {
    try {
      const response = await githubApi.get(`/repos/${owner}/${repo}/git/trees/${ref}`, {
        params: {
          recursive: recursive ? 1 : 0,
        },
      });

      return response.data.tree || [];
    } catch (error) {
      console.error('Error fetching repository tree:', error);
      throw error;
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(owner: string, repo: string, path: string, ref: string): Promise<string> {
    try {
      const response = await githubApi.get(`/repos/${owner}/${repo}/contents/${path}`, {
        params: { ref },
      });

      if (response.data.type === 'file' && response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }

      throw new Error(`File ${path} not found or is not a file`);
    } catch (error) {
      console.error(`Error fetching file content for ${path}:`, error);
      throw error;
    }
  }

  /**
   * Get all files from a repository at a specific commit
   */
  async getAllFiles(owner: string, repo: string, ref: string): Promise<CodeFile[]> {
    try {
      const tree = await this.getRepositoryTree(owner, repo, ref, true);
      const files: CodeFile[] = [];

      // Filter for files only (not directories)
      const fileEntries = tree.filter(entry => entry.type === 'blob');

      for (const entry of fileEntries) {
        try {
          // Skip binary files and files that are too large
          if (entry.size > 1024 * 1024) { // Skip files larger than 1MB
            console.log(`Skipping large file: ${entry.path} (${entry.size} bytes)`);
            continue;
          }

          const content = await this.getFileContent(owner, repo, entry.path, ref);
          const language = this.detectLanguage(entry.path);

          files.push({
            path: entry.path,
            content,
            language,
            size: entry.size || content.length,
            lastModified: new Date(),
          });
        } catch (error) {
          console.error(`Error processing file ${entry.path}:`, error);
          // Continue with other files
        }
      }

      return files;
    } catch (error) {
      console.error('Error fetching all files:', error);
      throw error;
    }
  }

  /**
   * Get repository details
   */
  async getRepository(owner: string, repo: string): Promise<any> {
    try {
      const response = await githubApi.get(`/repos/${owner}/${repo}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching repository details:', error);
      throw error;
    }
  }

  /**
   * Get pull request details
   */
  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<any> {
    try {
      const response = await githubApi.get(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching pull request details:', error);
      throw error;
    }
  }

  /**
   * Get pull request files (changed files)
   */
  async getPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<any[]> {
    try {
      const response = await githubApi.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
      return response.data;
    } catch (error) {
      console.error('Error fetching pull request files:', error);
      throw error;
    }
  }

  /**
   * Create a comment on a pull request
   */
  async createPullRequestComment(owner: string, repo: string, pullNumber: number, body: string): Promise<any> {
    try {
      const response = await githubApi.post(`/repos/${owner}/${repo}/issues/${pullNumber}/comments`, {
        body,
      });
      return response.data;
    } catch (error) {
      console.error('Error creating pull request comment:', error);
      throw error;
    }
  }

  /**
   * Create a comment on a specific line in a pull request
   */
  async createPullRequestReviewComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
    commitSha: string,
    path: string,
    line: number
  ): Promise<any> {
    try {
      const response = await githubApi.post(`/repos/${owner}/${repo}/pulls/${pullNumber}/comments`, {
        body,
        commit_id: commitSha,
        path,
        line,
      });
      return response.data;
    } catch (error) {
      console.error('Error creating pull request review comment:', error);
      throw error;
    }
  }

  /**
   * Get commit details
   */
  async getCommit(owner: string, repo: string, commitSha: string): Promise<any> {
    try {
      const response = await githubApi.get(`/repos/${owner}/${repo}/commits/${commitSha}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching commit details:', error);
      throw error;
    }
  }

  /**
   * Detect programming language from file path
   */
  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'zsh',
      'ps1': 'powershell',
      'bat': 'batch',
      'cmd': 'batch',
    };

    return languageMap[extension || ''] || 'text';
  }

  /**
   * Parse GitHub repository URL to extract owner and repo
   */
  static parseRepositoryUrl(url: string): { owner: string; repo: string } | null {
    const match = url.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
      };
    }
    return null;
  }

  /**
   * Generate a project ID from GitHub repository
   */
  static generateProjectId(owner: string, repo: string): string {
    return `github_${owner}_${repo}`.toLowerCase();
  }
}

export const githubService = new GitHubService();

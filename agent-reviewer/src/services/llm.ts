import axios from 'axios';
import dotenv from 'dotenv';
import { CodeEmbedding } from '../models/embedding.js';

dotenv.config();

// Environment variables
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_API_MODEL = process.env.OPENROUTER_API_MODEL || 'qwen/qwen3-235b-a22b:free';
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openrouter';

// Check for required environment variables
if (LLM_PROVIDER === 'openrouter' && !OPENROUTER_API_KEY) {
  console.warn('OPENROUTER_API_KEY is not set. OpenRouter LLM analysis will not be available.');
}

/**
 * Interface for LLM providers
 */
interface LlmProvider {
  /**
   * Analyze code snippets using an LLM
   */
  analyzeCode(query: string, codeSnippets: CodeEmbedding[], model?: string): Promise<string>;
}

/**
 * OpenRouter implementation of LlmProvider
 */
class OpenRouterProvider implements LlmProvider {
  private api;

  constructor() {
    this.api = axios.create({
      baseURL: OPENROUTER_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000', // Required by OpenRouter
      },
    });
  }

  /**
   * Analyze code snippets using OpenRouter
   */
  async analyzeCode(query: string, codeSnippets: CodeEmbedding[], model: string = OPENROUTER_API_MODEL): Promise<string> {
    try {
      if (!OPENROUTER_API_KEY) {
        return 'OpenRouter LLM analysis is not available. OPENROUTER_API_KEY is not set.';
      }

      // Format code snippets for the prompt
      const formattedSnippets = this.formatCodeSnippets(codeSnippets);

      // Create the prompt
      const prompt = this.createPrompt(query, formattedSnippets);

      // Call the OpenRouter API
      const response = await this.api.post('/chat/completions', {
        model,
        messages: [
          { role: 'system', content: 'You are a helpful code analysis assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error analyzing code with OpenRouter:', error);
      return `Error analyzing code with OpenRouter: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Format code snippets for the prompt
   */
  private formatCodeSnippets(codeSnippets: CodeEmbedding[]): string {
    return codeSnippets.map((snippet, index) => {
      return `
Code Snippet ${index + 1} (${snippet.filePath}, Language: ${snippet.language}):
\`\`\`${snippet.language}
${snippet.content.slice(0, 2000)}${snippet.content.length > 2000 ? '...' : ''}
\`\`\`
`;
    }).join('\n');
  }

  /**
   * Create the prompt for the LLM
   */
  private createPrompt(query: string, formattedSnippets: string): string {
    return `
You are a code analysis assistant. I'm searching for code related to the following query:

Query: ${query}

I've found the following code snippets that might be relevant:

${formattedSnippets}

Please analyze these code snippets and provide a comprehensive review that:
1. Explains how the code relates to my query
2. Summarizes the key functionality and purpose of each snippet
3. Highlights any important patterns, algorithms, or techniques used
4. Identifies any potential issues, bugs, or areas for improvement
5. Suggests how I might use or adapt this code for my needs

Focus on being thorough but concise, and prioritize the most relevant aspects of the code to my query.
`;
  }
}

/**
 * Ollama implementation of LlmProvider
 */
class OllamaProvider implements LlmProvider {
  private api;

  constructor() {
    this.api = axios.create({
      baseURL: OLLAMA_API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Analyze code snippets using Ollama
   */
  async analyzeCode(query: string, codeSnippets: CodeEmbedding[], model: string = OLLAMA_MODEL): Promise<string> {
    try {
      // Format code snippets for the prompt
      const formattedSnippets = this.formatCodeSnippets(codeSnippets);

      // Create the prompt
      const prompt = this.createPrompt(query, formattedSnippets);

      // Call the Ollama API
      const response = await this.api.post('/chat', {
        model,
        messages: [
          { role: 'system', content: 'You are a helpful code analysis assistant.' },
          { role: 'user', content: prompt }
        ],
        options: {
          temperature: 0.1,
        },
        stream: false,
      });

      // Ollama response format is different from OpenRouter
      return response.data.message.content;
    } catch (error) {
      console.error('Error analyzing code with Ollama:', error);
      return `Error analyzing code with Ollama: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Format code snippets for the prompt
   */
  private formatCodeSnippets(codeSnippets: CodeEmbedding[]): string {
    return codeSnippets.map((snippet, index) => {
      return `
Code Snippet ${index + 1} (${snippet.filePath}, Language: ${snippet.language}):
\`\`\`${snippet.language}
${snippet.content.slice(0, 2000)}${snippet.content.length > 2000 ? '...' : ''}
\`\`\`
`;
    }).join('\n');
  }

  /**
   * Create the prompt for the LLM
   */
  private createPrompt(query: string, formattedSnippets: string): string {
    return `
You are a code analysis assistant. I'm searching for code related to the following query:

Query: ${query}

I've found the following code snippets that might be relevant:

${formattedSnippets}

Please analyze these code snippets and provide a comprehensive review that:
1. Explains how the code relates to my query
2. Summarizes the key functionality and purpose of each snippet
3. Highlights any important patterns, algorithms, or techniques used
4. Identifies any potential issues, bugs, or areas for improvement
5. Suggests how I might use or adapt this code for my needs

Focus on being thorough but concise, and prioritize the most relevant aspects of the code to my query.
`;
  }
}

/**
 * Factory for creating LLM providers
 */
class LlmProviderFactory {
  /**
   * Get the appropriate LLM provider based on configuration
   */
  static getProvider(): LlmProvider {
    switch (LLM_PROVIDER.toLowerCase()) {
      case 'ollama':
        console.log('Using Ollama LLM provider');
        return new OllamaProvider();
      case 'openrouter':
      default:
        console.log('Using OpenRouter LLM provider');
        return new OpenRouterProvider();
    }
  }
}

/**
 * Main LLM service that uses the appropriate provider
 */
export class LlmService {
  private provider: LlmProvider;

  constructor() {
    this.provider = LlmProviderFactory.getProvider();
  }

  /**
   * Analyze code snippets using the configured LLM provider
   */
  async analyzeCode(query: string, codeSnippets: CodeEmbedding[], model?: string): Promise<string> {
    return this.provider.analyzeCode(query, codeSnippets, model);
  }
}

export const llmService = new LlmService();

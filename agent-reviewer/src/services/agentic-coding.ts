import { AgenticCodingRequest, AgenticCodingResult } from '../types/webhook.js';
import { llmService } from './llm.js';
import { dbService } from './database.js';
import { CodeEmbedding } from '../models/embedding.js';
import dotenv from 'dotenv';

dotenv.config();

const ENABLE_AGENTIC_CODING = process.env.ENABLE_AGENTIC_CODING === 'true';

export class AgenticCodingService {
  /**
   * Process an agentic coding request
   */
  async processAgenticCodingRequest(request: AgenticCodingRequest): Promise<AgenticCodingResult> {
    try {
      console.log(`Processing agentic coding request for ${request.platform} project ${request.projectId}`);
      console.log(`Instructions: ${request.instructions}`);

      // Step 1: Gather context about the codebase
      const context = await this.gatherCodebaseContext(request);

      // Step 2: Generate code changes using LLM
      const codeChanges = await this.generateCodeChanges(request, context);

      // Step 3: Apply code changes (simulation for now)
      const result = await this.applyCodeChanges(request, codeChanges);

      // Step 4: Validate changes
      const validationResult = await this.validateChanges(request, result);

      return {
        success: result.success || false,
        filesModified: result.filesModified || [],
        filesCreated: result.filesCreated || [],
        summary: result.summary || 'No summary available',
        errors: result.errors,
        warnings: validationResult.warnings || result.warnings,
      };
    } catch (error) {
      console.error('Error processing agentic coding request:', error);
      return {
        success: false,
        filesModified: [],
        filesCreated: [],
        summary: `Error processing request: ${error instanceof Error ? error.message : String(error)}`,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Gather codebase context for the request
   */
  private async gatherCodebaseContext(request: AgenticCodingRequest): Promise<CodeEmbedding[]> {
    try {
      // Convert projectId to number for database operations
      const projectId = this.convertProjectIdToNumber(request.projectId);
      const embeddings = await dbService.getEmbeddingsByProject(projectId);

      if (embeddings.length === 0) {
        console.log(`No embeddings found for project ${projectId}, attempting to generate them`);

        // Try to generate embeddings if they don't exist
        await this.ensureProjectEmbeddings(request);

        // Try again
        const newEmbeddings = await dbService.getEmbeddingsByProject(projectId);
        return newEmbeddings.slice(0, 20); // Limit context size
      }

      // Use semantic search to find relevant files based on the instructions
      const instructionEmbedding = await this.generateInstructionEmbedding(request.instructions);
      const relevantFiles = await dbService.searchSimilarCode(projectId, instructionEmbedding, 15);

      return relevantFiles;
    } catch (error) {
      console.error('Error gathering codebase context:', error);
      return [];
    }
  }

  /**
   * Convert projectId to number for database operations
   */
  private convertProjectIdToNumber(projectId: number | string): number {
    if (typeof projectId === 'number') {
      return projectId;
    }

    // For GitHub projects, extract a numeric hash from the string ID
    if (typeof projectId === 'string') {
      // Simple hash function to convert string to number
      let hash = 0;
      for (let i = 0; i < projectId.length; i++) {
        const char = projectId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash);
    }

    return 0; // Fallback
  }

  /**
   * Generate embedding for the instructions to find relevant code
   */
  private async generateInstructionEmbedding(instructions: string): Promise<number[]> {
    try {
      // Use the existing embedding service to generate embedding for instructions
      const { embeddingService } = await import('./embedding.js');
      return await embeddingService.generateEmbedding(instructions);
    } catch (error) {
      console.error('Error generating instruction embedding:', error);
      return [];
    }
  }

  /**
   * Ensure project has embeddings
   */
  private async ensureProjectEmbeddings(request: AgenticCodingRequest): Promise<void> {
    try {
      const { embeddingService } = await import('./embedding.js');
      const projectId = this.convertProjectIdToNumber(request.projectId);

      // Check if embeddings exist
      const hasEmbeddings = await dbService.hasEmbeddings(projectId);
      if (!hasEmbeddings) {
        console.log(`Triggering embedding generation for project ${projectId}`);
        await embeddingService.checkAndEmbedProject(projectId, false);
      }
    } catch (error) {
      console.error('Error ensuring project embeddings:', error);
    }
  }

  /**
   * Generate code changes using LLM
   */
  private async generateCodeChanges(request: AgenticCodingRequest, context: CodeEmbedding[]): Promise<any> {
    try {
      // Create a comprehensive prompt for the LLM
      const prompt = this.createCodingPrompt(request, context);

      // Use the LLM service to generate code changes
      const response = await llmService.analyzeCode(prompt, context);

      // Parse the LLM response to extract code changes
      return this.parseLLMResponse(response);
    } catch (error) {
      console.error('Error generating code changes:', error);
      throw error;
    }
  }

  /**
   * Create a comprehensive prompt for the LLM
   */
  private createCodingPrompt(request: AgenticCodingRequest, context: CodeEmbedding[]): string {
    const contextSummary = context.map(file =>
      `File: ${file.filePath}\nLanguage: ${file.language}\nContent:\n${file.content.substring(0, 1000)}...\n`
    ).join('\n---\n');

    return `You are an expert software engineer tasked with implementing code changes based on developer instructions.

INSTRUCTIONS FROM DEVELOPER:
${request.instructions}

PROJECT CONTEXT:
Platform: ${request.platform}
Repository: ${request.repositoryUrl}
${request.context.pullRequestNumber ? `Pull Request: #${request.context.pullRequestNumber}` : ''}
${request.context.mergeRequestIid ? `Merge Request: !${request.context.mergeRequestIid}` : ''}
Branch: ${request.context.branch || 'main'}

RELEVANT CODEBASE FILES:
${contextSummary}

TASK:
Based on the developer's instructions and the provided codebase context, generate the necessary code changes.

RESPONSE FORMAT:
Please respond with a JSON object containing:
{
  "changes": [
    {
      "action": "modify" | "create" | "delete",
      "filePath": "path/to/file",
      "content": "full file content after changes",
      "summary": "brief description of changes made"
    }
  ],
  "summary": "overall summary of all changes made",
  "reasoning": "explanation of why these changes were made"
}

IMPORTANT GUIDELINES:
1. Follow the existing code style and patterns in the project
2. Ensure changes don't break existing functionality
3. Use existing components and utilities where possible
4. Make minimal, focused changes that address the specific request
5. Include proper error handling and validation
6. Add comments where necessary for clarity
7. Ensure all imports and dependencies are correct

Generate the code changes now:`;
  }

  /**
   * Parse LLM response to extract code changes
   */
  private parseLLMResponse(response: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: create a simple structure
      return {
        changes: [],
        summary: response.substring(0, 500),
        reasoning: 'Could not parse structured response from LLM',
      };
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      return {
        changes: [],
        summary: response.substring(0, 500),
        reasoning: 'Error parsing LLM response',
      };
    }
  }

  /**
   * Apply code changes (simulation for now)
   */
  private async applyCodeChanges(_request: AgenticCodingRequest, codeChanges: any): Promise<Partial<AgenticCodingResult>> {
    const filesModified: string[] = [];
    const filesCreated: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!codeChanges.changes || !Array.isArray(codeChanges.changes)) {
        warnings.push('No valid changes found in LLM response');
        return {
          filesModified,
          filesCreated,
          summary: codeChanges.summary || 'No changes applied',
          errors,
          warnings,
        };
      }

      // For now, we'll simulate the changes rather than actually applying them
      // In a production environment, you would:
      // 1. Clone the repository
      // 2. Create a new branch
      // 3. Apply the changes
      // 4. Commit and push
      // 5. Create a pull request

      for (const change of codeChanges.changes) {
        try {
          switch (change.action) {
            case 'modify':
              filesModified.push(change.filePath);
              console.log(`Would modify file: ${change.filePath}`);
              break;
            case 'create':
              filesCreated.push(change.filePath);
              console.log(`Would create file: ${change.filePath}`);
              break;
            case 'delete':
              console.log(`Would delete file: ${change.filePath}`);
              break;
            default:
              warnings.push(`Unknown action: ${change.action} for file ${change.filePath}`);
          }
        } catch (error) {
          errors.push(`Error processing change for ${change.filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return {
        filesModified,
        filesCreated,
        summary: codeChanges.summary || `Applied ${codeChanges.changes.length} changes`,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      errors.push(`Error applying code changes: ${error instanceof Error ? error.message : String(error)}`);
      return {
        filesModified,
        filesCreated,
        summary: 'Failed to apply changes',
        errors,
        warnings,
      };
    }
  }

  /**
   * Validate the applied changes
   */
  private async validateChanges(_request: AgenticCodingRequest, result: Partial<AgenticCodingResult>): Promise<Partial<AgenticCodingResult>> {
    const warnings = result.warnings || [];

    // Add validation warnings
    if (result.filesModified && result.filesModified.length > 10) {
      warnings.push('Large number of files modified - please review carefully');
    }

    if (result.filesCreated && result.filesCreated.length > 5) {
      warnings.push('Large number of files created - please review carefully');
    }

    return {
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Check if a comment contains agentic coding instructions
   */
  static isAgenticCodingComment(commentBody: string): boolean {
    return commentBody.trim().toLowerCase().startsWith('/agent');
  }

  /**
   * Extract instructions from an agentic coding comment
   */
  static extractInstructions(commentBody: string): string {
    const trimmed = commentBody.trim();
    if (trimmed.toLowerCase().startsWith('/agent')) {
      return trimmed.substring(6).trim(); // Remove '/agent' prefix
    }
    return trimmed;
  }
}

export const agenticCodingService = new AgenticCodingService();

import { MergeRequestChange, MergeRequestComment, /* MergeRequestReview, */ MergeRequestReviewResult, SequentialThought } from '../types/review.js';
import { gitlabService } from './gitlab.js';
import { contextService, ProjectContext } from './context.js';

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Environment variables
const GITLAB_USERNAME = process.env.GITLAB_USERNAME || '';
const ENABLE_MR_REVIEW = process.env.ENABLE_MR_REVIEW === 'true';
const ENABLE_PROJECT_CONTEXT = process.env.ENABLE_PROJECT_CONTEXT === 'true';
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openrouter';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_API_MODEL = process.env.OPENROUTER_API_MODEL || 'qwen/qwen3-235b-a22b:free';
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

/**
 * Service for reviewing merge requests
 */
export class ReviewService {
  private api: any;
  private model: string;

  constructor() {
    if (LLM_PROVIDER === 'openrouter') {
      if (!OPENROUTER_API_KEY) {
        console.warn('OPENROUTER_API_KEY is not set. Code review will not be available.');
      }

      this.api = axios.create({
        baseURL: OPENROUTER_API_URL,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'GitLab Merge Request Reviewer',
        },
      });
      this.model = OPENROUTER_API_MODEL;
    } else if (LLM_PROVIDER === 'ollama') {
      this.api = axios.create({
        baseURL: OLLAMA_API_URL,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      this.model = OLLAMA_MODEL;
    } else {
      throw new Error(`Unsupported LLM provider: ${LLM_PROVIDER}`);
    }
  }

  /**
   * Call the LLM API to review code
   * @param codeChanges The code changes to review
   * @param mergeRequestTitle The title of the merge request
   * @param mergeRequestDescription The description of the merge request
   * @param projectContext Optional project context to enhance the review
   * @returns The review result
   */
  private async reviewCodeWithLLM(
    codeChanges: string,
    mergeRequestTitle: string,
    mergeRequestDescription: string,
    projectContext?: ProjectContext
  ): Promise<{ thoughts: SequentialThought[], reviewResult: string }> {
    try {
      // Generate the system prompt
      const systemPrompt = this.generateSystemPrompt();

      // Generate the user prompt with code changes and project context
      const userPrompt = this.generateUserPrompt(
        codeChanges,
        mergeRequestTitle,
        mergeRequestDescription,
        projectContext
      );

      // Initialize the conversation
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      // Call the LLM API
      const response = await this.callLlmApi(messages);

      // Extract the review result
      const reviewResult = this.extractReviewResult(response);

      // Create a single thought for compatibility with previous implementation
      const thought: SequentialThought = {
        thought: response,
        thoughtNumber: 1,
        totalThoughts: 1,
        nextThoughtNeeded: false,
      };

      return {
        thoughts: [thought],
        reviewResult
      };
    } catch (error) {
      console.error('Error in code review process:', error);
      throw error;
    }
  }

  /**
   * Generate the system prompt for the LLM
   */
  private generateSystemPrompt(): string {
    return `Kamu adalah senior software engineer yang bertanggung jawab untuk review kode.

Untuk review kode:
1. Analisis kode dengan cermat dan teliti
2. Fokus pada kualitas kode, alur logika, kejelasan, dan potensi bug
3. Berikan wawasan yang mendalam
4. Gunakan Bahasa Indonesia yang formal dan profesional
5. Jika konteks proyek disediakan, gunakan untuk memahami kode lebih baik

Jika konteks proyek disediakan, gunakan untuk:
- Memahami struktur dan arsitektur proyek
- Mengidentifikasi pola dan konvensi yang digunakan dalam proyek
- Mengevaluasi apakah perubahan konsisten dengan kode yang ada
- Mendeteksi potensi konflik atau masalah integrasi

Berikan hasil review dalam format berikut:

---
## Review

[Ringkasan singkat tentang kode yang direview]

### Analisis Kode
- [Poin analisis 1]
- [Poin analisis 2]
...

### Feedback
- [Feedback 1]
- [Feedback 2]
...

[Jika kode memenuhi standar kualitas, tambahkan: "Silahkan merge! \nTerima kasih"]
---

Ingat untuk selalu memberikan feedback yang konstruktif dan dapat ditindaklanjuti.`;
  }

  /**
   * Generate the user prompt with code changes and project context
   */
  private generateUserPrompt(
    codeChanges: string,
    mergeRequestTitle: string,
    mergeRequestDescription: string,
    projectContext?: ProjectContext
  ): string {
    let prompt = `Tolong review perubahan kode berikut dari merge request dengan judul "${mergeRequestTitle}" dan deskripsi "${mergeRequestDescription}".`;

    // Add project context if available
    if (projectContext && projectContext.relevantFiles.length > 0) {
      prompt += `\n\nBerikut adalah konteks proyek yang relevan untuk membantu review kode:
${projectContext.contextSummary}`;
    }

    prompt += `\n\nPerubahan kode yang perlu direview:

\`\`\`diff
${codeChanges}
\`\`\``;

    // If we have project context, add a reminder to use it
    if (projectContext && projectContext.relevantFiles.length > 0) {
      prompt += `\n\nGunakan konteks proyek yang diberikan untuk memahami kode lebih baik dan memberikan review yang lebih relevan dan mendalam.`;
    }

    return prompt;
  }

  /**
   * Call the LLM API based on the configured provider
   */
  private async callLlmApi(messages: any[]): Promise<string> {
    try {
      if (LLM_PROVIDER === 'openrouter') {
        const response = await this.api.post('/chat/completions', {
          model: this.model,
          messages,
          temperature: 0.1,
          max_tokens: 2000,
        });

        return response.data.choices[0].message.content;
      } else if (LLM_PROVIDER === 'ollama') {
        const response = await this.api.post('/chat', {
          model: this.model,
          messages,
          options: {
            temperature: 0.1,
          },
          stream: false,
        });

        return response.data.message.content;
      } else {
        throw new Error(`Unsupported LLM provider: ${LLM_PROVIDER}`);
      }
    } catch (error) {
      console.error(`Error calling ${LLM_PROVIDER} API:`, error);
      throw error;
    }
  }

  /**
   * Extract the review result from the response
   */
  private extractReviewResult(response: string): string {
    // Try to extract the review section from the response
    const reviewMatch = response.match(/## Review[\s\S]*$/);

    if (reviewMatch) {
      return reviewMatch[0];
    }

    // If no review section is found, return the entire response
    return response;
  }

  /**
   * Review a merge request
   * @param projectId The ID of the project
   * @param mergeRequestIid The IID of the merge request
   * @returns The review result
   */
  async reviewMergeRequest(projectId: number, mergeRequestIid: number): Promise<MergeRequestReviewResult> {
    try {
      console.log(`Starting review for merge request !${mergeRequestIid} in project ${projectId}`);

      // Get merge request details
      const mergeRequest = await gitlabService.getMergeRequest(projectId, mergeRequestIid);

      // Get merge request changes
      const changes = await gitlabService.getMergeRequestChanges(projectId, mergeRequestIid);

      // Get existing comments
      const comments = await gitlabService.getMergeRequestComments(projectId, mergeRequestIid);

      // Check if this merge request has already been reviewed by us
      if (this.hasBeenReviewed(comments)) {
        console.log(`Merge request !${mergeRequestIid} has already been reviewed, skipping`);
        return {
          reviewText: 'Merge request has already been reviewed.',
          shouldApprove: false,
        };
      }


      // Format the changes for review
      const formattedChanges = this.formatChangesForReview(changes);

      console.log('Formatted changes for review:', formattedChanges);

      // Get project context if enabled
      let projectContext = undefined;
      if (ENABLE_PROJECT_CONTEXT) {
        try {
          console.log(`Getting project context for project ${projectId}`);
          projectContext = await contextService.getProjectContext(projectId, changes);
          console.log(`Retrieved project context with ${projectContext.relevantFiles.length} relevant files`);
        } catch (contextError) {
          console.warn(`Error getting project context, continuing without it:`, contextError);
        }
      }

      // Perform the review using direct LLM call
      const { /* thoughts, */ reviewResult } = await this.reviewCodeWithLLM(
        formattedChanges,
        mergeRequest.title,
        mergeRequest.description || '',
        projectContext
      );

      console.log('Review result:', reviewResult);

      // Determine if the merge request should be approved
      const shouldApprove = this.shouldApproveMergeRequest(reviewResult);

      // Format the review comment
      const reviewComment = this.formatReviewComment(reviewResult, shouldApprove);

      // Create the review object for future reference
      // Currently not used but prepared for future implementation of review history
      /*
      const review: MergeRequestReview = {
        projectId,
        mergeRequestIid,
        title: mergeRequest.title,
        description: mergeRequest.description || '',
        author: mergeRequest.author.username,
        url: mergeRequest.web_url,
        sourceBranch: mergeRequest.source_branch,
        targetBranch: mergeRequest.target_branch,
        commitId: mergeRequest.sha,
        changes,
        existingComments: comments,
        thoughts,
        reviewResult,
        shouldApprove,
      };
      */

      // Save the review for future reference if needed
      // This could be implemented later if we need to store review history

      return {
        reviewText: reviewComment,
        shouldApprove,
      };
    } catch (error) {
      console.error(`Error reviewing merge request !${mergeRequestIid} in project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a merge request has already been reviewed by us
   */
  private hasBeenReviewed(comments: MergeRequestComment[]): boolean {
    // Check if there are any comments from the GitLab user we're using
    return comments.some(comment =>
      comment.author.username === GITLAB_USERNAME &&
      comment.body.includes('Halo, berikut review untuk MR ini:')
    );
  }

  /**
   * Format the changes for review
   */
  private formatChangesForReview(changes: MergeRequestChange[]): string {
    // Combine all diffs into a single string
    return changes.map(change => {
      const header = `File: ${change.newPath} (${change.language})`;
      return `${header}\n${change.diffContent}`;
    }).join('\n\n');
  }

  /**
   * Determine if a merge request should be approved based on the review result
   */
  private shouldApproveMergeRequest(reviewResult: string): boolean {
    // Check if the review contains approval language
    const approvalIndicators = [
      'Silahkan merge',
      'Silakan merge',
      'dapat di-merge',
      'dapat dimerge',
      'bisa di-merge',
      'bisa dimerge',
      'siap untuk di-merge',
      'siap untuk dimerge',
      'layak untuk di-merge',
      'layak untuk dimerge',
      'memenuhi standar kualitas',
    ];

    return approvalIndicators.some(indicator => reviewResult.includes(indicator));
  }

  /**
   * Format the review comment
   */
  private formatReviewComment(reviewResult: string, shouldApprove: boolean): string {
    // Start with the standard greeting
    let comment = 'Halo, berikut review untuk MR ini:\n\n';

    // Add the review result
    comment += reviewResult;

    // If the MR should be approved, make sure the approval message is included
    if (shouldApprove && !comment.includes('Silahkan merge!')) {
      comment += '\n\nSilahkan merge! \nTerima kasih';
    }

    return comment;
  }

  /**
   * Submit a review for a merge request
   */
  async submitReview(projectId: number, mergeRequestIid: number): Promise<void> {
    try {
      // Check if merge request reviews are enabled
      if (!ENABLE_MR_REVIEW) {
        console.log(`Merge request reviews are disabled. Skipping review for !${mergeRequestIid} in project ${projectId}`);
        return;
      }

      // Perform the review
      const reviewResult = await this.reviewMergeRequest(projectId, mergeRequestIid);

      // Add the review comment
      await gitlabService.addMergeRequestComment(projectId, mergeRequestIid, reviewResult.reviewText);

      // If the review indicates approval, approve the merge request
      if (reviewResult.shouldApprove) {
        await gitlabService.approveMergeRequest(projectId, mergeRequestIid);
        console.log(`Approved merge request !${mergeRequestIid} in project ${projectId}`);
      } else {
        console.log(`Did not approve merge request !${mergeRequestIid} in project ${projectId}`);
      }
    } catch (error) {
      console.error(`Error submitting review for merge request !${mergeRequestIid} in project ${projectId}:`, error);
      throw error;
    }
  }
}

export const reviewService = new ReviewService();

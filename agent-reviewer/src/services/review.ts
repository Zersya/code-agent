import { MergeRequestChange, MergeRequestComment, /* MergeRequestReview, */ MergeRequestReviewResult, SequentialThought } from '../types/review.js';
import { gitlabService } from './gitlab.js';
import { contextService, ProjectContext } from './context.js';
import { dbService } from './database.js';
import { notionService } from './notion.js';
import { CombinedNotionContext } from '../types/notion.js';

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
   * @param notionContext Optional Notion task context to enhance the review
   * @returns The review result
   */
  private async reviewCodeWithLLM(
    codeChanges: string,
    mergeRequestTitle: string,
    mergeRequestDescription: string,
    projectContext?: ProjectContext,
    notionContext?: CombinedNotionContext
  ): Promise<{ thoughts: SequentialThought[], reviewResult: string }> {
    try {
      // Generate the system prompt
      const systemPrompt = this.generateSystemPrompt();

      // Generate the user prompt with code changes, project context, and Notion context
      const userPrompt = this.generateUserPrompt(
        codeChanges,
        mergeRequestTitle,
        mergeRequestDescription,
        projectContext,
        notionContext
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
    return `Anda adalah seorang Insinyur Perangkat Lunak Senior dengan keahlian mendalam dalam pengembangan antarmuka pengguna (frontend), khususnya dengan Nuxt.js dan Flutter. Peran Anda dalam code review ini adalah sebagai seorang Arsitek Teknis yang memastikan kualitas, skalabilitas, maintenabilitas, dan performa kode. Anda memiliki kemampuan analisis yang tajam, memperhatikan detail, dan mampu memberikan panduan teknis yang konstruktif.

**Konteks Teknologi Spesifik (PENTING):**
* **Nuxt.js:** Pahami bahwa pengembangan Nuxt.js dalam proyek ini **wajib mengikuti dokumentasi resmi Nuxt.js**. Penyimpangan dari praktik standar Nuxt harus memiliki justifikasi yang kuat. Perhatikan penggunaan fitur-fitur Nuxt (seperti routing, state management, middleware, plugins, module, struktur direktori, konvensi, dll.) dan pastikan penggunaannya sesuai dengan best practice Nuxt.
* **Flutter:** Untuk kode Flutter, fokus pada arsitektur state management yang digunakan (BLoC), efisiensi widget tree, platform-specific considerations, dan adherence terhadap panduan gaya Dart dan Flutter.
* **Struktur Proyek Saat Ini:** **Sangat penting** untuk selalu merujuk dan **mengikuti struktur proyek yang sudah ada (existing project structure)**. Perubahan kode harus konsisten dengan pola, arsitektur, dan konvensi yang telah ditetapkan dalam proyek ini. Jika ada konteks proyek yang disediakan, gunakan itu untuk memahami bagaimana developer menulis kode dan bagaimana struktur direktori serta komponen diorganisir.

**KRITERIA TINGKAT KEPARAHAN ISSUE (WAJIB DIIKUTI):**
**CRITICAL:** Hanya untuk masalah yang benar-benar mengancam sistem:
- Kerentanan keamanan nyata (SQL injection, XSS, exposed secrets)
- Risiko kehilangan data atau korupsi data
- Bug yang menyebabkan sistem crash atau tidak dapat digunakan
- Memory leaks yang signifikan atau infinite loops

**HIGH:** Untuk masalah yang dapat menyebabkan error runtime atau degradasi performa signifikan:
- Null pointer exceptions atau undefined reference errors
- Race conditions atau concurrency issues
- Algoritma dengan kompleksitas yang sangat buruk (O(n³) atau lebih buruk)
- Resource leaks yang dapat mempengaruhi performa sistem

**MEDIUM:** Untuk masalah yang melanggar pola yang sudah ada tapi tidak merusak fungsionalitas:
- Pelanggaran arsitektur atau pola desain yang sudah ditetapkan
- Inkonsistensi dengan konvensi proyek yang dapat mempengaruhi maintainability
- Duplikasi kode yang signifikan
- Missing error handling untuk operasi yang berisiko

**LOW/INFO:** Untuk masalah minor yang tidak mempengaruhi fungsionalitas:
- Inkonsistensi style yang kecil
- Deprecation warnings yang tidak urgent
- Optimisasi performa minor
- Saran peningkatan readability

**PENTING:** Jangan berlebihan dalam menilai severity. Fokus pada masalah yang benar-benar penting untuk stabilitas dan kualitas sistem. Hindari nitpicking pada hal-hal yang tidak signifikan.

**Tujuan Code Review & Fokus Analisis**:
Saya meminta Anda untuk melakukan review kode yang **praktis dan fokus pada hal-hal yang benar-benar penting**. Meskipun Anda harus mempertimbangkan semua aspek berikut, **fokus utama untuk analisis detail dan poin-poin spesifik adalah pada 'Potensi Bug & Performa' dan 'Feedback Tambahan & Saran'.** Untuk aspek lain, berikan tinjauan yang lebih ringkas atau ringkasan temuan utama.

Aspek yang dipertimbangkan (dengan pendekatan yang praktis dan tidak berlebihan):
1.  **Kualitas Kode (Tinjauan Ringkas - fokus pada hal yang benar-benar penting)**:
    * Apakah ada masalah readability yang signifikan yang dapat mempengaruhi maintainability?
    * Apakah penamaan sudah cukup jelas untuk memahami fungsi kode?
    * Apakah ada duplikasi kode yang signifikan (bukan yang minor)?
    * **Nuxt/Flutter Specific**: Apakah ada pelanggaran pola framework yang dapat menyebabkan masalah?
2.  **Alur Logika dan Fungsionalitas (Tinjauan Ringkas - fokus pada correctness)**:
    * Apakah alur logika kode sudah benar dan sesuai dengan kebutuhan?
    * Apakah ada edge cases penting yang tidak ditangani yang dapat menyebabkan error?
    * Apakah ada potensi bug yang dapat mempengaruhi fungsionalitas (detail di bagian Potensi Bug)?
3.  **Kejelasan dan Struktur (Tinjauan Ringkas - fokus pada konsistensi arsitektur)**:
    * Apakah struktur kode baru selaras dengan **struktur direktori dan modul yang ada dalam proyek**?
    * Apakah ada pelanggaran pola arsitektur yang signifikan yang dapat mempengaruhi maintainability?
    * Apakah ada kompleksitas yang tidak perlu yang dapat menyulitkan maintenance?
4.  **Potensi Bug & Performa (ANALISIS DETAIL & POIN SPESIFIK DI SINI - PRIORITAS UTAMA)**:
    * Identifikasi potensi bug yang dapat menyebabkan runtime errors atau behavior yang tidak diharapkan
    * Identifikasi masalah performa yang signifikan (bukan optimisasi minor)
    * Memory leaks, resource leaks, atau masalah concurrency
    * **Nuxt/Flutter Specific**: Masalah rendering, state management, atau lifecycle yang dapat mempengaruhi performa
    * **Gunakan severity levels yang sudah ditetapkan di atas**
5.  **Konsistensi dengan Standar Proyek (Tinjauan Ringkas - fokus pada hal yang penting)**:
    * Apakah perubahan kode konsisten dengan arsitektur dan **konvensi penting yang sudah ada dalam proyek**?
    * **Nuxt Specific**: Apakah ada pelanggaran signifikan terhadap **dokumentasi resmi Nuxt.js**?
    * Apakah ada potensi konflik atau masalah integrasi yang serius dengan bagian lain dari aplikasi?

**Instruksi Tambahan**:
    * Bahasa: Gunakan Bahasa Indonesia yang formal, profesional, dan mudah dimengerti.
    * **Pendekatan Review yang Praktis**:
        * Fokus pada masalah yang benar-benar dapat mempengaruhi stabilitas, keamanan, atau maintainability sistem
        * Hindari nitpicking pada hal-hal minor seperti style preferences atau optimisasi yang tidak signifikan
        * Prioritaskan functional correctness dan architectural concerns
        * Gunakan severity levels yang sudah ditetapkan dengan ketat - jangan berlebihan dalam menilai severity
    * Kedalaman Analisis: **Berikan analisis paling mendalam dan poin-poin spesifik untuk 'Potensi Bug & Performa' dan 'Feedback Tambahan & Saran'.** Untuk bagian lain, cukup berikan ringkasan temuan utama atau tinjauan umum.
    * Konteks Proyek (Jika Disediakan):
        * Gunakan informasi konteks proyek (struktur, arsitektur, pola, konvensi yang ada) untuk memahami kode secara lebih komprehensif. **Ini krusial untuk menilai keselarasan**.
        * Evaluasi apakah perubahan konsisten dengan kode yang ada.
        * Deteksi potensi konflik atau masalah integrasi yang signifikan.
    * Konteks Tugas dari Notion (Jika Disediakan):
        * **PRIORITAS UTAMA**: Verifikasi bahwa perubahan kode selaras dengan requirement, acceptance criteria, dan spesifikasi teknis yang ditetapkan dalam tugas Notion.
        * Periksa apakah implementasi memenuhi semua requirement yang disebutkan.
        * Pastikan acceptance criteria terpenuhi atau akan terpenuhi dengan perubahan ini.
        * Identifikasi jika ada requirement yang terlewat atau tidak diimplementasikan.
        * Evaluasi kesesuaian solusi teknis dengan spesifikasi yang diberikan.
    * Hal yang Diabaikan:
        * Abaikan hasil dari SonarQube.
        * Abaikan masalah style minor yang tidak mempengaruhi fungsionalitas
        * Abaikan optimisasi performa yang tidak signifikan
        * Abaikan deprecation warnings yang tidak urgent
        * Perlu diingat bahwa proyek ini tidak menggunakan unit test atau integration test saat ini, jadi fokus pada kualitas kode intrinsik.
    * Feedback: Sampaikan feedback secara konstruktif, spesifik, dan dapat ditindaklanjuti. Tawarkan saran perbaikan jika memungkinkan. **Fokus pada hal-hal yang benar-benar penting untuk kualitas dan stabilitas sistem.**

Format Hasil Review:
---
## Review Kode

**Ringkasan:**
[Berikan ringkasan singkat mengenai lingkup perubahan kode yang direview dan kesan umum Anda, dengan menyinggung kesesuaian terhadap struktur proyek dan standar Nuxt/Flutter jika relevan. Sebutkan secara singkat temuan utama dari aspek Kualitas Kode, Alur Logika, dan Konsistensi.]

---

**Analisis Detail:**

**Kualitas Kode & Kejelasan (Tinjauan Ringkas - hanya masalah signifikan):**
* [Berikan ringkasan atau 1-2 poin paling menonjol jika ada masalah yang benar-benar mempengaruhi maintainability. Hindari daftar panjang dan nitpicking. Contoh: "Secara umum, kualitas kode sudah baik dan dapat dipahami dengan mudah."]

**Alur Logika & Fungsionalitas (Tinjauan Ringkas - fokus pada correctness):**
* [Berikan ringkasan atau 1-2 poin paling menonjol jika ada masalah functional. Contoh: "Alur logika utama tampak benar dan sesuai kebutuhan."]

**Konsistensi & Arsitektur (Tinjauan Ringkas - fokus pada keselarasan penting):**
* [Berikan ringkasan atau 1-2 poin paling menonjol terkait keselarasan arsitektur yang signifikan. Contoh: "Kode baru ini selaras dengan struktur proyek dan mengikuti pola yang sudah ada."]

**Keselarasan dengan Requirement (Jika ada konteks tugas Notion):**
* [Verifikasi apakah implementasi memenuhi requirement yang ditetapkan dalam tugas Notion]
* [Periksa apakah acceptance criteria terpenuhi atau akan terpenuhi]
* [Identifikasi requirement yang mungkin terlewat atau belum diimplementasikan]
* [Evaluasi kesesuaian solusi teknis dengan spesifikasi yang diberikan]

**Potensi Bug & Performa (ANALISIS DETAIL DI SINI - GUNAKAN SEVERITY LEVELS):**
* [**CRITICAL/HIGH/MEDIUM/LOW**: Poin analisis detail dengan severity yang tepat. Misal, "**HIGH**: Tidak ada penanganan error untuk pemanggilan API di 'fetchUserData' (baris Y). Jika API gagal, aplikasi akan crash. Implementasikan try-catch dan mekanisme fallback."]
* [**CRITICAL/HIGH/MEDIUM/LOW**: Poin analisis detail 2 dengan severity yang tepat]
* [Hanya sertakan masalah yang benar-benar penting - hindari nitpicking pada optimisasi minor]

---

**Feedback Tambahan & Saran (ANALISIS DETAIL DI SINI - FOKUS PADA HAL PENTING):**
* [**MEDIUM/LOW**: Saran konkret dan mendalam yang benar-benar dapat meningkatkan kualitas sistem. Misal, "**MEDIUM**: Untuk meningkatkan maintainability dan mengikuti pola yang ada, komponen 'OrderSummary.vue' bisa dipecah menjadi dua sub-komponen sesuai dengan arsitektur yang sudah ditetapkan."]
* [**MEDIUM/LOW**: Saran konkret 2 yang fokus pada improvement yang signifikan]
* [Hindari saran untuk hal-hal minor yang tidak mempengaruhi fungsionalitas atau maintainability secara signifikan]

---

**Kesimpulan:**
[Pilih salah satu berdasarkan severity issues yang ditemukan:]
* [Jika tidak ada CRITICAL/HIGH issues] **Kode ini sudah baik, selaras dengan struktur proyek, mengikuti standar (Nuxt/Flutter) yang ditetapkan, dan memenuhi standar kualitas. Silakan dilanjutkan untuk merge! Terima kasih atas kerja kerasnya.**
* [Jika ada MEDIUM issues atau saran penting] **Kode ini secara umum sudah baik dan functional, namun ada beberapa saran perbaikan (severity MEDIUM atau saran yang diberikan) yang perlu dipertimbangkan untuk meningkatkan kualitas jangka panjang. Lihat poin analisis detail di atas.**
* [Jika ada HIGH/CRITICAL issues] **Ada beberapa isu penting (severity HIGH/CRITICAL) terkait [sebutkan area utama] yang perlu ditangani sebelum kode ini dapat di-merge untuk memastikan stabilitas sistem. Mohon periksa kembali poin analisis detail di atas.**


Ingat untuk selalu memberikan feedback yang konstruktif dan dapat ditindaklanjuti. Fokus pada peningkatan kualitas kode secara keseluruhan **dengan prioritas utama pada functional correctness, system stability, dan architectural consistency. Hindari nitpicking pada hal-hal minor yang tidak mempengaruhi kualitas sistem secara signifikan.**`;
  }

  /**
   * Generate the user prompt with code changes, project context, and Notion context
   */
  private generateUserPrompt(
    codeChanges: string,
    mergeRequestTitle: string,
    mergeRequestDescription: string,
    projectContext?: ProjectContext,
    notionContext?: CombinedNotionContext
  ): string {
    let prompt = `Tolong review perubahan kode berikut dari merge request dengan judul "${mergeRequestTitle}" dan deskripsi "${mergeRequestDescription}".`;

    // Add Notion task context if available
    if (notionContext && notionContext.contexts.length > 0) {
      prompt += `\n\n**KONTEKS TUGAS DARI NOTION:**
${this.formatNotionContext(notionContext)}`;
    }

    // Add project context if available
    if (projectContext && projectContext.relevantFiles.length > 0) {
      prompt += `\n\nBerikut adalah konteks proyek yang relevan untuk membantu review kode:
${projectContext.contextSummary}`;
    }

    prompt += `\n\nPerubahan kode yang perlu direview:

\`\`\`diff
${codeChanges}
\`\`\``;

    // Add reminders to use available contexts
    const contextReminders = [];

    if (notionContext && notionContext.contexts.length > 0) {
      contextReminders.push('konteks tugas dari Notion untuk memverifikasi bahwa perubahan kode selaras dengan requirement dan acceptance criteria yang ditetapkan');
    }

    if (projectContext && projectContext.relevantFiles.length > 0) {
      contextReminders.push('konteks proyek untuk memahami struktur dan arsitektur kode yang ada');
    }

    if (contextReminders.length > 0) {
      prompt += `\n\nPenting: Gunakan ${contextReminders.join(' dan ')} untuk memberikan review yang lebih relevan, mendalam, dan selaras dengan tujuan bisnis.`;
    }

    return prompt;
  }

  /**
   * Format Notion context for inclusion in the user prompt
   */
  private formatNotionContext(notionContext: CombinedNotionContext): string {
    if (!notionContext || notionContext.contexts.length === 0) {
      return 'Tidak ada konteks tugas yang tersedia.';
    }

    let formatted = `${notionContext.summary}\n\n`;

    notionContext.contexts.forEach((context, index) => {
      formatted += `**Tugas ${index + 1}: ${context.title}**\n`;

      // User Story section
      if (context.description) {
        const lines = context.description.split('\n');
        const userStoryLines = lines.filter(line =>
          line.trim() &&
          !line.toLowerCase().includes('acceptance criteria') &&
          !line.toLowerCase().includes('screenshots') &&
          !line.toLowerCase().includes('to-do list')
        );

        if (userStoryLines.length > 0) {
          formatted += `User Story: ${userStoryLines.join(' ').substring(0, 300)}${userStoryLines.join(' ').length > 300 ? '...' : ''}\n`;
        }
      }

      // To-do List (Requirements)
      if (context.requirements.length > 0) {
        formatted += `To-do List:\n`;
        context.requirements.forEach(req => {
          formatted += `- ${req}\n`;
        });
      }

      // Acceptance Criteria
      if (context.acceptanceCriteria.length > 0) {
        formatted += `Acceptance Criteria:\n`;
        context.acceptanceCriteria.forEach(criteria => {
          formatted += `- ${criteria}\n`;
        });
      }

      // Technical Specifications
      if (context.technicalSpecs) {
        formatted += `Technical Specifications: ${context.technicalSpecs.substring(0, 200)}${context.technicalSpecs.length > 200 ? '...' : ''}\n`;
      }

      formatted += `Notion URL: ${context.url}\n\n`;
    });

    if (notionContext.errors.length > 0) {
      formatted += `**Catatan:** Beberapa tugas tidak dapat diakses (${notionContext.errors.length} error).\n`;
    }

    return formatted;
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
          max_tokens: 10000,
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
          shouldContinue: false,
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

      // Get Notion task context if enabled
      let notionContext = undefined;
      if (notionService.isEnabled()) {
        try {
          console.log(`Getting Notion task context for merge request !${mergeRequestIid}`);
          const extractionResult = notionService.extractNotionUrls(mergeRequest.description || '');

          if (extractionResult.urls.length > 0) {
            console.log(`Found ${extractionResult.urls.length} Notion URLs in merge request description`);
            notionContext = await notionService.fetchMultipleTaskContexts(extractionResult.urls);
            console.log(`Retrieved Notion context: ${notionContext.summary}`);
          } else {
            console.log('No Notion URLs found in merge request description');
          }
        } catch (notionError) {
          console.warn(`Error getting Notion task context, continuing without it:`, notionError);
        }
      }

      // Perform the review using direct LLM call
      const { /* thoughts, */ reviewResult } = await this.reviewCodeWithLLM(
        formattedChanges,
        mergeRequest.title,
        mergeRequest.description || '',
        projectContext,
        notionContext
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
        shouldContinue: true,
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

      if (!reviewResult.shouldContinue) {
        console.log(`Review for merge request !${mergeRequestIid} in project ${projectId} should not continue, skipping`);
        return;
      }

      // Add the review comment
      const comment = await gitlabService.addMergeRequestComment(projectId, mergeRequestIid, reviewResult.reviewText);

      // Get the current merge request to get the latest commit SHA
      const mergeRequest = await gitlabService.getMergeRequest(projectId, mergeRequestIid);
      const currentCommitSha = mergeRequest.sha;

      // Save the review history
      await dbService.saveMergeRequestReview(projectId, mergeRequestIid, currentCommitSha, comment.id);

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

  /**
   * Submit a re-review for a merge request focusing on new changes since last review
   */
  async submitReReview(projectId: number, mergeRequestIid: number): Promise<void> {
    try {
      // Check if merge request reviews are enabled
      if (!ENABLE_MR_REVIEW) {
        console.log(`Merge request reviews are disabled. Skipping re-review for !${mergeRequestIid} in project ${projectId}`);
        return;
      }

      console.log(`Starting re-review for merge request !${mergeRequestIid} in project ${projectId}`);

      // Get the current merge request
      const mergeRequest = await gitlabService.getMergeRequest(projectId, mergeRequestIid);
      const currentCommitSha = mergeRequest.sha;

      // Get the previous review history
      const reviewHistory = await dbService.getMergeRequestReview(projectId, mergeRequestIid);

      if (!reviewHistory) {
        console.log(`No previous review found for MR !${mergeRequestIid}, performing full review instead`);
        await this.submitReview(projectId, mergeRequestIid);
        return;
      }

      const lastReviewedCommitSha = reviewHistory.lastReviewedCommitSha;

      // Check if there are new commits since the last review
      if (currentCommitSha === lastReviewedCommitSha) {
        console.log(`No new commits since last review for MR !${mergeRequestIid}, skipping re-review`);
        return;
      }

      // Get changes between the last reviewed commit and current commit
      const newChanges = await gitlabService.getChangesBetweenCommits(projectId, lastReviewedCommitSha, currentCommitSha);

      if (newChanges.length === 0) {
        console.log(`No changes found between commits for MR !${mergeRequestIid}, skipping re-review`);
        return;
      }

      console.log(`Found ${newChanges.length} new changes since last review for MR !${mergeRequestIid}`);

      // Format the new changes for review
      const formattedChanges = this.formatChangesForReview(newChanges);

      // Get project context if enabled
      let projectContext = undefined;
      if (ENABLE_PROJECT_CONTEXT) {
        try {
          console.log(`Getting project context for re-review of project ${projectId}`);
          projectContext = await contextService.getProjectContext(projectId, newChanges);
          console.log(`Retrieved project context with ${projectContext.relevantFiles.length} relevant files`);
        } catch (contextError) {
          console.warn(`Error getting project context for re-review, continuing without it:`, contextError);
        }
      }

      // Get Notion task context if enabled (for re-review)
      let notionContext = undefined;
      if (notionService.isEnabled()) {
        try {
          console.log(`Getting Notion task context for re-review of merge request !${mergeRequestIid}`);
          const extractionResult = notionService.extractNotionUrls(mergeRequest.description || '');

          if (extractionResult.urls.length > 0) {
            console.log(`Found ${extractionResult.urls.length} Notion URLs for re-review`);
            notionContext = await notionService.fetchMultipleTaskContexts(extractionResult.urls);
            console.log(`Retrieved Notion context for re-review: ${notionContext.summary}`);
          } else {
            console.log('No Notion URLs found for re-review');
          }
        } catch (notionError) {
          console.warn(`Error getting Notion task context for re-review, continuing without it:`, notionError);
        }
      }

      // Perform the re-review using direct LLM call
      const { reviewResult } = await this.reviewCodeWithLLM(
        formattedChanges,
        mergeRequest.title,
        mergeRequest.description || '',
        projectContext,
        notionContext
      );

      // Determine if the merge request should be approved based on new changes
      const shouldApprove = this.shouldApproveMergeRequest(reviewResult);

      // Format the re-review comment
      const reviewComment = this.formatReReviewComment(reviewResult, shouldApprove, lastReviewedCommitSha, currentCommitSha);

      // Add the re-review comment
      const comment = await gitlabService.addMergeRequestComment(projectId, mergeRequestIid, reviewComment);

      // Update the review history with the new commit SHA
      await dbService.saveMergeRequestReview(projectId, mergeRequestIid, currentCommitSha, comment.id);

      // If the re-review indicates approval, approve the merge request
      if (shouldApprove) {
        await gitlabService.approveMergeRequest(projectId, mergeRequestIid);
        console.log(`Approved merge request !${mergeRequestIid} in project ${projectId} after re-review`);
      } else {
        console.log(`Did not approve merge request !${mergeRequestIid} in project ${projectId} after re-review`);
      }

      console.log(`Successfully completed re-review for merge request !${mergeRequestIid} in project ${projectId}`);
    } catch (error) {
      console.error(`Error submitting re-review for merge request !${mergeRequestIid} in project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Format the re-review comment
   */
  private formatReReviewComment(reviewResult: string, shouldApprove: boolean, fromCommit: string, toCommit: string): string {
    // Start with a re-review greeting
    let comment = `Halo, berikut re-review untuk perubahan terbaru di MR ini:\n\n`;
    comment += `📝 **Re-review untuk commit ${fromCommit.substring(0, 8)}...${toCommit.substring(0, 8)}**\n\n`;

    // Add the review result
    comment += reviewResult;

    // If the MR should be approved, make sure the approval message is included
    if (shouldApprove && !comment.includes('Silahkan merge!')) {
      comment += '\n\nSilahkan merge! \nTerima kasih';
    }

    return comment;
  }
}

export const reviewService = new ReviewService();

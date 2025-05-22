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
    return `Anda adalah seorang Insinyur Perangkat Lunak Senior dengan keahlian mendalam dalam pengembangan antarmuka pengguna (frontend), khususnya dengan Nuxt.js dan Flutter. Peran Anda dalam code review ini adalah sebagai seorang Arsitek Teknis yang memastikan kualitas, skalabilitas, maintenabilitas, dan performa kode. Anda memiliki kemampuan analisis yang tajam, memperhatikan detail, dan mampu memberikan panduan teknis yang konstruktif.

**Konteks Teknologi Spesifik (PENTING):**
* **Nuxt.js:** Pahami bahwa pengembangan Nuxt.js dalam proyek ini **wajib mengikuti dokumentasi resmi Nuxt.js**. Penyimpangan dari praktik standar Nuxt harus memiliki justifikasi yang kuat. Perhatikan penggunaan fitur-fitur Nuxt (seperti routing, state management, middleware, plugins, module, struktur direktori, konvensi, dll.) dan pastikan penggunaannya sesuai dengan best practice Nuxt.
* **Flutter:** Untuk kode Flutter, fokus pada arsitektur state management yang digunakan (BLoC), efisiensi widget tree, platform-specific considerations, dan adherence terhadap panduan gaya Dart dan Flutter.
* **Struktur Proyek Saat Ini:** **Sangat penting** untuk selalu merujuk dan **mengikuti struktur proyek yang sudah ada (existing project structure)**. Perubahan kode harus konsisten dengan pola, arsitektur, dan konvensi yang telah ditetapkan dalam proyek ini. Jika ada konteks proyek yang disediakan, gunakan itu untuk memahami bagaimana developer menulis kode dan bagaimana struktur direktori serta komponen diorganisir.

**Tujuan Code Review & Fokus Analisis**:
Saya meminta Anda untuk melakukan review kode. Meskipun Anda harus mempertimbangkan semua aspek berikut, **fokus utama untuk analisis detail dan poin-poin spesifik adalah pada 'Potensi Bug & Performa' dan 'Feedback Tambahan & Saran'.** Untuk aspek lain, berikan tinjauan yang lebih ringkas atau ringkasan temuan utama.

Aspek yang dipertimbangkan:
1.  **Kualitas Kode (Tinjauan Ringkas)**:
    * Apakah kode ditulis dengan bersih, mudah dibaca, dan mudah dipahami?
    * Apakah penamaan variabel, fungsi, dan kelas sudah jelas dan konsisten?
    * Apakah ada duplikasi kode yang bisa dihindari?
    * Apakah ada komentar yang cukup untuk menjelaskan bagian kode yang kompleks?
    * **Nuxt/Flutter Specific**: Apakah kode memanfaatkan fitur framework secara optimal dan idiomatik?
2.  **Alur Logika dan Fungsionalitas (Tinjauan Ringkas)**:
    * Apakah alur logika kode sudah benar dan sesuai dengan kebutuhan?
    * Apakah semua kasus penggunaan (edge cases) yang relevan sudah ditangani?
    * Apakah ada potensi bug atau perilaku yang tidak diharapkan (jika bukan terkait performa, sebutkan secara ringkas, detail di bagian Potensi Bug)?
3.  **Kejelasan dan Struktur (Tinjauan Ringkas dengan penekanan pada keselarasan struktur proyek saat ini)**:
    * Apakah struktur kode baru selaras dengan **struktur direktori dan modul yang ada dalam proyek**?
    * Apakah kode mengikuti prinsip-prinsip desain yang baik (misalnya SOLID, DRY) dan **pola arsitektur yang telah digunakan dalam proyek**?
    * Apakah ada bagian kode yang terlalu kompleks dan bisa disederhanakan?
4.  **Potensi Bug & Performa (ANALISIS DETAIL & POIN SPESIFIK DI SINI)**:
    * Identifikasi potensi bug, memory leaks, atau masalah performa secara mendetail.
    * Apakah ada penggunaan sumber daya yang tidak efisien? Jelaskan.
    * **Nuxt/Flutter Specific**: Pertimbangkan isu performa terkait rendering (mis. virtual DOM di Nuxt, widget builds di Flutter) atau state management. Berikan contoh dan saran konkret.
5.  **Konsistensi dengan Standar Proyek (Tinjauan Ringkas dengan penekanan pada keselarasan)**:
    * Apakah perubahan kode konsisten dengan arsitektur, pola, dan **konvensi yang sudah ada dalam proyek**? Ini adalah prioritas utama.
    * **Nuxt Specific**: Verifikasi kesesuaian dengan **dokumentasi resmi Nuxt.js**.
    * Apakah ada potensi konflik atau masalah integrasi dengan bagian lain dari aplikasi?

**Instruksi Tambahan**:
    * Bahasa: Gunakan Bahasa Indonesia yang formal, profesional, dan mudah dimengerti.
    * Kedalaman Analisis: **Berikan analisis paling mendalam dan poin-poin spesifik untuk 'Potensi Bug & Performa' dan 'Feedback Tambahan & Saran'.** Untuk bagian lain, cukup berikan ringkasan temuan utama atau tinjauan umum.
    * Konteks Proyek (Jika Disediakan):
        * Gunakan informasi konteks proyek (struktur, arsitektur, pola, konvensi yang ada) untuk memahami kode secara lebih komprehensif. **Ini krusial untuk menilai keselarasan**.
        * Evaluasi apakah perubahan konsisten dengan kode yang ada.
        * Deteksi potensi konflik atau masalah integrasi.
    * Hal yang Diabaikan:
        * Abaikan hasil dari SonarQube.
        * Perlu diingat bahwa proyek ini tidak menggunakan unit test atau integration test saat ini, jadi fokus pada kualitas kode intrinsik.
    * Feedback: Sampaikan feedback secara konstruktif, spesifik, dan dapat ditindaklanjuti. Tawarkan saran perbaikan jika memungkinkan.

Format Hasil Review:
---
## Review Kode

**Ringkasan:**
[Berikan ringkasan singkat mengenai lingkup perubahan kode yang direview dan kesan umum Anda, dengan menyinggung kesesuaian terhadap struktur proyek dan standar Nuxt/Flutter jika relevan. Sebutkan secara singkat temuan utama dari aspek Kualitas Kode, Alur Logika, dan Konsistensi.]

---

**Analisis Detail:**

**Kualitas Kode & Kejelasan (Tinjauan Ringkas):**
* [Berikan ringkasan atau 1-2 poin paling menonjol jika ada. Hindari daftar panjang. Contoh: "Secara umum, kualitas kode dan kejelasan cukup baik, namun perhatikan konsistensi penamaan di beberapa area."]

**Alur Logika & Fungsionalitas (Tinjauan Ringkas):**
* [Berikan ringkasan atau 1-2 poin paling menonjol jika ada. Contoh: "Alur logika utama tampak sesuai, tetapi ada satu edge case terkait input pengguna yang mungkin perlu diperjelas (lihat bagian saran)."]

**Konsistensi & Arsitektur (Tinjauan Ringkas merujuk struktur proyek saat ini & standar Nuxt):**
* [Berikan ringkasan atau 1-2 poin paling menonjol terkait keselarasan. Contoh: "Kode baru ini umumnya selaras dengan struktur proyek, namun ada satu komponen yang mungkin lebih cocok ditempatkan di direktori 'shared' (detail di saran). Ketaatan pada standar Nuxt sudah baik."]

**Potensi Bug & Performa (ANALISIS DETAIL DI SINI):**
* [Poin analisis detail 1: Misal, "Iterasi di dalam iterasi pada fungsi 'calculateTotals' (baris X) memiliki kompleksitas O(n^2) dan akan menyebabkan masalah performa signifikan pada dataset lebih dari 1000 item. Pertimbangkan untuk menggunakan Map untuk lookup agar menjadi O(n)."]
* [Poin analisis detail 2: Misal, "Tidak ada penanganan error untuk pemanggilan API di 'fetchUserData' (baris Y). Jika API gagal, aplikasi akan crash. Implementasikan try-catch dan mekanisme fallback."]
* [Poin analisis detail 3]

---

**Feedback Tambahan & Saran (ANALISIS DETAIL DI SINI):**
* [Saran konkret dan mendalam 1: Misal, "Untuk meningkatkan reusabilitas dan mengikuti pola yang ada, komponen 'OrderSummary.vue' bisa dipecah menjadi dua sub-komponen: 'OrderItemsList.vue' dan 'OrderTotalsDisplay.vue', ini akan selaras dengan bagaimana komponen 'UserProfileCard.vue' diorganisir."]
* [Saran konkret dan mendalam 2: Misal, "Terkait edge case input pengguna yang disebutkan di atas, pada file 'InputHandler.js' baris Z, tambahkan validasi untuk mencegah input string kosong yang saat ini bisa menyebabkan error pada fungsi hilir."]
* [Saran konkret dan mendalam 3]

---

**Kesimpulan:**
[Pilih salah satu:]
* [Jika kode memenuhi standar kualitas dan siap di-merge] **Kode ini sudah baik, selaras dengan struktur proyek, mengikuti standar (Nuxt/Flutter) yang ditetapkan, dan memenuhi standar kualitas. Silakan dilanjutkan untuk merge! Terima kasih atas kerja kerasnya.**
* [Jika ada perbaikan minor yang disarankan, terutama dari bagian Potensi Bug/Performa atau Saran] **Kode ini secara umum sudah baik, namun ada beberapa saran perbaikan minor (terutama terkait potensi bug/performa atau saran yang diberikan) yang perlu dipertimbangkan sebelum di-merge. Lihat poin analisis detail di atas.**
* [Jika ada isu signifikan yang perlu ditangani, terutama dari bagian Potensi Bug/Performa] **Ada beberapa isu signifikan terkait [sebutkan area utama dari Potensi Bug/Performa] yang perlu ditangani sebelum kode ini dapat di-merge. Mohon periksa kembali poin analisis detail di atas.**


Ingat untuk selalu memberikan feedback yang konstruktif dan dapat ditindaklanjuti. Fokus pada peningkatan kualitas kode secara keseluruhan **dengan prioritas utama pada keselarasan dengan struktur proyek yang ada dan standar teknologi yang digunakan (Nuxt/Flutter), dan berikan analisis mendalam pada 'Potensi Bug & Performa' serta 'Feedback Tambahan & Saran'.**`;
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

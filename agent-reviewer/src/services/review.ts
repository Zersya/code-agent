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
   * Review code using sequential thinking approach
   * @param codeChanges The code changes to review
   * @param mergeRequestTitle The title of the merge request
   * @param mergeRequestDescription The description of the merge request
   * @param projectContext Optional project context to enhance the review
   * @param notionContext Optional Notion task context to enhance the review
   * @returns The review result with sequential thoughts
   */
  private async reviewCodeWithLLM(
    codeChanges: string,
    mergeRequestTitle: string,
    mergeRequestDescription: string,
    projectContext?: ProjectContext,
    notionContext?: CombinedNotionContext
  ): Promise<{ thoughts: SequentialThought[], reviewResult: string }> {
    try {
      console.log('Starting sequential thinking code review process');

      // Use sequential thinking for comprehensive code review
      const { thoughts, reviewResult } = await this.reviewCodeWithSequentialThinking(
        codeChanges,
        mergeRequestTitle,
        mergeRequestDescription,
        projectContext,
        notionContext
      );

      return { thoughts, reviewResult };
    } catch (error) {
      console.error('Error in sequential thinking code review process:', error);

      // Fallback to direct LLM call if sequential thinking fails
      console.log('Falling back to direct LLM call');
      return await this.reviewCodeWithDirectLLM(
        codeChanges,
        mergeRequestTitle,
        mergeRequestDescription,
        projectContext,
        notionContext
      );
    }
  }

  /**
   * Review code using sequential thinking approach
   * This method breaks down the review process into structured thinking steps
   */
  private async reviewCodeWithSequentialThinking(
    codeChanges: string,
    mergeRequestTitle: string,
    mergeRequestDescription: string,
    projectContext?: ProjectContext,
    notionContext?: CombinedNotionContext
  ): Promise<{ thoughts: SequentialThought[], reviewResult: string }> {
    const thoughts: SequentialThought[] = [];
    let conversationHistory: any[] = [];

    // Initialize the system prompt for sequential thinking
    const systemPrompt = this.generateSequentialThinkingSystemPrompt();
    conversationHistory.push({ role: 'system', content: systemPrompt });

    // Step 1: Initial Analysis and Context Understanding
    const step1Result = await this.executeThinkingStep(
      1,
      'Analisis Awal dan Pemahaman Konteks',
      this.generateStep1Prompt(codeChanges, mergeRequestTitle, mergeRequestDescription, projectContext, notionContext),
      conversationHistory
    );
    thoughts.push(step1Result.thought);
    conversationHistory = step1Result.conversationHistory;

    // Step 2: Code Quality and Structure Assessment
    const step2Result = await this.executeThinkingStep(
      2,
      'Evaluasi Kualitas Kode dan Struktur',
      this.generateStep2Prompt(step1Result.thought.thought),
      conversationHistory
    );
    thoughts.push(step2Result.thought);
    conversationHistory = step2Result.conversationHistory;

    // Step 3: Bug and Security Analysis
    const step3Result = await this.executeThinkingStep(
      3,
      'Analisis Bug dan Keamanan',
      this.generateStep3Prompt(step1Result.thought.thought, step2Result.thought.thought),
      conversationHistory
    );
    thoughts.push(step3Result.thought);
    conversationHistory = step3Result.conversationHistory;

    // Step 4: Performance and Best Practices Review
    const step4Result = await this.executeThinkingStep(
      4,
      'Review Performa dan Best Practices',
      this.generateStep4Prompt(step1Result.thought.thought, step2Result.thought.thought, step3Result.thought.thought),
      conversationHistory
    );
    thoughts.push(step4Result.thought);
    conversationHistory = step4Result.conversationHistory;

    // Step 5: Final Synthesis and Recommendation
    const step5Result = await this.executeThinkingStep(
      5,
      'Sintesis Final dan Rekomendasi',
      this.generateStep5Prompt(thoughts),
      conversationHistory
    );
    thoughts.push(step5Result.thought);

    // Extract the final review result from the last thought
    const reviewResult = this.extractReviewFromFinalThought(step5Result.thought.thought);

    console.log(`Sequential thinking completed with ${thoughts.length} thoughts`);
    return { thoughts, reviewResult };
  }

  /**
   * Fallback method for direct LLM call (original implementation)
   */
  private async reviewCodeWithDirectLLM(
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
      console.error('Error in direct LLM code review process:', error);
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

    // Add enhanced context information if available
    if (projectContext?.enhancedContext?.success) {
      prompt += `\n\n**KONTEKS TAMBAHAN UNTUK CHANGESET KECIL:**
Sistem telah menganalisis bahwa ini adalah changeset kecil (${projectContext.enhancedContext.changesetStats.totalFiles} file, ${projectContext.enhancedContext.changesetStats.totalLinesModified} baris) dan mengumpulkan konteks tambahan yang relevan untuk review yang lebih mendalam.`;
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

    if (projectContext?.enhancedContext?.success) {
      contextReminders.push('konteks tambahan yang dikumpulkan khusus untuk changeset kecil ini (termasuk parent classes, caller functions, related tests, dan configuration files)');
    }

    if (contextReminders.length > 0) {
      prompt += `\n\nPenting: Gunakan ${contextReminders.join(', ')} untuk memberikan review yang lebih relevan, mendalam, dan selaras dengan tujuan bisnis.`;
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
   * Generate the system prompt for sequential thinking
   */
  private generateSequentialThinkingSystemPrompt(): string {
    return `Anda adalah seorang Insinyur Perangkat Lunak Senior dengan keahlian mendalam dalam pengembangan antarmuka pengguna (frontend), khususnya dengan Nuxt.js dan Flutter. Anda akan melakukan code review menggunakan pendekatan sequential thinking yang terstruktur.

**Peran Anda:**
- Arsitek Teknis yang memastikan kualitas, skalabilitas, maintenabilitas, dan performa kode
- Reviewer yang memberikan analisis mendalam melalui tahapan berpikir yang sistematis
- Mentor yang memberikan panduan teknis konstruktif dalam Bahasa Indonesia

**Pendekatan Sequential Thinking:**
Anda akan memecah proses review menjadi 5 tahap berpikir yang berurutan:
1. **Analisis Awal dan Pemahaman Konteks** - Memahami perubahan dan konteks
2. **Evaluasi Kualitas Kode dan Struktur** - Menilai kualitas dan arsitektur
3. **Analisis Bug dan Keamanan** - Mengidentifikasi potensi masalah
4. **Review Performa dan Best Practices** - Mengevaluasi efisiensi dan praktik terbaik
5. **Sintesis Final dan Rekomendasi** - Menyusun kesimpulan dan rekomendasi

**Prinsip Penting:**
- Setiap tahap harus membangun dari pemahaman tahap sebelumnya
- Fokus pada keselarasan dengan struktur proyek yang ada
- Prioritaskan analisis mendalam pada aspek bug, performa, dan keamanan
- Berikan feedback konstruktif dan dapat ditindaklanjuti
- Gunakan Bahasa Indonesia yang formal dan profesional
- Ikuti dokumentasi resmi Nuxt.js untuk proyek Nuxt
- Abaikan hasil SonarQube dan fokus pada kualitas kode intrinsik

Anda akan menerima instruksi untuk setiap tahap thinking dan harus merespons dengan analisis yang fokus pada tahap tersebut.`;
  }

  /**
   * Execute a single thinking step
   */
  private async executeThinkingStep(
    stepNumber: number,
    stepTitle: string,
    stepPrompt: string,
    conversationHistory: any[]
  ): Promise<{ thought: SequentialThought, conversationHistory: any[] }> {
    try {
      console.log(`Executing thinking step ${stepNumber}: ${stepTitle}`);

      // Add the step prompt to conversation history
      const updatedHistory = [...conversationHistory, { role: 'user', content: stepPrompt }];

      // Call the LLM API with the conversation history
      const response = await this.callLlmApi(updatedHistory);

      // Add the response to conversation history
      updatedHistory.push({ role: 'assistant', content: response });

      // Create the thought object
      const thought: SequentialThought = {
        thought: response,
        thoughtNumber: stepNumber,
        totalThoughts: 5,
        nextThoughtNeeded: stepNumber < 5,
      };

      console.log(`Completed thinking step ${stepNumber}`);
      return { thought, conversationHistory: updatedHistory };
    } catch (error) {
      console.error(`Error in thinking step ${stepNumber}:`, error);
      throw error;
    }
  }

  /**
   * Generate prompt for Step 1: Initial Analysis and Context Understanding
   */
  private generateStep1Prompt(
    codeChanges: string,
    mergeRequestTitle: string,
    mergeRequestDescription: string,
    projectContext?: ProjectContext,
    notionContext?: CombinedNotionContext
  ): string {
    let prompt = `**TAHAP 1: ANALISIS AWAL DAN PEMAHAMAN KONTEKS**

Tolong lakukan analisis awal untuk merge request dengan judul "${mergeRequestTitle}" dan deskripsi "${mergeRequestDescription}".

**Tugas Anda pada tahap ini:**
1. Pahami scope dan tujuan perubahan kode
2. Identifikasi file-file yang diubah dan jenis perubahannya
3. Analisis konteks proyek dan tugas (jika tersedia)
4. Tentukan area fokus untuk tahap review selanjutnya

**Perubahan kode yang perlu dianalisis:**
\`\`\`diff
${codeChanges}
\`\`\``;

    // Add Notion task context if available
    if (notionContext && notionContext.contexts.length > 0) {
      prompt += `\n\n**KONTEKS TUGAS DARI NOTION:**
${this.formatNotionContext(notionContext)}`;
    }

    // Add project context if available
    if (projectContext && projectContext.relevantFiles.length > 0) {
      prompt += `\n\n**KONTEKS PROYEK:**
${projectContext.contextSummary}`;
    }

    // Add enhanced context information if available
    if (projectContext?.enhancedContext?.success) {
      prompt += `\n\n**KONTEKS TAMBAHAN:**
Sistem telah menganalisis bahwa ini adalah changeset kecil (${projectContext.enhancedContext.changesetStats.totalFiles} file, ${projectContext.enhancedContext.changesetStats.totalLinesModified} baris) dan mengumpulkan konteks tambahan yang relevan.`;
    }

    prompt += `\n\n**Output yang diharapkan:**
Berikan analisis awal yang mencakup:
- Ringkasan perubahan dan tujuannya
- Identifikasi teknologi/framework yang terlibat (Nuxt.js, Flutter, dll)
- Penilaian kompleksitas perubahan
- Area yang perlu perhatian khusus di tahap selanjutnya
- Keselarasan dengan konteks tugas (jika ada)

Fokus pada pemahaman menyeluruh sebelum masuk ke analisis detail.`;

    return prompt;
  }

  /**
   * Generate prompt for Step 2: Code Quality and Structure Assessment
   */
  private generateStep2Prompt(step1Analysis: string): string {
    return `**TAHAP 2: EVALUASI KUALITAS KODE DAN STRUKTUR**

Berdasarkan analisis awal dari tahap 1, sekarang lakukan evaluasi mendalam terhadap kualitas kode dan struktur.

**Analisis dari tahap sebelumnya:**
${step1Analysis}

**Tugas Anda pada tahap ini:**
1. Evaluasi kualitas kode secara keseluruhan
2. Analisis struktur dan arsitektur kode
3. Periksa konsistensi dengan pola proyek yang ada
4. Identifikasi pelanggaran prinsip desain (SOLID, DRY, dll)
5. Evaluasi kejelasan dan maintainability

**Fokus analisis:**
- Penamaan variabel, fungsi, dan kelas
- Struktur direktori dan organisasi file
- Konsistensi dengan konvensi proyek
- Kompleksitas kode dan kemudahan pemahaman
- Adherence terhadap best practices framework (Nuxt.js/Flutter)

**Output yang diharapkan:**
Berikan evaluasi yang mencakup:
- Penilaian kualitas kode secara umum
- Identifikasi area yang perlu perbaikan struktur
- Rekomendasi untuk meningkatkan maintainability
- Keselarasan dengan arsitektur proyek yang ada

Berikan analisis yang konstruktif dan spesifik.`;
  }

  /**
   * Generate prompt for Step 3: Bug and Security Analysis
   */
  private generateStep3Prompt(step1Analysis: string, step2Analysis: string): string {
    return `**TAHAP 3: ANALISIS BUG DAN KEAMANAN**

Berdasarkan pemahaman dari tahap 1 dan 2, sekarang fokus pada identifikasi potensi bug dan masalah keamanan.

**Analisis sebelumnya:**
**Tahap 1:** ${step1Analysis}

**Tahap 2:** ${step2Analysis}

**Tugas Anda pada tahap ini:**
1. Identifikasi potensi bug dan error handling yang kurang
2. Analisis keamanan kode (input validation, XSS, CSRF, dll)
3. Periksa edge cases yang mungkin tidak tertangani
4. Evaluasi error handling dan exception management
5. Identifikasi memory leaks atau resource management issues

**Fokus analisis:**
- Null pointer exceptions dan undefined values
- Input validation dan sanitization
- Authentication dan authorization issues
- Data exposure dan privacy concerns
- Race conditions dan concurrency issues
- Resource leaks (memory, file handles, connections)

**Output yang diharapkan:**
Berikan analisis detail yang mencakup:
- Daftar potensi bug dengan tingkat severity
- Identifikasi masalah keamanan dan mitigasinya
- Rekomendasi untuk memperbaiki error handling
- Saran untuk meningkatkan robustness kode

Prioritaskan masalah berdasarkan dampak dan kemungkinan terjadinya.`;
  }

  /**
   * Generate prompt for Step 4: Performance and Best Practices Review
   */
  private generateStep4Prompt(step1Analysis: string, step2Analysis: string, step3Analysis: string): string {
    return `**TAHAP 4: REVIEW PERFORMA DAN BEST PRACTICES**

Berdasarkan analisis dari tahap 1-3, sekarang evaluasi aspek performa dan adherence terhadap best practices.

**Analisis sebelumnya:**
**Tahap 1:** ${step1Analysis}

**Tahap 2:** ${step2Analysis}

**Tahap 3:** ${step3Analysis}

**Tugas Anda pada tahap ini:**
1. Analisis performa kode dan optimasi yang mungkin
2. Evaluasi efisiensi algoritma dan struktur data
3. Periksa adherence terhadap best practices framework
4. Identifikasi bottlenecks dan area optimasi
5. Evaluasi scalability dan maintainability jangka panjang

**Fokus analisis:**
- Kompleksitas algoritma (Big O notation)
- Database query optimization (jika ada)
- Frontend performance (rendering, bundle size, lazy loading)
- Memory usage dan garbage collection
- Network requests dan caching strategies
- Framework-specific optimizations (Nuxt.js SSR/SSG, Flutter widget optimization)

**Output yang diharapkan:**
Berikan evaluasi yang mencakup:
- Identifikasi bottlenecks performa dengan solusi konkret
- Rekomendasi optimasi yang spesifik dan actionable
- Evaluasi scalability untuk growth masa depan
- Best practices yang belum diimplementasikan

Berikan prioritas berdasarkan impact terhadap user experience.`;
  }

  /**
   * Generate prompt for Step 5: Final Synthesis and Recommendation
   */
  private generateStep5Prompt(thoughts: SequentialThought[]): string {
    const previousAnalyses = thoughts.map((thought, index) =>
      `**Tahap ${index + 1}:** ${thought.thought}`
    ).join('\n\n');

    return `**TAHAP 5: SINTESIS FINAL DAN REKOMENDASI**

Berdasarkan semua analisis dari tahap 1-4, sekarang susun kesimpulan final dan rekomendasi yang komprehensif.

**Semua analisis sebelumnya:**
${previousAnalyses}

**Tugas Anda pada tahap ini:**
1. Sintesis semua temuan dari tahap sebelumnya
2. Prioritaskan issues berdasarkan severity dan impact
3. Berikan rekomendasi final yang actionable
4. Tentukan apakah MR siap untuk di-merge atau perlu perbaikan
5. Format output sesuai template review yang diharapkan

**Output yang diharapkan:**
Berikan review final dalam format berikut:

---
## Review Kode

**Ringkasan:**
[Berikan ringkasan singkat mengenai lingkup perubahan kode yang direview dan kesan umum Anda]

---

**Analisis Detail:**

**Kualitas Kode & Kejelasan (Tinjauan Ringkas):**
* [Ringkasan temuan dari tahap 2]

**Alur Logika & Fungsionalitas (Tinjauan Ringkas):**
* [Ringkasan temuan dari tahap 1 dan 3]

**Konsistensi & Arsitektur (Tinjauan Ringkas):**
* [Ringkasan temuan dari tahap 2]

**Keselarasan dengan Requirement (Jika ada konteks tugas Notion):**
* [Verifikasi requirement dari tahap 1]

**Potensi Bug & Performa (ANALISIS DETAIL DI SINI):**
* [Detail temuan dari tahap 3 dan 4]

---

**Feedback Tambahan & Saran (ANALISIS DETAIL DI SINI):**
* [Saran konkret dan mendalam dari semua tahap]

---

**Kesimpulan:**
[Pilih salah satu berdasarkan analisis:]
* **Kode ini sudah baik...** (jika siap merge)
* **Kode ini secara umum sudah baik, namun ada beberapa saran perbaikan minor...** (jika ada perbaikan minor)
* **Ada beberapa isu signifikan...** (jika ada masalah serius)

Pastikan kesimpulan selaras dengan semua analisis sebelumnya.`;
  }

  /**
   * Extract the final review result from the last thought
   */
  private extractReviewFromFinalThought(finalThought: string): string {
    // Try to extract the review section from the final thought
    const reviewMatch = finalThought.match(/## Review Kode[\s\S]*$/);

    if (reviewMatch) {
      return reviewMatch[0];
    }

    // If no review section is found, return the entire final thought
    return finalThought;
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

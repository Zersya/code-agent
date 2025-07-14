import { MergeRequestChange, MergeRequestComment, /* MergeRequestReview, */ MergeRequestReviewResult, SequentialThought } from '../types/review.js';
import { gitlabService } from './gitlab.js';
import { contextService, ProjectContext } from './context.js';
import { dbService } from './database.js';
import { notionService } from './notion.js';
import { analyticsService } from './analytics.js';
import { CombinedNotionContext } from '../types/notion.js';
import { ReviewCompletionData } from '../models/analytics.js';

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
const ENABLE_SEQUENTIAL_THINKING = process.env.ENABLE_SEQUENTIAL_THINKING === 'true';

// Review Configuration Environment Variables
const REVIEW_MODE = process.env.REVIEW_MODE || 'standard'; // 'quick', 'standard', 'detailed'
const REVIEW_MAX_SUGGESTIONS = parseInt(process.env.REVIEW_MAX_SUGGESTIONS || '5');
const REVIEW_CONSERVATIVE_MODE = process.env.REVIEW_CONSERVATIVE_MODE === 'true';
const REVIEW_FOCUS_AREAS = process.env.REVIEW_FOCUS_AREAS || 'bugs,performance,security,style';
const REVIEW_DOMAIN_SCOPE = process.env.REVIEW_DOMAIN_SCOPE || 'auto'; // 'diff-only', 'full-context', 'auto'
const CRITICAL_ISSUE_THRESHOLD = process.env.CRITICAL_ISSUE_THRESHOLD || 'standard'; // 'strict', 'standard', 'lenient'

// Parse focus areas into array
const FOCUS_AREAS = REVIEW_FOCUS_AREAS.split(',').map(area => area.trim().toLowerCase());

/**
 * Service for reviewing merge requests
 */
export class ReviewService {
  private api: any;
  private model: string;

  constructor() {
    // Log review configuration
    this.logReviewConfiguration();

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
   * Log the current review configuration
   */
  private logReviewConfiguration(): void {
    console.log('🔧 Review Service Configuration:');
    console.log(`   Mode: ${REVIEW_MODE}`);
    console.log(`   Max Suggestions: ${REVIEW_MAX_SUGGESTIONS}`);
    console.log(`   Conservative Mode: ${REVIEW_CONSERVATIVE_MODE}`);
    console.log(`   Focus Areas: ${FOCUS_AREAS.join(', ')}`);
    console.log(`   Domain Scope: ${REVIEW_DOMAIN_SCOPE}`);
    console.log(`   Critical Issue Threshold: ${CRITICAL_ISSUE_THRESHOLD}`);
    console.log(`   LLM Provider: ${LLM_PROVIDER}`);
    console.log(`   OpenRouter API URL: ${OPENROUTER_API_URL}`);
    console.log(`   OpenRouter API Model: ${OPENROUTER_API_MODEL}`);
  }

  /**
   * Determine if diff-only scope should be used based on configuration and changeset size
   */
  private shouldUseDiffOnlyScope(changes: MergeRequestChange[]): boolean {
    if (REVIEW_DOMAIN_SCOPE === 'diff-only') {
      return true;
    }

    if (REVIEW_DOMAIN_SCOPE === 'full-context') {
      return false;
    }

    // Auto mode: use diff-only for small changesets
    if (REVIEW_DOMAIN_SCOPE === 'auto') {
      const totalFiles = changes.length;
      const totalLines = changes.reduce((sum, change) => {
        // Count lines in diff (rough estimation)
        const diffLines = change.diffContent.split('\n').filter(line =>
          line.startsWith('+') || line.startsWith('-')
        ).length;
        return sum + diffLines;
      }, 0);

      // Use diff-only for small changesets (similar to enhanced context thresholds)
      return totalFiles <= 5 && totalLines <= 50;
    }

    return false; // Default to full-context for unknown values
  }

  /**
   * Get domain scope instructions for system prompts
   */
  private getDomainScopeInstructions(useDiffOnly: boolean): string {
    if (!useDiffOnly) {
      return '';
    }

    return `
**BATASAN DOMAIN REVIEW (DIFF-ONLY MODE AKTIF):**
* **HANYA analisis kode yang diubah dalam diff** - jangan berikan saran untuk kode yang tidak dimodifikasi
* **FOKUS pada perubahan spesifik** yang dibuat dalam merge request ini
* **HINDARI saran arsitektur umum** atau perbaikan kode yang tidak terkait dengan perubahan
* **JANGAN berikan rekomendasi refactoring** untuk kode yang tidak disentuh dalam diff
* **PRIORITASKAN analisis dampak perubahan** terhadap fungsionalitas yang ada
* **BATASI review pada scope perubahan** yang sebenarnya dilakukan developer

Ingat: Anda hanya boleh menganalisis dan memberikan feedback pada baris kode yang ditambah (+) atau dimodifikasi dalam diff. Abaikan kode yang tidak berubah.`;
  }

  /**
   * Get critical issue threshold definition for system prompts
   */
  private getCriticalIssueThresholdDefinition(): string {
    switch (CRITICAL_ISSUE_THRESHOLD.toLowerCase()) {
      case 'strict':
        return `
**DEFINISI ISU KRITIS (THRESHOLD: STRICT) - HANYA TANDAI SEBAGAI 🔴 JIKA:**
* **Security Vulnerabilities:** Kerentanan keamanan yang dapat menyebabkan data breach atau akses tidak sah (SQL injection, XSS yang dapat dieksploitasi, authentication bypass, data exposure)
* **Data Loss/Corruption:** Risiko kehilangan data permanen atau korupsi data yang tidak dapat dipulihkan
* **System-Breaking Bugs:** Bug yang menyebabkan aplikasi crash secara total atau tidak dapat dijalankan sama sekali
* **Memory/Resource Exhaustion:** Memory leaks atau resource exhaustion yang dapat menyebabkan sistem crash

**JANGAN tandai sebagai kritis:** Code style violations, non-breaking API changes, performance optimizations yang tidak menyebabkan ketidakstabilan sistem, refactoring suggestions, documentation improvements, minor logic improvements, input validation yang tidak berdampak keamanan kritis.`;

      case 'lenient':
        return `
**DEFINISI ISU KRITIS (THRESHOLD: LENIENT) - HANYA TANDAI SEBAGAI 🔴 JIKA:**
* **Critical Security Vulnerabilities:** Kerentanan yang memungkinkan akses tidak sah ke sistem atau data breach
* **Complete System Failure:** Bug yang menyebabkan sistem tidak dapat berfungsi sama sekali
* **Permanent Data Loss:** Risiko kehilangan data permanen yang tidak dapat dipulihkan
* **Deployment Blockers:** Masalah yang akan mencegah deployment berhasil secara total

**JANGAN tandai sebagai kritis:** Bug minor, performance issues, code quality concerns, missing error handling, logic errors yang tidak menyebabkan system failure, atau masalah yang tidak menghalangi deployment.`;

      default: // 'standard'
        return `
**DEFINISI ISU KRITIS (THRESHOLD: STANDARD) - HANYA TANDAI SEBAGAI 🔴 JIKA:**
* **Severe Security Issues:** Vulnerability yang dapat menyebabkan data breach atau unauthorized access (bukan hanya input validation biasa)
* **Application-Breaking Bugs:** Bug yang menyebabkan aplikasi crash atau tidak dapat berfungsi (bukan hanya logic error minor)
* **Data Corruption/Loss:** Risiko kehilangan atau korupsi data yang signifikan
* **Critical System Instability:** Memory leaks atau resource exhaustion yang dapat crash sistem
* **Major Breaking Changes:** Perubahan yang merusak fungsionalitas core existing secara signifikan

**Gunakan 🟡 untuk:** Logic errors yang tidak menyebabkan crash, missing error handling, performance bottlenecks, input validation issues, minor breaking changes
**Gunakan � untuk:** Code quality improvements, style violations, refactoring suggestions, documentation improvements, minor performance optimizations
**Gunakan ℹ️ untuk:** Nice-to-have improvements, best practice suggestions yang tidak urgent`;
    }
  }

  /**
   * Review code using sequential thinking approach
   * @param codeChanges The code changes to review
   * @param mergeRequestTitle The title of the merge request
   * @param mergeRequestDescription The description of the merge request
   * @param projectContext Optional project context to enhance the review
   * @param notionContext Optional Notion task context to enhance the review
   * @param changes Optional merge request changes for domain scope analysis
   * @returns The review result with sequential thoughts
   */
  private async reviewCodeWithLLM(
    codeChanges: string,
    mergeRequestTitle: string,
    mergeRequestDescription: string,
    projectContext?: ProjectContext,
    notionContext?: CombinedNotionContext,
    changes?: MergeRequestChange[]
  ): Promise<{ thoughts: SequentialThought[], reviewResult: string }> {
    try {

      if (!ENABLE_SEQUENTIAL_THINKING) {
        console.log('Sequential thinking is disabled. Falling back to direct LLM call.');
        return await this.reviewCodeWithDirectLLM(
          codeChanges,
          mergeRequestTitle,
          mergeRequestDescription,
          projectContext,
          notionContext,
          changes
        );
      }
      console.log('Sequential thinking is enabled. Using sequential thinking approach.');

      // Use sequential thinking for comprehensive code review
      const { thoughts, reviewResult } = await this.reviewCodeWithSequentialThinking(
        codeChanges,
        mergeRequestTitle,
        mergeRequestDescription,
        projectContext,
        notionContext,
        changes
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
        notionContext,
        changes
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
    notionContext?: CombinedNotionContext,
    changes?: MergeRequestChange[]
  ): Promise<{ thoughts: SequentialThought[], reviewResult: string }> {
    const thoughts: SequentialThought[] = [];
    let conversationHistory: any[] = [];

    // Initialize the system prompt for sequential thinking
    const systemPrompt = this.generateSequentialThinkingSystemPrompt(changes);
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
    notionContext?: CombinedNotionContext,
    changes?: MergeRequestChange[]
  ): Promise<{ thoughts: SequentialThought[], reviewResult: string }> {
    try {
      // Generate the system prompt with changes context for domain scope
      const systemPrompt = this.generateSystemPrompt(changes);

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
   * Generate the system prompt for the LLM based on review mode
   */
  private generateSystemPrompt(changes?: MergeRequestChange[]): string {
    return this.generateSystemPromptByMode(REVIEW_MODE, changes);
  }

  /**
   * Generate system prompt based on review mode
   */
  private generateSystemPromptByMode(mode: string, changes?: MergeRequestChange[]): string {
    // Determine if diff-only scope should be used
    const useDiffOnly = changes ? this.shouldUseDiffOnlyScope(changes) : false;

    const baseContext = `Anda adalah seorang Insinyur Perangkat Lunak Senior dengan keahlian mendalam dalam pengembangan antarmuka pengguna (frontend), khususnya dengan Nuxt.js dan Flutter. Peran Anda dalam code review ini adalah sebagai seorang Arsitek Teknis yang memastikan kualitas, skalabilitas, maintenabilitas, dan performa kode.

**Konteks Teknologi Spesifik (PENTING):**
* **Nuxt.js:** Pahami bahwa pengembangan Nuxt.js dalam proyek ini **wajib mengikuti dokumentasi resmi Nuxt.js**. Penyimpangan dari praktik standar Nuxt harus memiliki justifikasi yang kuat.
* **Flutter:** Untuk kode Flutter, fokus pada arsitektur state management yang digunakan (BLoC), efisiensi widget tree, platform-specific considerations, dan adherence terhadap panduan gaya Dart dan Flutter.
* **Struktur Proyek Saat Ini:** **Sangat penting** untuk selalu merujuk dan **mengikuti struktur proyek yang sudah ada (existing project structure)**. Perubahan kode harus konsisten dengan pola, arsitektur, dan konvensi yang telah ditetapkan dalam proyek ini.
${this.getDomainScopeInstructions(useDiffOnly)}

**Prinsip Review:**
${REVIEW_CONSERVATIVE_MODE ?
  '* **Mode Konservatif Aktif**: Hindari menyarankan perubahan struktural besar. Fokus pada perbaikan bug, keamanan, dan optimasi minor yang tidak mengubah arsitektur existing.' :
  '* **Mode Standar**: Berikan saran perbaikan yang seimbang antara kualitas kode dan konsistensi dengan struktur existing.'
}
* **Batasan Saran**: Maksimal ${REVIEW_MAX_SUGGESTIONS} saran utama. Prioritaskan yang paling penting.
* **Fokus Area**: ${FOCUS_AREAS.join(', ')}
${this.getCriticalIssueThresholdDefinition()}

**Format Isu Kritis (🔴):**
Untuk setiap isu kritis, berikan solusi praktis dengan format:
🔴 [Deskripsi masalah]
**Masalah:** [Penjelasan singkat mengapa ini bermasalah]
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
[kode bermasalah]

// After (diperbaiki)
[kode solusi]
\`\`\`
**Cara implementasi:** [Panduan 1-2 kalimat cara menerapkan perbaikan]

**Pedoman Contoh Solusi:**
* Batasi contoh kode maksimal 5 baris
* Gunakan bahasa pemrograman yang sesuai (TypeScript, Vue untuk Nuxt.js, Dart untuk Flutter)
* Fokus pada solusi praktis yang dapat langsung diterapkan
* Berikan contoh hanya untuk isu kritis (🔴), bukan untuk saran penting (🟡) atau opsional (🔵)`;

    switch (mode.toLowerCase()) {
      case 'quick':
        return this.generateQuickModePrompt(baseContext);
      case 'detailed':
        return this.generateDetailedModePrompt(baseContext);
      default: // 'standard'
        return this.generateStandardModePrompt(baseContext);
    }
  }

  /**
   * Generate quick mode prompt - focus only on critical issues
   */
  private generateQuickModePrompt(baseContext: string): string {
    return `${baseContext}

**Mode Review: QUICK (Fokus pada isu kritis saja)**

**Tujuan**: Identifikasi hanya masalah kritis yang harus diperbaiki sebelum merge.

**Fokus Utama** (hanya analisis yang paling penting):
1. **Security Vulnerabilities**: Kerentanan yang dapat menyebabkan data breach atau akses tidak sah
2. **System-Breaking Bugs**: Bug yang menyebabkan aplikasi crash atau tidak dapat berfungsi
3. **Data Loss/Corruption**: Risiko kehilangan atau korupsi data yang signifikan
4. **Critical System Instability**: Memory leaks atau resource exhaustion yang dapat crash sistem

**Yang TIDAK perlu dianalisis dalam mode quick**:
- Code style dan formatting minor
- Logic errors yang tidak menyebabkan crash
- Performance optimizations yang tidak kritis
- Refactoring suggestions
- Documentation improvements
- Minor input validation issues
- Non-breaking API changes

**Format Output (RINGKAS)**:
---
## Review Kode (Quick Mode)

**Ringkasan**: [1-2 kalimat tentang perubahan dan assessment umum]

**Isu Kritis** (jika ada):
🔴 [Deskripsi masalah]
**Masalah:** [Penjelasan singkat mengapa bermasalah]
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
[kode bermasalah]

// After (diperbaiki)
[kode solusi]
\`\`\`
**Cara implementasi:** [Panduan 1-2 kalimat]

**Kesimpulan**:
* ✅ **Siap merge** - Tidak ada isu kritis ditemukan
* ⚠️ **Perlu perbaikan** - Ada [X] isu kritis yang harus diperbaiki dulu

Gunakan Bahasa Indonesia yang ringkas dan langsung to the point. Berikan contoh solusi hanya untuk isu kritis yang benar-benar mengancam stabilitas sistem.`;
  }

  /**
   * Generate standard mode prompt - balanced approach
   */
  private generateStandardModePrompt(baseContext: string): string {
    return `${baseContext}

**Mode Review: STANDARD (Pendekatan seimbang)**

**Tujuan**: Review komprehensif namun tetap fokus dan actionable.

**Aspek yang dianalisis**:
1. **Kualitas Kode**: Readability, naming, structure (ringkas)
2. **Logic & Functionality**: Correctness, edge cases (ringkas)
3. **Bugs & Performance**: Potensi masalah dan optimasi (detail)
4. **Konsistensi**: Alignment dengan existing codebase (ringkas)
5. **Security**: Vulnerability assessment jika relevan

**Format Output**:
---
## Review Kode

**Ringkasan**: [2-3 kalimat tentang scope perubahan dan kesan umum]

**Temuan Utama**:

**🔴 Kritis** (harus diperbaiki):
🔴 [Deskripsi masalah]
**Masalah:** [Penjelasan singkat mengapa bermasalah]
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
[kode bermasalah]

// After (diperbaiki)
[kode solusi]
\`\`\`
**Cara implementasi:** [Panduan 1-2 kalimat]

**🟡 Penting** (sangat disarankan):
• [Improvement penting dengan reasoning - tanpa contoh kode]

**🔵 Opsional** (nice to have):
• [Saran tambahan jika ada - tanpa contoh kode]

**Konsistensi dengan Existing Code**: [Assessment singkat]

**Kesimpulan**:
[Pilih: ✅ Siap merge / ⚠️ Perlu perbaikan minor / ❌ Perlu perbaikan signifikan]

Berikan feedback yang konstruktif, spesifik, dan dapat ditindaklanjuti. Maksimal ${REVIEW_MAX_SUGGESTIONS} poin utama. Contoh solusi hanya untuk isu kritis (🔴).`;
  }

  /**
   * Generate detailed mode prompt - comprehensive analysis
   */
  private generateDetailedModePrompt(baseContext: string): string {
    return `${baseContext}

**Mode Review: DETAILED (Analisis komprehensif)**

**Tujuan**: Review mendalam dengan analisis detail di semua aspek.

**Aspek yang dianalisis secara detail**:
1. **Kualitas Kode & Kejelasan**: Readability, naming, comments, structure
2. **Alur Logika & Fungsionalitas**: Correctness, edge cases, error handling
3. **Konsistensi & Arsitektur**: Alignment dengan existing patterns dan best practices
4. **Potensi Bug & Performa**: Detailed analysis dengan contoh konkret
5. **Keamanan**: Security assessment dan vulnerability check
6. **Maintainability**: Long-term code health dan scalability

**Format Output**:
---
## Review Kode (Detailed Analysis)

**Ringkasan**: [Comprehensive overview of changes and general assessment]

---

**Analisis Detail**:

**Kualitas Kode & Kejelasan**:
• [Detailed assessment of code quality]

**Alur Logika & Fungsionalitas**:
• [Logic flow and functionality analysis]

**Konsistensi & Arsitektur**:
• [Architecture and pattern consistency check]

**Keselarasan dengan Requirement** (jika ada konteks Notion):
• [Requirement verification]

**Potensi Bug & Performa** (ANALISIS MENDALAM):
🔴 [Deskripsi masalah kritis]
**Masalah:** [Penjelasan detail mengapa bermasalah]
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
[kode bermasalah dengan konteks]

// After (diperbaiki)
[kode solusi dengan penjelasan]
\`\`\`
**Cara implementasi:** [Panduan detail 1-2 kalimat]

---

**Feedback Tambahan & Saran**:
• [Comprehensive suggestions for improvement - tanpa contoh kode untuk non-kritis]

---

**Kesimpulan**: [Detailed conclusion with specific recommendations]

Berikan analisis yang mendalam namun tetap actionable. Gunakan contoh konkret dan solusi spesifik untuk isu kritis (🔴) saja.`;
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

      // Use structured content if available, otherwise fall back to legacy formatting
      if (context.structuredContent && context.structuredContent.hasStructuredContent) {
        // Format structured content using the new service method
        const structuredFormatted = this.formatStructuredNotionContent(context.structuredContent);
        formatted += structuredFormatted;
      } else {
        // Legacy formatting for backward compatibility
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
      }

      formatted += `Notion URL: ${context.url}\n\n`;
    });

    if (notionContext.errors.length > 0) {
      formatted += `**Catatan:** Beberapa tugas tidak dapat diakses (${notionContext.errors.length} error).\n`;
    }

    return formatted;
  }

  /**
   * Format structured Notion content for review prompts
   */
  private formatStructuredNotionContent(structuredContent: any): string {
    let formatted = '';

    // User Story
    if (structuredContent.userStory) {
      formatted += `**User Story:** ${structuredContent.userStory.summary}\n`;
      if (structuredContent.userStory.description !== structuredContent.userStory.summary) {
        formatted += `Detail: ${structuredContent.userStory.description.substring(0, 200)}${structuredContent.userStory.description.length > 200 ? '...' : ''}\n`;
      }
    }

    // Acceptance Criteria with progress
    if (structuredContent.acceptanceCriteria) {
      const { items, totalItems, completedItems } = structuredContent.acceptanceCriteria;
      formatted += `**Acceptance Criteria** (${completedItems}/${totalItems} selesai):\n`;

      items.slice(0, 10).forEach((item: any, index: number) => { // Limit to first 10 items
        const status = item.completed ? '✅' : '⏳';
        const priority = item.priority ? ` [${item.priority.toUpperCase()}]` : '';
        formatted += `${index + 1}. ${status} ${item.text}${priority}\n`;

        // Add nested items (limit to 3 per main item)
        item.nested.slice(0, 3).forEach((nested: any, nestedIndex: number) => {
          const nestedStatus = nested.completed ? '✅' : '⏳';
          const nestedPriority = nested.priority ? ` [${nested.priority.toUpperCase()}]` : '';
          formatted += `   ${nestedIndex + 1}.${index + 1}. ${nestedStatus} ${nested.text}${nestedPriority}\n`;
        });
      });

      if (items.length > 10) {
        formatted += `... dan ${items.length - 10} kriteria lainnya\n`;
      }
    }

    // Screenshots and assets
    if (structuredContent.screenshots && structuredContent.screenshots.totalImages > 0) {
      formatted += `**Screenshots/Assets:** ${structuredContent.screenshots.totalImages} item(s)\n`;
      structuredContent.screenshots.images.slice(0, 3).forEach((image: any, index: number) => {
        formatted += `${index + 1}. ${image.type.toUpperCase()}`;
        if (image.caption) {
          formatted += `: ${image.caption}`;
        }
        formatted += '\n';
      });
      if (structuredContent.screenshots.images.length > 3) {
        formatted += `... dan ${structuredContent.screenshots.images.length - 3} asset lainnya\n`;
      }
    }

    // Todo List with progress
    if (structuredContent.todoList) {
      const { items, totalItems, completedItems, pendingItems } = structuredContent.todoList;
      formatted += `**To-do List** (${completedItems}/${totalItems} selesai, ${pendingItems} pending):\n`;

      items.slice(0, 8).forEach((item: any, index: number) => { // Limit to first 8 items
        const status = item.completed ? '✅' : '⏳';
        const priority = item.priority ? ` [${item.priority.toUpperCase()}]` : '';
        const assignee = item.assignee ? ` (@${item.assignee})` : '';
        formatted += `${index + 1}. ${status} ${item.text}${priority}${assignee}\n`;
      });

      if (items.length > 8) {
        formatted += `... dan ${items.length - 8} tugas lainnya\n`;
      }
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
  private generateSequentialThinkingSystemPrompt(changes?: MergeRequestChange[]): string {
    // Determine if diff-only scope should be used
    const useDiffOnly = changes ? this.shouldUseDiffOnlyScope(changes) : false;

    return `Anda adalah seorang Insinyur Perangkat Lunak Senior dengan keahlian mendalam dalam pengembangan antarmuka pengguna (frontend), khususnya dengan Nuxt.js dan Flutter. Anda akan melakukan code review menggunakan pendekatan sequential thinking yang terstruktur.

**Peran Anda:**
- Arsitek Teknis yang memastikan kualitas, skalabilitas, maintenabilitas, dan performa kode
- Reviewer yang memberikan analisis mendalam melalui tahapan berpikir yang sistematis
- Mentor yang memberikan panduan teknis konstruktif dalam Bahasa Indonesia
${this.getDomainScopeInstructions(useDiffOnly)}

**Mode Review Saat Ini: ${REVIEW_MODE.toUpperCase()}**
${REVIEW_CONSERVATIVE_MODE ?
  '**Mode Konservatif Aktif**: Hindari menyarankan perubahan struktural besar. Fokus pada perbaikan bug, keamanan, dan optimasi minor.' :
  '**Mode Standar**: Berikan saran perbaikan yang seimbang antara kualitas kode dan konsistensi dengan struktur existing.'
}

**Batasan Review:**
- Maksimal ${REVIEW_MAX_SUGGESTIONS} saran utama per tahap
- Fokus area: ${FOCUS_AREAS.join(', ')}
- Prioritaskan isu berdasarkan severity dan impact
${this.getCriticalIssueThresholdDefinition()}

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
- Berikan output yang ringkas dan actionable sesuai mode review

**Format Isu Kritis dalam Sequential Thinking:**
Ketika mengidentifikasi isu kritis (🔴), gunakan format:
🔴 [Deskripsi masalah]
**Masalah:** [Penjelasan mengapa bermasalah]
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
[kode bermasalah]

// After (diperbaiki)
[kode solusi]
\`\`\`
**Cara implementasi:** [Panduan 1-2 kalimat]

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

Berdasarkan pemahaman dari tahap 1 dan 2, sekarang fokus pada identifikasi potensi bug dan masalah keamanan yang benar-benar kritis.

**Analisis sebelumnya:**
**Tahap 1:** ${step1Analysis}

**Tahap 2:** ${step2Analysis}

**Tugas Anda pada tahap ini:**
1. Identifikasi bug yang dapat menyebabkan aplikasi crash atau tidak dapat berfungsi
2. Analisis keamanan kritis (vulnerability yang dapat menyebabkan data breach atau unauthorized access)
3. Periksa risiko kehilangan atau korupsi data
4. Evaluasi memory leaks atau resource exhaustion yang dapat crash sistem
5. Identifikasi masalah yang dapat mencegah deployment berhasil

**Fokus analisis (HANYA yang benar-benar kritis):**
- Security vulnerabilities yang dapat dieksploitasi (SQL injection, XSS exploitable, authentication bypass)
- System-breaking bugs yang menyebabkan crash total
- Data loss atau corruption risks
- Memory leaks atau resource exhaustion yang dapat crash sistem
- Critical system instability issues

**JANGAN fokus pada:**
- Logic errors minor yang tidak menyebabkan crash
- Input validation biasa yang tidak berdampak keamanan kritis
- Performance issues yang tidak menyebabkan ketidakstabilan sistem
- Missing error handling untuk operasi non-kritis
- Code quality concerns

**Output yang diharapkan:**
Berikan analisis detail yang mencakup:
- Daftar HANYA bug dan masalah keamanan yang benar-benar kritis
- Identifikasi masalah yang dapat menyebabkan system failure atau data breach
- Rekomendasi untuk memperbaiki masalah yang mengancam stabilitas sistem
- Prioritas berdasarkan severity dan dampak terhadap sistem secara keseluruhan

Ingat: Hanya tandai sebagai kritis jika benar-benar mengancam stabilitas sistem atau keamanan data.`;
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

**Mode Review: ${REVIEW_MODE.toUpperCase()}**
**Batasan**: Maksimal ${REVIEW_MAX_SUGGESTIONS} saran utama, prioritaskan berdasarkan severity.

**Semua analisis sebelumnya:**
${previousAnalyses}

**Tugas Anda pada tahap ini:**
1. Sintesis semua temuan dari tahap sebelumnya
2. Prioritaskan issues berdasarkan severity dan impact
3. Berikan rekomendasi final yang actionable
4. Tentukan apakah MR siap untuk di-merge atau perlu perbaikan
5. Format output sesuai template review mode yang aktif

**Output yang diharapkan:**
${this.getFinalStepFormatByMode(REVIEW_MODE)}

Pastikan kesimpulan selaras dengan semua analisis sebelumnya dan batasan review yang ditetapkan.`;
  }

  /**
   * Get the final step format based on review mode
   */
  private getFinalStepFormatByMode(mode: string): string {
    switch (mode.toLowerCase()) {
      case 'quick':
        return `Format untuk Quick Mode:
---
## Review Kode (Quick Mode)

**Ringkasan**: [1-2 kalimat tentang perubahan dan assessment umum]

**Isu Kritis** (jika ada):
🔴 [Deskripsi masalah]
**Masalah:** [Penjelasan singkat mengapa bermasalah]
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
[kode bermasalah]

// After (diperbaiki)
[kode solusi]
\`\`\`
**Cara implementasi:** [Panduan 1-2 kalimat]

**Kesimpulan**:
* ✅ **Siap merge** - Tidak ada isu kritis ditemukan
* ⚠️ **Perlu perbaikan** - Ada [X] isu kritis yang harus diperbaiki dulu

Gunakan Bahasa Indonesia yang ringkas dan langsung to the point. Maksimal ${REVIEW_MAX_SUGGESTIONS} isu kritis dengan contoh solusi.`;

      case 'detailed':
        return `Format untuk Detailed Mode:
---
## Review Kode (Detailed Analysis)

**Ringkasan**: [Comprehensive overview of changes and general assessment]

---

**Analisis Detail:**

**Kualitas Kode & Kejelasan**:
• [Detailed assessment of code quality]

**Alur Logika & Fungsionalitas**:
• [Logic flow and functionality analysis]

**Konsistensi & Arsitektur**:
• [Architecture and pattern consistency check]

**Keselarasan dengan Requirement** (jika ada konteks Notion):
• [Requirement verification]

**Potensi Bug & Performa** (ANALISIS MENDALAM):
🔴 [Deskripsi masalah kritis]
**Masalah:** [Penjelasan detail mengapa bermasalah]
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
[kode bermasalah dengan konteks]

// After (diperbaiki)
[kode solusi dengan penjelasan]
\`\`\`
**Cara implementasi:** [Panduan detail 1-2 kalimat]

---

**Feedback Tambahan & Saran**:
• [Comprehensive suggestions for improvement - tanpa contoh kode untuk non-kritis]

---

**Kesimpulan**: [Detailed conclusion with specific recommendations]

Maksimal ${REVIEW_MAX_SUGGESTIONS} item utama. Contoh solusi hanya untuk isu kritis (🔴).`;

      default: // 'standard'
        return `Format untuk Standard Mode:
---
## Review Kode

**Ringkasan**: [2-3 kalimat tentang scope perubahan dan kesan umum]

**Temuan Utama**:

**🔴 Kritis** (harus diperbaiki):
🔴 [Deskripsi masalah]
**Masalah:** [Penjelasan singkat mengapa bermasalah]
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
[kode bermasalah]

// After (diperbaiki)
[kode solusi]
\`\`\`
**Cara implementasi:** [Panduan 1-2 kalimat]

**🟡 Penting** (sangat disarankan):
• [Improvement penting dengan reasoning - tanpa contoh kode]

**🔵 Opsional** (nice to have):
• [Saran tambahan jika ada - tanpa contoh kode]

**Konsistensi dengan Existing Code**: [Assessment singkat]

**Kesimpulan**:
[Pilih: ✅ Siap merge / ⚠️ Perlu perbaikan minor / ❌ Perlu perbaikan signifikan]

Total maksimal ${REVIEW_MAX_SUGGESTIONS} poin utama di semua kategori. Contoh solusi hanya untuk isu kritis (🔴).`;
    }
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

      // Log domain scope decision
      const useDiffOnly = this.shouldUseDiffOnlyScope(changes);
      console.log(`🎯 Domain Scope Decision: ${useDiffOnly ? 'DIFF-ONLY' : 'FULL-CONTEXT'} (Config: ${REVIEW_DOMAIN_SCOPE}, Files: ${changes.length}, Lines: ${changes.reduce((sum, change) => sum + change.diffContent.split('\n').filter(line => line.startsWith('+') || line.startsWith('-')).length, 0)})`);

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
        notionContext,
        changes
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
   * Primary logic: Approve if NO critical issues are found, regardless of review mode
   */
  private shouldApproveMergeRequest(reviewResult: string): boolean {
    console.log('🔍 Analyzing review result for auto-approval decision...');

    // Primary approval logic: Check for critical issues based on review mode
    const hasCriticalIssues = this.hasCriticalIssues(reviewResult);

    if (hasCriticalIssues) {
      console.log('❌ Auto-approval denied: Critical issues found in review');
      return false;
    }

    // Check for explicit approval/rejection conclusions
    const conclusionApproval = this.checkConclusionApproval(reviewResult);

    if (conclusionApproval !== null) {
      console.log(`📋 Conclusion-based decision: ${conclusionApproval ? 'Approve' : 'Reject'}`);
      return conclusionApproval;
    }

    // Fallback: Check for traditional Indonesian approval phrases
    const phraseApproval = this.checkTraditionalApprovalPhrases(reviewResult);

    if (phraseApproval) {
      console.log('✅ Auto-approval granted: Traditional approval phrases found');
      return true;
    }

    // Default: If no critical issues and no explicit rejection, approve
    console.log('✅ Auto-approval granted: No critical issues detected');
    return true;
  }

  /**
   * Check if the review contains critical issues based on the review mode format
   * Uses a unified approach that works across all review modes
   */
  private hasCriticalIssues(reviewResult: string): boolean {
    console.log('🔍 Checking for critical issues in review result...');

    // Method 1: Direct emoji detection (most reliable for all modes)
    const emojiBasedDetection = this.detectCriticalIssuesByEmoji(reviewResult);
    if (emojiBasedDetection !== null) {
      console.log(`📊 Emoji-based detection result: ${emojiBasedDetection}`);
      return emojiBasedDetection;
    }

    // Method 2: Section-based detection (fallback for edge cases)
    const sectionBasedDetection = this.detectCriticalIssuesBySection(reviewResult);
    console.log(`📋 Section-based detection result: ${sectionBasedDetection}`);
    return sectionBasedDetection;
  }

  /**
   * Detect critical issues by looking for 🔴 emoji directly
   * This is the most reliable method that works across all review modes
   * Enhanced with threshold-based validation
   */
  private detectCriticalIssuesByEmoji(reviewResult: string): boolean | null {
    if (!reviewResult.includes('🔴')) {
      return false;
    }

    console.log('🔴 Found red circle emoji, validating critical issue content...');

    // Find lines with 🔴 and validate they contain actual issues
    const criticalLines = reviewResult.split('\n').filter(line => line.includes('🔴'));

    const hasRealIssues = criticalLines.some(line => {
      const content = line.replace('🔴', '').trim();

      // Check for template placeholders or empty content
      const isTemplate = content === '[Deskripsi masalah]' ||
                        content === '' ||
                        content.toLowerCase().includes('tidak ada') ||
                        content.toLowerCase().includes('none') ||
                        content.toLowerCase().includes('template') ||
                        content.length < 5;

      if (isTemplate) {
        return false;
      }

      // Apply threshold-based validation
      const isValidCriticalIssue = this.validateCriticalIssueByThreshold(content);

      if (isValidCriticalIssue) {
        console.log(`✅ Found valid critical issue (${CRITICAL_ISSUE_THRESHOLD} threshold): ${content.substring(0, 50)}...`);
        return true;
      } else {
        console.log(`⚠️ Issue found but not critical under ${CRITICAL_ISSUE_THRESHOLD} threshold: ${content.substring(0, 50)}...`);
        return false;
      }
    });

    return hasRealIssues;
  }

  /**
   * Validate if an issue qualifies as critical based on the configured threshold
   */
  private validateCriticalIssueByThreshold(issueContent: string): boolean {
    const lowerContent = issueContent.toLowerCase();

    switch (CRITICAL_ISSUE_THRESHOLD.toLowerCase()) {
      case 'strict':
        // Only the most severe issues: security vulnerabilities, data loss, system crashes, memory exhaustion
        return (lowerContent.includes('security') && (lowerContent.includes('vulnerability') || lowerContent.includes('breach') || lowerContent.includes('unauthorized access'))) ||
               lowerContent.includes('sql injection') ||
               lowerContent.includes('xss') && lowerContent.includes('exploitable') ||
               lowerContent.includes('authentication bypass') ||
               lowerContent.includes('data exposure') ||
               (lowerContent.includes('data') && (lowerContent.includes('loss') || lowerContent.includes('corruption'))) ||
               (lowerContent.includes('crash') && (lowerContent.includes('aplikasi') || lowerContent.includes('system') || lowerContent.includes('total'))) ||
               lowerContent.includes('memory leak') ||
               lowerContent.includes('resource exhaustion') ||
               lowerContent.includes('tidak dapat dijalankan sama sekali') ||
               lowerContent.includes('sistem tidak dapat berfungsi');

      case 'lenient':
        // Only the most critical system-breaking issues
        return (lowerContent.includes('security') && lowerContent.includes('critical') && (lowerContent.includes('vulnerability') || lowerContent.includes('breach'))) ||
               (lowerContent.includes('system') && lowerContent.includes('failure') && lowerContent.includes('complete')) ||
               (lowerContent.includes('data') && lowerContent.includes('loss') && lowerContent.includes('permanent')) ||
               (lowerContent.includes('deployment') && lowerContent.includes('blocker')) ||
               lowerContent.includes('tidak dapat berfungsi sama sekali') ||
               lowerContent.includes('gagal deploy secara total');

      default: // 'standard'
        // More restrictive than before - only genuine severe issues
        return (lowerContent.includes('security') && (lowerContent.includes('vulnerability') || lowerContent.includes('breach'))) ||
               (lowerContent.includes('crash') && !lowerContent.includes('minor')) ||
               (lowerContent.includes('data') && (lowerContent.includes('corruption') || lowerContent.includes('loss'))) ||
               lowerContent.includes('memory leak') ||
               lowerContent.includes('resource exhaustion') ||
               (lowerContent.includes('breaking') && lowerContent.includes('major')) ||
               lowerContent.includes('system instability');
    }
  }

  /**
   * Detect critical issues by looking for section headers (fallback method)
   * Improved to handle case variations and better content validation
   */
  private detectCriticalIssuesBySection(reviewResult: string): boolean {
    console.log('📝 Attempting section-based critical issue detection...');

    // Improved section detection with case-insensitive and flexible matching
    // This pattern handles variations like "Isu Kritis", "isu kritis", "Isu Kritis (jika ada)", etc.
    const sectionPattern = /\*\*\s*isu\s+kritis\s*\*\*[^:]*:(.*?)(?=\n\*\*(?!\s*(?:masalah|cara\s+implementasi))|$)/gis;
    const matches = reviewResult.match(sectionPattern);

    if (!matches) {
      console.log('❌ No critical issue sections found');
      return false;
    }

    console.log(`📋 Found ${matches.length} potential critical issue section(s)`);

    return matches.some(match => {
      // Extract content after the section header
      const content = match.replace(/\*\*\s*isu\s+kritis\s*\*\*[^:]*/i, '').replace(':', '').trim();

      // Validate that the content contains actual critical issues
      const hasSubstantialContent = content.length > 10 &&
                                   !content.toLowerCase().includes('tidak ada') &&
                                   !content.toLowerCase().includes('none');

      const hasIssueIndicators = content.includes('🔴') ||
                                content.toLowerCase().includes('masalah') ||
                                content.toLowerCase().includes('bug') ||
                                content.toLowerCase().includes('error') ||
                                content.toLowerCase().includes('diperbaiki');

      const isValid = hasSubstantialContent && hasIssueIndicators;

      if (isValid) {
        console.log(`✅ Found valid critical issue in section: ${content.substring(0, 100)}...`);
      }

      return isValid;
    });
  }

  /**
   * Check for explicit approval/rejection conclusions in the review
   */
  private checkConclusionApproval(reviewResult: string): boolean | null {
    // Check for explicit rejection conclusions
    const rejectionIndicators = [
      '❌ Perlu perbaikan signifikan',
      '❌ **Perlu perbaikan signifikan**',
      'Ada beberapa isu signifikan',
      'perlu ditangani sebelum kode ini dapat di-merge',
      'tidak dapat di-merge',
      'tidak bisa di-merge'
    ];

    for (const indicator of rejectionIndicators) {
      if (reviewResult.includes(indicator)) {
        return false;
      }
    }

    // Check for explicit approval conclusions
    const approvalIndicators = [
      '✅ Siap merge',
      '✅ **Siap merge**',
      'Siap merge',
      '⚠️ Perlu perbaikan minor',
      '⚠️ **Perlu perbaikan minor**',
      'Kode ini sudah baik',
      'dapat di-merge',
      'bisa di-merge',
      'siap untuk di-merge',
      'layak untuk di-merge'
    ];

    for (const indicator of approvalIndicators) {
      if (reviewResult.includes(indicator)) {
        return true;
      }
    }

    return null; // No explicit conclusion found
  }

  /**
   * Check for traditional Indonesian approval phrases (fallback method)
   */
  private checkTraditionalApprovalPhrases(reviewResult: string): boolean {
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

      // Track analytics for review completion
      try {
        const changes = await gitlabService.getMergeRequestChanges(projectId, mergeRequestIid);
        const reviewStartTime = new Date(mergeRequest.created_at);
        const reviewEndTime = new Date();
        const reviewTimeHours = (reviewEndTime.getTime() - reviewStartTime.getTime()) / (1000 * 60 * 60);

        // Count critical issues in review result
        const criticalIssuesCount = (reviewResult.reviewText.match(/🔴/g) || []).length;

        // Calculate basic metrics from changes
        const linesAdded = changes.reduce((sum, change) => {
          const addedLines = change.diffContent.split('\n').filter(line => line.startsWith('+')).length;
          return sum + addedLines;
        }, 0);

        const linesRemoved = changes.reduce((sum, change) => {
          const removedLines = change.diffContent.split('\n').filter(line => line.startsWith('-')).length;
          return sum + removedLines;
        }, 0);

        const reviewCompletionData: ReviewCompletionData = {
          projectId,
          mergeRequestIid,
          reviewResult: reviewResult.reviewText,
          shouldApprove: reviewResult.shouldApprove,
          criticalIssuesCount,
          totalReviewComments: 1, // The review comment we just added
          reviewMode: ENABLE_SEQUENTIAL_THINKING ? 'sequential' : 'direct',
          sequentialThinkingUsed: ENABLE_SEQUENTIAL_THINKING,
          hasNotionContext: false, // This would need to be determined from the review process
          linesAdded,
          linesRemoved,
          filesChanged: changes.length,
          reviewTimeHours,
          codeQualityScore: this.calculateCodeQualityScore(criticalIssuesCount, linesAdded + linesRemoved)
        };

        await analyticsService.trackReviewCompleted(reviewCompletionData);
      } catch (analyticsError) {
        console.error('Error tracking review completion analytics:', analyticsError);
        // Don't fail the main process for analytics errors
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
        notionContext,
        newChanges
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

  /**
   * Calculate a basic code quality score based on critical issues and code size
   */
  private calculateCodeQualityScore(criticalIssuesCount: number, totalLinesChanged: number): number {
    if (totalLinesChanged === 0) return 100;

    // Calculate issues per 100 lines of code
    const issuesDensity = (criticalIssuesCount / totalLinesChanged) * 100;

    // Convert to quality score (0-100, where 100 is best)
    const qualityScore = Math.max(0, 100 - (issuesDensity * 20)); // Each issue per 100 lines reduces score by 20

    return Math.round(qualityScore * 100) / 100; // Round to 2 decimal places
  }
}

export const reviewService = new ReviewService();

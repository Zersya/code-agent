import { SequentialThought } from '../types/review.js';
import { ProjectContext } from './context.js';
import dotenv from 'dotenv';

dotenv.config();

// Environment variables
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openrouter';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_API_MODEL = process.env.OPENROUTER_API_MODEL || 'qwen/qwen3-235b-a22b:free';
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
const SEQUENTIAL_THINKING_THOUGHTS_COUNT = parseInt(process.env.SEQUENTIAL_THINKING_THOUGHTS_COUNT || '4', 10);

// Import axios for API calls
import axios from 'axios';

/**
 * Service for sequential thinking process
 * This service uses the LLM to perform a structured thinking process
 * with configurable number of thought steps for code review
 * (default is 4 thoughts, configurable via SEQUENTIAL_THINKING_THOUGHTS_COUNT env variable)
 */
export class SequentialThinkingService {
  private api: any;
  private model: string;

  constructor() {
    if (LLM_PROVIDER === 'openrouter') {
      if (!OPENROUTER_API_KEY) {
        console.warn('OPENROUTER_API_KEY is not set. Sequential thinking will not be available.');
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
   * Perform sequential thinking for code review
   * This method will generate a configurable number of thought steps
   * (default is 4, configurable via SEQUENTIAL_THINKING_THOUGHTS_COUNT env variable)
   * @param codeChanges The code changes to review
   * @param mergeRequestTitle The title of the merge request
   * @param mergeRequestDescription The description of the merge request
   * @param projectContext Optional project context to enhance the review
   * @returns An array of sequential thoughts and the final review
   */
  async reviewCode(
    codeChanges: string,
    mergeRequestTitle: string,
    mergeRequestDescription: string,
    projectContext?: ProjectContext
  ): Promise<{ thoughts: SequentialThought[], reviewResult: string }> {
    const thoughts: SequentialThought[] = [];
    let reviewResult = '';

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

      // Determine the number of thoughts based on code changes sizes, if its too big reduce the number of thoughts
      // if its too small use the configured number of thoughts
      const thoughtsCount = this.determineThoughtCount(codeChanges);

      // Initialize the conversation with the first thought
      let messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      

      // Generate thoughts based on configured count
      for (let i = 1; i <= thoughtsCount; i++) {
        const isLastThought = i === thoughtsCount;

        // Call the LLM API
        const response = await this.callLlmApi(messages);

        // Extract the thought from the response
        const thought = this.extractThought(response, i, isLastThought, thoughtsCount);
        thoughts.push(thought);

        // Add the thought to the conversation
        messages.push({ role: 'assistant', content: response });

        // If this is the last thought, extract the review result
        if (isLastThought) {
          reviewResult = this.extractReviewResult(response);
        } else {
          // Add a prompt for the next thought
          messages.push({
            role: 'user',
            content: `Lanjutkan dengan pemikiran berikutnya (Thought ${i + 1}/${thoughtsCount}). Ingat untuk menganalisis kode lebih dalam dan membangun berdasarkan pemikiran sebelumnya.`
          });
        }

        console.log(`Generated thought ${i}:`, thought.thought);
      }

      return { thoughts, reviewResult };
    } catch (error) {
      console.error('Error in sequential thinking process:', error);
      throw error;
    }
  }


  private determineThoughtCount(codeChanges: string): number {
    // Simple logic: if code changes are too big, reduce the number of thoughts
    // This can be improved with more sophisticated logic, like using embedding distance
    if (codeChanges.length > 500) {
      return Math.max(1, Math.floor(SEQUENTIAL_THINKING_THOUGHTS_COUNT / 2));
    }

    return SEQUENTIAL_THINKING_THOUGHTS_COUNT;
  }

  
  /**
   * Generate the system prompt for the LLM
   */
  private generateSystemPrompt(): string {
    // Generate thought-specific instructions based on the configured number of thoughts
    let thoughtInstructions = '';

    if (SEQUENTIAL_THINKING_THOUGHTS_COUNT >= 1) {
      thoughtInstructions += `Pada pemikiran pertama (Thought 1), ${SEQUENTIAL_THINKING_THOUGHTS_COUNT === 1 ? 'berikan kesimpulan dan rekomendasi final' : ' dan'} lakukan analisis awal dan identifikasi perubahan utama.\n`;
    }

    if (SEQUENTIAL_THINKING_THOUGHTS_COUNT >= 2) {
      thoughtInstructions += `Pada pemikiran kedua (Thought 2), ${SEQUENTIAL_THINKING_THOUGHTS_COUNT === 2 ? 'berikan kesimpulan dan rekomendasi final' : ' dan'} analisis lebih dalam tentang implementasi dan potensi masalah.\n`;
    }

    if (SEQUENTIAL_THINKING_THOUGHTS_COUNT >= 3) {
      thoughtInstructions += `Pada pemikiran ketiga (Thought 3), ${SEQUENTIAL_THINKING_THOUGHTS_COUNT === 3 ? 'berikan kesimpulan dan rekomendasi final' : ' dan'} pertimbangkan konteks proyek yang lebih luas dan dampak perubahan.\n`;
    }

    if (SEQUENTIAL_THINKING_THOUGHTS_COUNT >= 4) {
      thoughtInstructions += `Pada pemikiran keempat (Thought 4), ${SEQUENTIAL_THINKING_THOUGHTS_COUNT === 4 ? 'berikan kesimpulan dan rekomendasi final' : ' dan'} lanjutkan analisis dengan lebih mendalam\n`;
    }

    // For any additional thoughts beyond 4
    if (SEQUENTIAL_THINKING_THOUGHTS_COUNT > 4) {
      for (let i = 5; i < SEQUENTIAL_THINKING_THOUGHTS_COUNT; i++) {
        thoughtInstructions += `Pada pemikiran ke-${i} (Thought ${i}), lanjutkan analisis dengan lebih mendalam dan pertimbangkan aspek lain dari kode.\n`;
      }

      // Last thought instruction
      thoughtInstructions += `Pada pemikiran terakhir (Thought ${SEQUENTIAL_THINKING_THOUGHTS_COUNT}), berikan kesimpulan dan rekomendasi final, termasuk apakah kode memenuhi standar kualitas untuk disetujui.\n`;
    }

    return `Kamu adalah senior software engineer yang bertanggung jawab untuk review kode yang menggunakan proses pemikiran sekuensial untuk menganalisis kode.
Kamu akan melakukan analisis kode dalam ${SEQUENTIAL_THINKING_THOUGHTS_COUNT} langkah pemikiran yang terstruktur, di mana setiap pemikiran membangun dari pemikiran sebelumnya, 
jangan pernah memberikan angka langkah pemikiran pada saat memberi kesimpulan dan rekomendasi final.

Untuk setiap langkah pemikiran:
1. Analisis kode dengan cermat dan teliti
2. Fokus pada kualitas kode, alur logika, kejelasan, dan potensi bug
3. Berikan wawasan yang semakin mendalam pada setiap langkah
4. Gunakan Bahasa Indonesia yang formal dan profesional
5. Jika konteks proyek disediakan, gunakan untuk memahami kode lebih baik

${thoughtInstructions}
Jika konteks proyek disediakan, gunakan untuk:
- Memahami struktur dan arsitektur proyek
- Mengidentifikasi pola dan konvensi yang digunakan dalam proyek
- Mengevaluasi apakah perubahan konsisten dengan kode yang ada
- Mendeteksi potensi konflik atau masalah integrasi

Setelah ${SEQUENTIAL_THINKING_THOUGHTS_COUNT} langkah pemikiran, berikan hasil review final dalam format berikut:

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

    prompt += `\n\nMulai dengan Pemikiran 1 untuk menganalisis perubahan kode ini:

\`\`\`diff
${codeChanges}
\`\`\`

Lakukan analisis kode secara bertahap dengan ${SEQUENTIAL_THINKING_THOUGHTS_COUNT} langkah pemikiran, di mana setiap pemikiran membangun dari pemikiran sebelumnya.
Jika ada hitungan pada Feedback atau Hasil Review, ingat untuk tidak melakukan hitungan berlanjut pada setiap pemikiran.`;

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
   * Extract the thought from the LLM response
   */
  private extractThought(response: string, thoughtNumber: number, isLastThought: boolean, thoughtsCount: number): SequentialThought {
    return {
      thought: response,
      thoughtNumber,
      totalThoughts: thoughtsCount,
      nextThoughtNeeded: !isLastThought,
    };
  }

  /**
   * Extract the review result from the last thought
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
}

export const sequentialThinkingService = new SequentialThinkingService();

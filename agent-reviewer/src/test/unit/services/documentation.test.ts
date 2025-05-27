import { describe, it, expect, beforeEach, vi } from 'vitest';
import { documentationService } from '../../../services/documentation.js';
import { MergeRequestChange } from '../../../types/review.js';

// Mock dependencies
vi.mock('../../../services/database.js', () => ({
  dbService: {
    saveDocumentationSource: vi.fn(),
    getDocumentationSource: vi.fn(),
    getDocumentationSourcesByFrameworks: vi.fn(),
    updateDocumentationSourceStatus: vi.fn(),
    deleteDocumentationSource: vi.fn(),
    deleteDocumentationEmbeddings: vi.fn(),
    deleteProjectDocumentationMappings: vi.fn(),
    saveProjectDocumentationMapping: vi.fn(),
    getProjectDocumentationMapping: vi.fn(),
    saveDocumentationEmbeddings: vi.fn(),
  }
}));

vi.mock('../../../services/embedding.js', () => ({
  embeddingService: {
    generateEmbedding: vi.fn()
  }
}));

vi.mock('../../../services/queue.js', () => ({
  queueService: {
    addDocumentationJob: vi.fn()
  }
}));

describe('DocumentationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectFrameworks', () => {
    it('should detect Nuxt framework from .vue files', () => {
      const changes: MergeRequestChange[] = [
        {
          newPath: 'components/Button.vue',
          oldPath: 'components/Button.vue',
          newContent: '<template><button>Click me</button></template>',
          oldContent: '',
          diff: ''
        }
      ];

      const result = documentationService.detectFrameworks(changes);

      expect(result.frameworks).toContain('vue');
      expect(result.frameworks).toContain('nuxt');
      expect(result.detectedFrom).toContain('fileExtensions');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect React framework from .tsx files', () => {
      const changes: MergeRequestChange[] = [
        {
          newPath: 'components/Button.tsx',
          oldPath: 'components/Button.tsx',
          newContent: 'import React from "react"; export const Button = () => <button>Click</button>;',
          oldContent: '',
          diff: ''
        }
      ];

      const result = documentationService.detectFrameworks(changes);

      expect(result.frameworks).toContain('react');
      expect(result.detectedFrom).toContain('fileExtensions');
      expect(result.detectedFrom).toContain('imports');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Nuxt from imports and content', () => {
      const changes: MergeRequestChange[] = [
        {
          newPath: 'pages/index.ts',
          oldPath: 'pages/index.ts',
          newContent: 'import { useNuxtApp } from "#app"; const nuxtApp = useNuxtApp();',
          oldContent: '',
          diff: ''
        }
      ];

      const result = documentationService.detectFrameworks(changes);

      expect(result.frameworks).toContain('nuxt');
      expect(result.detectedFrom).toContain('imports');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Vue from composition API patterns', () => {
      const changes: MergeRequestChange[] = [
        {
          newPath: 'composables/useCounter.ts',
          oldPath: 'composables/useCounter.ts',
          newContent: 'import { ref } from "vue"; export const useCounter = () => { const count = ref(0); return { count }; };',
          oldContent: '',
          diff: ''
        }
      ];

      const result = documentationService.detectFrameworks(changes);

      expect(result.frameworks).toContain('vue');
      expect(result.detectedFrom).toContain('imports');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect frameworks from config files', () => {
      const changes: MergeRequestChange[] = [
        {
          newPath: 'nuxt.config.ts',
          oldPath: 'nuxt.config.ts',
          newContent: 'export default defineNuxtConfig({ modules: [] });',
          oldContent: '',
          diff: ''
        }
      ];

      const result = documentationService.detectFrameworks(changes);

      expect(result.frameworks).toContain('nuxt');
      expect(result.detectedFrom).toContain('config');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return empty frameworks for non-framework files', () => {
      const changes: MergeRequestChange[] = [
        {
          newPath: 'README.md',
          oldPath: 'README.md',
          newContent: '# My Project\n\nThis is a readme file.',
          oldContent: '',
          diff: ''
        }
      ];

      const result = documentationService.detectFrameworks(changes);

      expect(result.frameworks).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle multiple frameworks in the same changeset', () => {
      const changes: MergeRequestChange[] = [
        {
          newPath: 'components/VueButton.vue',
          oldPath: 'components/VueButton.vue',
          newContent: '<template><button>Vue Button</button></template>',
          oldContent: '',
          diff: ''
        },
        {
          newPath: 'components/ReactButton.tsx',
          oldPath: 'components/ReactButton.tsx',
          newContent: 'import React from "react"; export const ReactButton = () => <button>React Button</button>;',
          oldContent: '',
          diff: ''
        }
      ];

      const result = documentationService.detectFrameworks(changes);

      expect(result.frameworks).toContain('vue');
      expect(result.frameworks).toContain('nuxt');
      expect(result.frameworks).toContain('react');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('parseDocumentation', () => {
    it('should chunk large documentation into sections', () => {
      const source = {
        id: 'test-source',
        name: 'Test Documentation',
        framework: 'test',
        url: 'https://example.com/docs'
      };

      // Create a large content string
      const largeContent = 'A'.repeat(5000);
      
      // Access the private method through any
      const sections = (documentationService as any).parseDocumentation(largeContent, source);

      expect(sections).toBeDefined();
      expect(sections.length).toBeGreaterThan(1);
      expect(sections[0].content.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('extractKeywords', () => {
    it('should extract framework-specific keywords', () => {
      const content = 'This is about components and API configuration for Nuxt pages and layouts';
      
      // Access the private method through any
      const keywords = (documentationService as any).extractKeywords(content, 'nuxt');

      expect(keywords).toContain('nuxt');
      expect(keywords).toContain('component');
      expect(keywords).toContain('api');
      expect(keywords).toContain('pages');
    });
  });

  describe('extractTitle', () => {
    it('should extract markdown headers as titles', () => {
      const content = '# Main Title\n\nSome content here\n\n## Subtitle';
      
      // Access the private method through any
      const title = (documentationService as any).extractTitle(content);

      expect(title).toBe('Main Title');
    });

    it('should extract first meaningful line as title if no headers', () => {
      const content = '\n\nThis is the first meaningful line\nWith more content';
      
      // Access the private method through any
      const title = (documentationService as any).extractTitle(content);

      expect(title).toBe('This is the first meaningful line');
    });

    it('should return null for content without clear titles', () => {
      const content = '';
      
      // Access the private method through any
      const title = (documentationService as any).extractTitle(content);

      expect(title).toBeNull();
    });
  });
});

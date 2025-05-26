// Test file for embedding service functionality
import { describe, test, expect } from 'bun:test';
import { embeddingService } from '../../../services/embedding.js';

describe('Embedding Service', () => {
  test('should load embedding service without errors', () => {
    // Simple test to ensure the service can be imported
    expect(embeddingService).toBeDefined();
  });

  test('should filter files by allowed extensions', () => {
    // Test file extension filtering
    const testFiles = [
      'test.ts',
      'test.js',
      'test.py',
      'test.md',
      'test.json',
      'test.png',
      'test.exe',
      'README'
    ];

    const allowedFiles = testFiles.filter(file =>
      embeddingService.isAllowedFileExtension(file)
    );

    // Should include code files and exclude binary files
    expect(allowedFiles.length).toBeGreaterThan(0);
    expect(allowedFiles.length).toBeLessThan(testFiles.length);
  });

  test('should detect binary content', () => {
    const textContent = 'This is normal text content';
    const binaryContent = '\x00\x01\x02\x03\x04\x05';

    expect(embeddingService.isBinaryContent(textContent)).toBe(false);
    expect(embeddingService.isBinaryContent(binaryContent)).toBe(true);
  });

  test('should get file extension statistics', () => {
    const mockFiles = [
      { path: 'test.ts', content: 'test', language: 'typescript' },
      { path: 'test.js', content: 'test', language: 'javascript' },
      { path: 'test.py', content: 'test', language: 'python' },
      { path: 'test.md', content: 'test', language: 'markdown' }
    ];

    const stats = embeddingService.getFileExtensionStats(mockFiles);

    expect(stats).toHaveProperty('extensionCounts');
    expect(stats.extensionCounts).toHaveProperty('ts');
    expect(stats.extensionCounts).toHaveProperty('js');
    expect(stats.extensionCounts).toHaveProperty('py');
    expect(stats.extensionCounts).toHaveProperty('md');
    expect(stats.extensionCounts.ts).toBe(1);
    expect(stats.extensionCounts.js).toBe(1);
    expect(stats.totalFiles).toBe(4);
  });
});

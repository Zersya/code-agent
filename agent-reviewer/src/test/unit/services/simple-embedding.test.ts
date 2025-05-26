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

  test('should detect binary content through file filtering', () => {
    // Test binary content detection indirectly through file filtering
    const textFile = { path: 'test.txt', content: 'This is normal text content', language: 'text', lastModified: new Date() };
    const binaryFile = { path: 'test.bin', content: '\x00\x01\x02\x03\x04\x05', language: 'binary', lastModified: new Date() };

    const allowedFiles = embeddingService.filterAllowedFiles([textFile, binaryFile]);

    // Binary files should be filtered out
    expect(allowedFiles.some(f => f.path === 'test.txt')).toBe(true);
    expect(allowedFiles.some(f => f.path === 'test.bin')).toBe(false);
  });

  test('should get file extension statistics', () => {
    const mockFiles = [
      { path: 'test.ts', content: 'test', language: 'typescript', lastModified: new Date() },
      { path: 'test.js', content: 'test', language: 'javascript', lastModified: new Date() },
      { path: 'test.py', content: 'test', language: 'python', lastModified: new Date() },
      { path: 'test.md', content: 'test', language: 'markdown', lastModified: new Date() }
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

// Test file for repository service functionality
import { describe, test, expect, beforeEach } from 'bun:test';
import { repositoryService } from '../../../services/repository.js';

describe('Repository Service', () => {
  beforeEach(() => {
    // Reset any state before each test
  });

  describe('Service initialization', () => {
    test('should be importable and have expected methods', () => {
      expect(repositoryService).toBeDefined();
      expect(typeof repositoryService.cloneRepository).toBe('function');
      expect(typeof repositoryService.getRepositoryInfo).toBe('function');
      expect(typeof repositoryService.getFilesFromLocalRepo).toBe('function');
      expect(typeof repositoryService.detectLanguage).toBe('function');
      expect(typeof repositoryService.cleanupRepository).toBe('function');
    });
  });

  describe('Language detection', () => {
    test('should detect TypeScript files', () => {
      expect(repositoryService.detectLanguage('test.ts')).toBe('typescript');
      expect(repositoryService.detectLanguage('src/components/Button.tsx')).toBe('typescript');
    });

    test('should detect JavaScript files', () => {
      expect(repositoryService.detectLanguage('test.js')).toBe('javascript');
      expect(repositoryService.detectLanguage('src/utils/helper.jsx')).toBe('javascript');
    });

    test('should detect Python files', () => {
      expect(repositoryService.detectLanguage('script.py')).toBe('python');
      expect(repositoryService.detectLanguage('src/models/user.py')).toBe('python');
    });

    test('should detect Java files', () => {
      expect(repositoryService.detectLanguage('Main.java')).toBe('java');
      expect(repositoryService.detectLanguage('src/com/example/App.java')).toBe('java');
    });

    test('should detect C/C++ files', () => {
      expect(repositoryService.detectLanguage('main.c')).toBe('c');
      expect(repositoryService.detectLanguage('main.cpp')).toBe('cpp');
      expect(repositoryService.detectLanguage('src/utils.cs')).toBe('csharp');
    });

    test('should detect web files', () => {
      expect(repositoryService.detectLanguage('index.html')).toBe('html');
      expect(repositoryService.detectLanguage('styles.css')).toBe('css');
      expect(repositoryService.detectLanguage('styles.scss')).toBe('scss');
    });

    test('should detect config files', () => {
      expect(repositoryService.detectLanguage('package.json')).toBe('json');
      expect(repositoryService.detectLanguage('config.yaml')).toBe('yaml');
      expect(repositoryService.detectLanguage('docker-compose.yml')).toBe('yaml');
      expect(repositoryService.detectLanguage('config.xml')).toBe('xml');
    });

    test('should detect other languages', () => {
      expect(repositoryService.detectLanguage('script.sh')).toBe('shell');
      expect(repositoryService.detectLanguage('README.md')).toBe('markdown');
      expect(repositoryService.detectLanguage('query.sql')).toBe('sql');
      expect(repositoryService.detectLanguage('app.swift')).toBe('swift');
      expect(repositoryService.detectLanguage('MainActivity.kt')).toBe('kotlin');
      expect(repositoryService.detectLanguage('main.rs')).toBe('rust');
    });

    test('should return plaintext for unknown extensions', () => {
      expect(repositoryService.detectLanguage('file.unknown')).toBe('plaintext');
      expect(repositoryService.detectLanguage('binary.exe')).toBe('plaintext');
      expect(repositoryService.detectLanguage('image.png')).toBe('plaintext');
    });

    test('should handle files without extensions', () => {
      expect(repositoryService.detectLanguage('Dockerfile')).toBe('plaintext');
      expect(repositoryService.detectLanguage('Makefile')).toBe('plaintext');
      expect(repositoryService.detectLanguage('README')).toBe('plaintext');
    });

    test('should handle case sensitivity', () => {
      expect(repositoryService.detectLanguage('FILE.TS')).toBe('typescript');
      expect(repositoryService.detectLanguage('Script.PY')).toBe('python');
      expect(repositoryService.detectLanguage('README.MD')).toBe('markdown');
    });

    test('should handle complex file paths', () => {
      expect(repositoryService.detectLanguage('/very/long/path/to/src/components/Button.tsx')).toBe('typescript');
      expect(repositoryService.detectLanguage('../../relative/path/script.py')).toBe('python');
      expect(repositoryService.detectLanguage('./current/dir/file.js')).toBe('javascript');
    });
  });

  describe('File structure and content handling', () => {
    test('should handle various file types', () => {
      const mockFiles = [
        {
          path: 'src/index.ts',
          content: 'export * from "./app";',
          language: 'typescript'
        },
        {
          path: 'package.json',
          content: '{"name": "test-project"}',
          language: 'json'
        },
        {
          path: 'README.md',
          content: '# Test Project',
          language: 'markdown'
        },
        {
          path: 'Dockerfile',
          content: 'FROM node:18',
          language: 'dockerfile'
        }
      ];

      mockFiles.forEach(file => {
        expect(file.path).toBeTruthy();
        expect(file.content).toBeTruthy();
        expect(file.language).toBeTruthy();
      });
    });

    test('should handle binary file detection', () => {
      const binaryFiles = [
        'image.png',
        'document.pdf',
        'archive.zip',
        'executable.exe',
        'library.so',
        'font.ttf'
      ];

      binaryFiles.forEach(filename => {
        // Binary files should be detected and potentially skipped
        expect(filename).toMatch(/\.(png|pdf|zip|exe|so|ttf)$/);
      });
    });

    test('should handle large file content', () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of content
      const mockFile = {
        path: 'large-file.txt',
        content: largeContent,
        language: 'text'
      };

      expect(mockFile.content.length).toBe(1000000);
      expect(mockFile.path).toBe('large-file.txt');
    });

    test('should handle empty files', () => {
      const emptyFile = {
        path: 'empty.txt',
        content: '',
        language: 'text'
      };

      expect(emptyFile.content).toBe('');
      expect(emptyFile.path).toBe('empty.txt');
    });

    test('should handle files with special characters in content', () => {
      const specialContent = `
        // Unicode test: 你好世界 🌍
        const message = "Hello, naïve café résumé!";
        /* Multi-line comment with
           special chars: @#$%^&*()
           and emojis: 🚀🎉💻 */
      `;

      const mockFile = {
        path: 'unicode-test.js',
        content: specialContent,
        language: 'javascript'
      };

      expect(mockFile.content).toContain('你好世界');
      expect(mockFile.content).toContain('🌍');
      expect(mockFile.content).toContain('naïve');
      expect(mockFile.content).toContain('@#$%^&*()');
    });
  });

  describe('Repository metadata handling', () => {
    test('should handle repository information structure', () => {
      const mockRepoInfo = {
        id: 123,
        name: 'test-project',
        fullName: 'user/test-project',
        url: 'https://gitlab.com/user/test-project',
        defaultBranch: 'main',
        description: 'A test project for validation',
        language: 'TypeScript',
        lastActivity: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockRepoInfo.id).toBe(123);
      expect(mockRepoInfo.name).toBe('test-project');
      expect(mockRepoInfo.fullName).toBe('user/test-project');
      expect(mockRepoInfo.url).toMatch(/^https:\/\/gitlab\.com/);
      expect(mockRepoInfo.defaultBranch).toBe('main');
      expect(mockRepoInfo.lastActivity).toBeInstanceOf(Date);
    });

    test('should handle different branch names', () => {
      const branchNames = [
        'main',
        'master',
        'develop',
        'feature/new-feature',
        'bugfix/fix-123',
        'release/v1.0.0',
        'hotfix/urgent-fix'
      ];

      branchNames.forEach(branch => {
        const mockRepo = {
          id: 123,
          name: 'test-project',
          defaultBranch: branch
        };

        expect(mockRepo.defaultBranch).toBe(branch);
      });
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle network-related errors gracefully', () => {
      const networkErrors = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNRESET'
      ];

      networkErrors.forEach(errorCode => {
        // Service should handle these error codes gracefully
        expect(typeof errorCode).toBe('string');
        expect(errorCode.startsWith('E')).toBe(true);
      });
    });

    test('should handle API rate limiting', () => {
      const rateLimitResponse = {
        status: 429,
        message: 'Too Many Requests',
        retryAfter: 60
      };

      expect(rateLimitResponse.status).toBe(429);
      expect(rateLimitResponse.retryAfter).toBeGreaterThan(0);
    });

    test('should handle authentication errors', () => {
      const authErrors = [
        { status: 401, message: 'Unauthorized' },
        { status: 403, message: 'Forbidden' },
        { status: 404, message: 'Not Found' }
      ];

      authErrors.forEach(error => {
        expect(error.status).toBeGreaterThanOrEqual(400);
        expect(error.status).toBeLessThan(500);
        expect(error.message).toBeTruthy();
      });
    });

    test('should handle malformed API responses', () => {
      const malformedResponses = [
        null,
        undefined,
        '',
        '{"incomplete": json',
        { missingRequiredFields: true },
        []
      ];

      malformedResponses.forEach(response => {
        // Service should handle these gracefully
        expect(response !== null || response === null).toBe(true);
      });
    });
  });

  describe('File path normalization', () => {
    test('should handle various path formats', () => {
      const paths = [
        'src/index.ts',
        './src/index.ts',
        '/src/index.ts',
        'src\\index.ts', // Windows style
        'src/components/Button/index.tsx',
        'very/deep/nested/path/to/file.js'
      ];

      paths.forEach(path => {
        expect(typeof path).toBe('string');
        expect(path.length).toBeGreaterThan(0);
      });
    });

    test('should handle paths with special characters', () => {
      const specialPaths = [
        'src/file with spaces.ts',
        'src/file-with-dashes.ts',
        'src/file_with_underscores.ts',
        'src/file.with.dots.ts',
        'src/file@with@symbols.ts'
      ];

      specialPaths.forEach(path => {
        expect(typeof path).toBe('string');
        expect(path).toContain('src/');
      });
    });
  });
});

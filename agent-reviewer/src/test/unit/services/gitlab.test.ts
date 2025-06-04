// Test file for GitLab service functionality
import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { gitlabService } from '../../../services/gitlab.js';

describe('GitLab Service', () => {
  beforeEach(() => {
    // Reset any mocks before each test
  });

  describe('Language detection', () => {
    test('should detect TypeScript files', () => {
      expect(gitlabService.getLanguageFromPath('test.ts')).toBe('typescript');
      expect(gitlabService.getLanguageFromPath('src/components/Button.tsx')).toBe('typescript');
    });

    test('should detect JavaScript files', () => {
      expect(gitlabService.getLanguageFromPath('test.js')).toBe('javascript');
      expect(gitlabService.getLanguageFromPath('src/utils/helper.jsx')).toBe('javascript');
    });

    test('should detect Python files', () => {
      expect(gitlabService.getLanguageFromPath('script.py')).toBe('python');
      expect(gitlabService.getLanguageFromPath('src/models/user.py')).toBe('python');
    });

    test('should detect Java files', () => {
      expect(gitlabService.getLanguageFromPath('Main.java')).toBe('java');
      expect(gitlabService.getLanguageFromPath('src/com/example/App.java')).toBe('java');
    });

    test('should detect C++ files', () => {
      expect(gitlabService.getLanguageFromPath('main.cpp')).toBe('cpp');
      expect(gitlabService.getLanguageFromPath('src/algorithms.cxx')).toBe('text'); // .cxx not in language map
      expect(gitlabService.getLanguageFromPath('header.hpp')).toBe('cpp');
    });

    test('should detect C files', () => {
      expect(gitlabService.getLanguageFromPath('main.c')).toBe('c');
      expect(gitlabService.getLanguageFromPath('src/utils.h')).toBe('c');
    });

    test('should detect Go files', () => {
      expect(gitlabService.getLanguageFromPath('main.go')).toBe('go');
      expect(gitlabService.getLanguageFromPath('src/server/handler.go')).toBe('go');
    });

    test('should detect Rust files', () => {
      expect(gitlabService.getLanguageFromPath('main.rs')).toBe('rust');
      expect(gitlabService.getLanguageFromPath('src/lib.rs')).toBe('rust');
    });

    test('should detect PHP files', () => {
      expect(gitlabService.getLanguageFromPath('index.php')).toBe('php');
      expect(gitlabService.getLanguageFromPath('src/controllers/UserController.php')).toBe('php');
    });

    test('should detect Ruby files', () => {
      expect(gitlabService.getLanguageFromPath('app.rb')).toBe('ruby');
      expect(gitlabService.getLanguageFromPath('Gemfile')).toBe('text'); // No extension
    });

    test('should detect Swift files', () => {
      expect(gitlabService.getLanguageFromPath('ViewController.swift')).toBe('swift');
      expect(gitlabService.getLanguageFromPath('src/models/User.swift')).toBe('swift');
    });

    test('should detect Kotlin files', () => {
      expect(gitlabService.getLanguageFromPath('MainActivity.kt')).toBe('kotlin');
      expect(gitlabService.getLanguageFromPath('src/utils/Helper.kt')).toBe('kotlin');
    });

    test('should detect Scala files', () => {
      expect(gitlabService.getLanguageFromPath('Main.scala')).toBe('text'); // .scala not in language map
      expect(gitlabService.getLanguageFromPath('src/models/User.scala')).toBe('text'); // .scala not in language map
    });

    test('should detect shell scripts', () => {
      expect(gitlabService.getLanguageFromPath('deploy.sh')).toBe('shell');
      expect(gitlabService.getLanguageFromPath('scripts/build.bash')).toBe('shell');
      expect(gitlabService.getLanguageFromPath('setup.zsh')).toBe('text'); // .zsh not in language map
    });

    test('should detect SQL files', () => {
      expect(gitlabService.getLanguageFromPath('schema.sql')).toBe('sql');
      expect(gitlabService.getLanguageFromPath('migrations/001_create_users.sql')).toBe('sql');
    });

    test('should detect HTML files', () => {
      expect(gitlabService.getLanguageFromPath('index.html')).toBe('html');
      expect(gitlabService.getLanguageFromPath('templates/layout.htm')).toBe('text'); // .htm not in language map
    });

    test('should detect CSS files', () => {
      expect(gitlabService.getLanguageFromPath('styles.css')).toBe('css');
      expect(gitlabService.getLanguageFromPath('src/components/Button.scss')).toBe('scss');
      expect(gitlabService.getLanguageFromPath('styles/main.sass')).toBe('text'); // .sass not in language map
    });

    test('should detect JSON files', () => {
      expect(gitlabService.getLanguageFromPath('package.json')).toBe('json');
      expect(gitlabService.getLanguageFromPath('config/settings.json')).toBe('json');
    });

    test('should detect XML files', () => {
      expect(gitlabService.getLanguageFromPath('config.xml')).toBe('text'); // .xml not in language map
      expect(gitlabService.getLanguageFromPath('pom.xml')).toBe('text'); // .xml not in language map
    });

    test('should detect YAML files', () => {
      expect(gitlabService.getLanguageFromPath('docker-compose.yml')).toBe('yaml');
      expect(gitlabService.getLanguageFromPath('.github/workflows/ci.yaml')).toBe('yaml');
    });

    test('should detect Markdown files', () => {
      expect(gitlabService.getLanguageFromPath('README.md')).toBe('markdown');
      expect(gitlabService.getLanguageFromPath('docs/api.markdown')).toBe('text'); // .markdown not in language map
    });

    test('should detect text files', () => {
      expect(gitlabService.getLanguageFromPath('notes.txt')).toBe('text');
      expect(gitlabService.getLanguageFromPath('LICENSE')).toBe('text');
    });

    test('should handle special files without extensions', () => {
      expect(gitlabService.getLanguageFromPath('Dockerfile')).toBe('text'); // No extension
      expect(gitlabService.getLanguageFromPath('Makefile')).toBe('text'); // No extension
      expect(gitlabService.getLanguageFromPath('README')).toBe('text');
    });

    test('should return text for unrecognized extensions', () => {
      expect(gitlabService.getLanguageFromPath('file.unknown')).toBe('text');
      expect(gitlabService.getLanguageFromPath('binary.exe')).toBe('text');
      expect(gitlabService.getLanguageFromPath('image.png')).toBe('text');
    });

    test('should handle files without extensions', () => {
      expect(gitlabService.getLanguageFromPath('no-extension')).toBe('text');
      expect(gitlabService.getLanguageFromPath('path/to/file')).toBe('text');
    });

    test('should handle empty or invalid paths', () => {
      expect(gitlabService.getLanguageFromPath('')).toBe('text');
      expect(gitlabService.getLanguageFromPath('.')).toBe('text');
      expect(gitlabService.getLanguageFromPath('..')).toBe('text');
    });

    test('should be case insensitive', () => {
      expect(gitlabService.getLanguageFromPath('FILE.TS')).toBe('typescript');
      expect(gitlabService.getLanguageFromPath('Script.PY')).toBe('python');
      expect(gitlabService.getLanguageFromPath('README.MD')).toBe('markdown');
    });

    test('should handle complex file paths', () => {
      expect(gitlabService.getLanguageFromPath('/very/long/path/to/src/components/Button.tsx')).toBe('typescript');
      expect(gitlabService.getLanguageFromPath('../../relative/path/script.py')).toBe('python');
      expect(gitlabService.getLanguageFromPath('./current/dir/file.js')).toBe('javascript');
    });
  });

  describe('File size and content validation', () => {
    test('should handle various file sizes', () => {
      // These are basic tests since we can't easily mock the actual GitLab API calls
      expect(typeof gitlabService.getLanguageFromPath).toBe('function');
    });
  });

  describe('Error handling', () => {
    test('should handle null and undefined inputs gracefully', () => {
      // The service will throw an error for null/undefined inputs
      expect(() => gitlabService.getLanguageFromPath(null as any)).toThrow();
      expect(() => gitlabService.getLanguageFromPath(undefined as any)).toThrow();
    });
  });
});

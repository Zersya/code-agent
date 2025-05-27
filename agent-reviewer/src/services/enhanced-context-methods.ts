/**
 * Additional methods for Enhanced Context Service
 * This file contains the remaining methods that will be integrated into the main service
 */

import { ContextQuery, ContextQueryResult, CodeElement } from '../types/context.js';
import { MergeRequestChange } from '../types/review.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Extract elements from JavaScript/TypeScript files
 */
export function extractJSElements(content: string, filePath: string, language: string): CodeElement[] {
  const elements: CodeElement[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Class declarations
    const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      elements.push({
        type: 'class',
        name: classMatch[1],
        filePath,
        language,
        context: getContext(lines, i, 3),
      });
    }

    // Interface declarations
    const interfaceMatch = line.match(/^(?:export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      elements.push({
        type: 'interface',
        name: interfaceMatch[1],
        filePath,
        language,
        context: getContext(lines, i, 3),
      });
    }

    // Function declarations
    const functionMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (functionMatch) {
      elements.push({
        type: 'function',
        name: functionMatch[1],
        filePath,
        language,
        context: getContext(lines, i, 3),
      });
    }

    // Arrow functions and method declarations
    const arrowFunctionMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
    if (arrowFunctionMatch) {
      elements.push({
        type: 'function',
        name: arrowFunctionMatch[1],
        filePath,
        language,
        context: getContext(lines, i, 3),
      });
    }

    // Import statements
    const importMatch = line.match(/^import\s+.*\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      elements.push({
        type: 'import',
        name: importMatch[1],
        filePath,
        language,
        context: line,
      });
    }

    // Export statements
    const exportMatch = line.match(/^export\s+(?:const|let|var|function|class|interface)\s+(\w+)/);
    if (exportMatch) {
      elements.push({
        type: 'export',
        name: exportMatch[1],
        filePath,
        language,
        context: line,
      });
    }
  }

  return elements;
}

/**
 * Extract elements from Python files
 */
export function extractPythonElements(content: string, filePath: string, language: string): CodeElement[] {
  const elements: CodeElement[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Class declarations
    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch) {
      elements.push({
        type: 'class',
        name: classMatch[1],
        filePath,
        language,
        context: getContext(lines, i, 3),
      });
    }

    // Function declarations
    const functionMatch = line.match(/^def\s+(\w+)/);
    if (functionMatch) {
      elements.push({
        type: 'function',
        name: functionMatch[1],
        filePath,
        language,
        context: getContext(lines, i, 3),
      });
    }

    // Import statements
    const importMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)/);
    if (importMatch) {
      const moduleName = importMatch[1] || importMatch[2].split(',')[0].trim();
      elements.push({
        type: 'import',
        name: moduleName,
        filePath,
        language,
        context: line,
      });
    }
  }

  return elements;
}

/**
 * Extract elements from Java files
 */
export function extractJavaElements(content: string, filePath: string, language: string): CodeElement[] {
  const elements: CodeElement[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Class declarations
    const classMatch = line.match(/^(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      elements.push({
        type: 'class',
        name: classMatch[1],
        filePath,
        language,
        context: getContext(lines, i, 3),
      });
    }

    // Interface declarations
    const interfaceMatch = line.match(/^(?:public\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      elements.push({
        type: 'interface',
        name: interfaceMatch[1],
        filePath,
        language,
        context: getContext(lines, i, 3),
      });
    }

    // Method declarations
    const methodMatch = line.match(/^(?:public|private|protected)\s+(?:static\s+)?(?:\w+\s+)?(\w+)\s*\(/);
    if (methodMatch) {
      elements.push({
        type: 'function',
        name: methodMatch[1],
        filePath,
        language,
        context: getContext(lines, i, 3),
      });
    }

    // Import statements
    const importMatch = line.match(/^import\s+([^;]+);/);
    if (importMatch) {
      elements.push({
        type: 'import',
        name: importMatch[1],
        filePath,
        language,
        context: line,
      });
    }
  }

  return elements;
}

/**
 * Extract elements from Vue files
 */
export function extractVueElements(content: string, filePath: string, language: string): CodeElement[] {
  const elements: CodeElement[] = [];
  
  // Extract script section and parse as JavaScript/TypeScript
  const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    const scriptContent = scriptMatch[1];
    const scriptLang = content.match(/<script[^>]*lang=['"]([^'"]+)['"]/) ? 
      content.match(/<script[^>]*lang=['"]([^'"]+)['"]/)![1] : 'javascript';
    
    elements.push(...extractJSElements(scriptContent, filePath, scriptLang));
  }

  // Extract component name from template or script
  const componentMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
  if (componentMatch) {
    elements.push({
      type: 'class',
      name: componentMatch[1],
      filePath,
      language,
      context: 'Vue component',
    });
  }

  return elements;
}

/**
 * Generic element extraction for other languages
 */
export function extractGenericElements(content: string, filePath: string, language: string): CodeElement[] {
  const elements: CodeElement[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for function-like patterns
    const functionMatch = line.match(/^(?:\w+\s+)*(\w+)\s*\(/);
    if (functionMatch && !line.includes('if') && !line.includes('for') && !line.includes('while')) {
      elements.push({
        type: 'function',
        name: functionMatch[1],
        filePath,
        language,
        context: getContext(lines, i, 2),
      });
    }
  }

  return elements;
}

/**
 * Get context lines around a specific line
 */
export function getContext(lines: string[], lineIndex: number, contextSize: number): string {
  const start = Math.max(0, lineIndex - contextSize);
  const end = Math.min(lines.length, lineIndex + contextSize + 1);
  return lines.slice(start, end).join('\n');
}

/**
 * Generate context queries for a code element
 */
export function generateQueriesForElement(element: CodeElement): ContextQuery[] {
  const queries: ContextQuery[] = [];

  switch (element.type) {
    case 'class':
      // Find parent classes and interfaces
      queries.push({
        id: uuidv4(),
        query: `Find parent classes, base classes, or interfaces that ${element.name} extends or implements`,
        priority: 8,
        category: 'inheritance',
        relatedFile: element.filePath,
        relatedElement: element.name,
      });

      // Find classes that extend this class
      queries.push({
        id: uuidv4(),
        query: `Find classes that extend or inherit from ${element.name}`,
        priority: 7,
        category: 'inheritance',
        relatedFile: element.filePath,
        relatedElement: element.name,
      });

      // Find test files for this class
      queries.push({
        id: uuidv4(),
        query: `Find test files that test ${element.name} class`,
        priority: 6,
        category: 'tests',
        relatedFile: element.filePath,
        relatedElement: element.name,
      });
      break;

    case 'function':
      // Find functions that call this function
      queries.push({
        id: uuidv4(),
        query: `Find functions or methods that call ${element.name}`,
        priority: 8,
        category: 'callers',
        relatedFile: element.filePath,
        relatedElement: element.name,
      });

      // Find test files for this function
      queries.push({
        id: uuidv4(),
        query: `Find test files that test ${element.name} function`,
        priority: 6,
        category: 'tests',
        relatedFile: element.filePath,
        relatedElement: element.name,
      });
      break;

    case 'interface':
      // Find classes that implement this interface
      queries.push({
        id: uuidv4(),
        query: `Find classes that implement ${element.name} interface`,
        priority: 8,
        category: 'inheritance',
        relatedFile: element.filePath,
        relatedElement: element.name,
      });
      break;

    case 'import':
      // Find other files that import from the same module
      queries.push({
        id: uuidv4(),
        query: `Find files that import from ${element.name} module`,
        priority: 5,
        category: 'dependencies',
        relatedFile: element.filePath,
        relatedElement: element.name,
      });
      break;
  }

  return queries;
}

/**
 * Generate context queries for a file
 */
export function generateQueriesForFile(change: MergeRequestChange): ContextQuery[] {
  const queries: ContextQuery[] = [];
  const fileName = change.newPath.split('/').pop() || change.newPath;
  const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

  // Find configuration files that might reference this file
  queries.push({
    id: uuidv4(),
    query: `Find configuration files that reference ${fileName} or ${fileNameWithoutExt}`,
    priority: 4,
    category: 'config',
    relatedFile: change.newPath,
  });

  // Find documentation that mentions this file
  queries.push({
    id: uuidv4(),
    query: `Find documentation files that mention ${fileName} or describe ${fileNameWithoutExt}`,
    priority: 3,
    category: 'documentation',
    relatedFile: change.newPath,
  });

  return queries;
}

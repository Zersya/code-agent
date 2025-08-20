#!/usr/bin/env node

/**
 * Test script for project ID extraction functionality
 * This tests the logic used in RepositoryEmbeddingForm.vue
 */

// Utility function to extract project ID from GitLab URL (copied from component)
function extractProjectIdFromUrl(url) {
  if (!url) return null
  
  try {
    // Handle various GitLab URL formats:
    // https://gitlab.com/username/project
    // https://gitlab.com/username/project.git
    // https://gitlab.com/username/project/-/tree/main
    // https://gitlab.example.com/group/subgroup/project
    
    const urlObj = new URL(url)
    let pathname = urlObj.pathname
    
    // Remove leading slash
    if (pathname.startsWith('/')) {
      pathname = pathname.substring(1)
    }
    
    // Remove .git suffix if present
    if (pathname.endsWith('.git')) {
      pathname = pathname.substring(0, pathname.length - 4)
    }
    
    // Remove GitLab-specific paths like /-/tree/main
    const gitlabPathIndex = pathname.indexOf('/-/')
    if (gitlabPathIndex !== -1) {
      pathname = pathname.substring(0, gitlabPathIndex)
    }
    
    // For GitLab.com, we can try to get the project ID from the API
    // For now, we'll use a simple hash-based approach for consistency
    if (pathname) {
      // Create a simple numeric ID from the path
      // This is a simplified approach - in production you might want to call GitLab API
      const hash = pathname.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0)
        return a & a
      }, 0)
      
      return Math.abs(hash)
    }
  } catch (error) {
    console.warn('Failed to extract project ID from URL:', error)
  }
  
  return null
}

// Test cases
const testCases = [
  {
    url: 'https://gitlab.com/username/project',
    description: 'Basic GitLab URL'
  },
  {
    url: 'https://gitlab.com/username/project.git',
    description: 'GitLab URL with .git suffix'
  },
  {
    url: 'https://gitlab.com/username/project/-/tree/main',
    description: 'GitLab URL with tree path'
  },
  {
    url: 'https://gitlab.example.com/group/subgroup/project',
    description: 'Self-hosted GitLab with nested groups'
  },
  {
    url: 'https://gitlab.com/group/project/-/merge_requests/123',
    description: 'GitLab URL with merge request path'
  },
  {
    url: '',
    description: 'Empty URL'
  },
  {
    url: 'invalid-url',
    description: 'Invalid URL'
  },
  {
    url: 'https://github.com/username/project',
    description: 'GitHub URL (should still work)'
  }
]

console.log('🧪 Testing Project ID Extraction Function\n')

let passed = 0
let failed = 0

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.description}`)
  console.log(`  URL: ${testCase.url || '(empty)'}`)
  
  try {
    const result = extractProjectIdFromUrl(testCase.url)
    console.log(`  Result: ${result}`)
    
    // Basic validation
    if (testCase.url === '' || testCase.url === 'invalid-url') {
      if (result === null) {
        console.log(`  ✅ PASS - Correctly returned null for invalid input`)
        passed++
      } else {
        console.log(`  ❌ FAIL - Should return null for invalid input`)
        failed++
      }
    } else if (testCase.url.includes('gitlab.com') || testCase.url.includes('gitlab.example.com')) {
      if (typeof result === 'number' && result > 0) {
        console.log(`  ✅ PASS - Generated valid numeric ID`)
        passed++
      } else {
        console.log(`  ❌ FAIL - Should generate valid numeric ID for valid GitLab URL`)
        failed++
      }
    } else {
      // For non-GitLab URLs, we still expect a numeric result if URL is valid
      if (typeof result === 'number' && result > 0) {
        console.log(`  ✅ PASS - Generated numeric ID for valid URL`)
        passed++
      } else {
        console.log(`  ❌ FAIL - Should generate numeric ID for valid URL`)
        failed++
      }
    }
  } catch (error) {
    console.log(`  ❌ FAIL - Unexpected error: ${error.message}`)
    failed++
  }
  
  console.log('')
})

console.log(`📊 Test Results:`)
console.log(`  ✅ Passed: ${passed}`)
console.log(`  ❌ Failed: ${failed}`)
console.log(`  📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)

if (failed === 0) {
  console.log('\n🎉 All tests passed!')
  process.exit(0)
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.')
  process.exit(1)
}

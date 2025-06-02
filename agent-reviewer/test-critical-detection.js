/**
 * Test script to verify critical issue detection improvements
 * Run with: node test-critical-detection.js
 */

// Mock the ReviewService for testing
class MockReviewService {
  hasCriticalIssues(reviewResult) {
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

  detectCriticalIssuesByEmoji(reviewResult) {
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

      if (!isTemplate) {
        console.log(`✅ Found valid critical issue: ${content.substring(0, 50)}...`);
        return true;
      }
      return false;
    });

    return hasRealIssues;
  }

  detectCriticalIssuesBySection(reviewResult) {
    console.log('📝 Attempting section-based critical issue detection...');

    // Improved section detection with case-insensitive and flexible matching
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
}

// Test cases
const testCases = [
  {
    name: "Quick Mode with Critical Issues (should return true)",
    reviewResult: `
## Review Kode (Quick Mode)

**Ringkasan**: Ada beberapa masalah yang perlu diperbaiki.

**Isu Kritis** (jika ada):
🔴 Potensi null pointer exception pada line 15
**Masalah:** Variable user bisa null tapi tidak ada pengecekan
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
const name = user.name;

// After (diperbaiki)
const name = user?.name || 'Unknown';
\`\`\`
**Cara implementasi:** Tambahkan optional chaining atau null check

**Kesimpulan**:
⚠️ **Perlu perbaikan** - Ada 1 isu kritis yang harus diperbaiki dulu
    `,
    expected: true
  },
  {
    name: "Quick Mode without Critical Issues (should return false)",
    reviewResult: `
## Review Kode (Quick Mode)

**Ringkasan**: Perubahan kode terlihat baik dan tidak ada masalah kritis.

**Isu Kritis** (jika ada):
Tidak ada isu kritis yang ditemukan.

**Kesimpulan**:
✅ **Siap merge** - Tidak ada isu kritis ditemukan
    `,
    expected: false
  },
  {
    name: "Quick Mode with template placeholder (should return false)",
    reviewResult: `
## Review Kode (Quick Mode)

**Isu Kritis** (jika ada):
🔴 [Deskripsi masalah]
**Masalah:** [Penjelasan singkat mengapa bermasalah]
    `,
    expected: false
  },
  {
    name: "Standard Mode with Critical Issues (should return true)",
    reviewResult: `
## Review Kode

**🔴 Kritis** (harus diperbaiki):
🔴 Memory leak pada component lifecycle
**Masalah:** useEffect tidak cleanup subscription

**🟡 Penting** (sangat disarankan):
• Improve error handling

**Kesimpulan**:
⚠️ Perlu perbaikan minor
    `,
    expected: true
  }
];

// Run tests
console.log('🧪 Testing Critical Issue Detection Improvements\n');

const reviewService = new MockReviewService();

testCases.forEach((testCase, index) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`${'='.repeat(60)}`);
  
  const result = reviewService.hasCriticalIssues(testCase.reviewResult);
  const passed = result === testCase.expected;
  
  console.log(`\n📊 Result: ${result}`);
  console.log(`📋 Expected: ${testCase.expected}`);
  console.log(`${passed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (!passed) {
    console.log(`\n❌ Test failed! Expected ${testCase.expected} but got ${result}`);
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log('🎯 Testing Complete!');
console.log(`${'='.repeat(60)}`);

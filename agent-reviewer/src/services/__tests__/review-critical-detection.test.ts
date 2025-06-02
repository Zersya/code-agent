import { ReviewService } from '../review.js';

// Create a test instance to access private methods
class TestableReviewService extends ReviewService {
  // Expose private methods for testing
  public testHasCriticalIssues(reviewResult: string): boolean {
    return (this as any).hasCriticalIssues(reviewResult);
  }

  public testDetectCriticalIssuesByEmoji(reviewResult: string): boolean | null {
    return (this as any).detectCriticalIssuesByEmoji(reviewResult);
  }

  public testDetectCriticalIssuesBySection(reviewResult: string): boolean {
    return (this as any).detectCriticalIssuesBySection(reviewResult);
  }
}

describe('Critical Issue Detection', () => {
  let reviewService: TestableReviewService;

  beforeEach(() => {
    reviewService = new TestableReviewService();
  });

  describe('Emoji-based Detection', () => {
    it('should return false when no red circle emoji is present', () => {
      const reviewResult = `
## Review Kode (Quick Mode)

**Ringkasan**: Perubahan kode terlihat baik dan tidak ada masalah kritis.

**Isu Kritis** (jika ada):
Tidak ada isu kritis yang ditemukan.

**Kesimpulan**:
✅ **Siap merge** - Tidak ada isu kritis ditemukan
      `;

      const result = reviewService.testDetectCriticalIssuesByEmoji(reviewResult);
      expect(result).toBe(false);
    });

    it('should return true when valid critical issues with red circle emoji are present', () => {
      const reviewResult = `
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
      `;

      const result = reviewService.testDetectCriticalIssuesByEmoji(reviewResult);
      expect(result).toBe(true);
    });

    it('should return false when red circle emoji is present but content is template placeholder', () => {
      const reviewResult = `
## Review Kode (Quick Mode)

**Isu Kritis** (jika ada):
🔴 [Deskripsi masalah]
**Masalah:** [Penjelasan singkat mengapa bermasalah]
      `;

      const result = reviewService.testDetectCriticalIssuesByEmoji(reviewResult);
      expect(result).toBe(false);
    });

    it('should return false when red circle emoji is present but content says "tidak ada"', () => {
      const reviewResult = `
## Review Kode (Quick Mode)

**Isu Kritis** (jika ada):
🔴 Tidak ada isu kritis yang ditemukan
      `;

      const result = reviewService.testDetectCriticalIssuesByEmoji(reviewResult);
      expect(result).toBe(false);
    });

    it('should handle multiple critical issues correctly', () => {
      const reviewResult = `
## Review Kode

**🔴 Kritis** (harus diperbaiki):
🔴 Memory leak pada component lifecycle
**Masalah:** useEffect tidak cleanup subscription

🔴 Security vulnerability pada input validation
**Masalah:** User input tidak di-sanitize
      `;

      const result = reviewService.testDetectCriticalIssuesByEmoji(reviewResult);
      expect(result).toBe(true);
    });
  });

  describe('Section-based Detection', () => {
    it('should detect critical issues in Quick Mode format with case variations', () => {
      const reviewResult = `
## Review Kode (Quick Mode)

**isu kritis** (jika ada):
Ada masalah serius pada error handling yang perlu diperbaiki segera.
      `;

      const result = reviewService.testDetectCriticalIssuesBySection(reviewResult);
      expect(result).toBe(true);
    });

    it('should handle "Isu Kritis (jika ada):" format correctly', () => {
      const reviewResult = `
## Review Kode (Quick Mode)

**Isu Kritis** (jika ada):
Ditemukan bug kritis pada validasi input yang bisa menyebabkan crash aplikasi.
      `;

      const result = reviewService.testDetectCriticalIssuesBySection(reviewResult);
      expect(result).toBe(true);
    });

    it('should return false when section exists but says "tidak ada"', () => {
      const reviewResult = `
## Review Kode (Quick Mode)

**Isu Kritis** (jika ada):
Tidak ada isu kritis yang ditemukan dalam review ini.
      `;

      const result = reviewService.testDetectCriticalIssuesBySection(reviewResult);
      expect(result).toBe(false);
    });

    it('should return false when section has minimal content without issue indicators', () => {
      const reviewResult = `
## Review Kode (Quick Mode)

**Isu Kritis** (jika ada):
Semua baik.
      `;

      const result = reviewService.testDetectCriticalIssuesBySection(reviewResult);
      expect(result).toBe(false);
    });

    it('should not be confused by nested "**Masalah:**" sections', () => {
      const reviewResult = `
## Review Kode (Quick Mode)

**Isu Kritis** (jika ada):
🔴 Potensi race condition
**Masalah:** Concurrent access tanpa synchronization
**Cara implementasi:** Gunakan mutex atau atomic operations

**Kesimpulan**:
⚠️ **Perlu perbaikan** - Ada 1 isu kritis
      `;

      const result = reviewService.testDetectCriticalIssuesBySection(reviewResult);
      expect(result).toBe(true);
    });
  });

  describe('Unified hasCriticalIssues Method', () => {
    it('should prioritize emoji detection over section detection', () => {
      const reviewResult = `
## Review Kode (Quick Mode)

**Isu Kritis** (jika ada):
🔴 Critical security vulnerability found
**Masalah:** SQL injection possible

**Kesimpulan**:
⚠️ **Perlu perbaikan** - Ada 1 isu kritis
      `;

      const result = reviewService.testHasCriticalIssues(reviewResult);
      expect(result).toBe(true);
    });

    it('should fall back to section detection when no emoji is present', () => {
      const reviewResult = `
## Review Kode (Quick Mode)

**Isu Kritis** (jika ada):
Ditemukan masalah serius pada error handling yang perlu diperbaiki.
      `;

      const result = reviewService.testHasCriticalIssues(reviewResult);
      expect(result).toBe(true);
    });

    it('should return false when neither method finds critical issues', () => {
      const reviewResult = `
## Review Kode (Quick Mode)

**Ringkasan**: Kode terlihat baik dan mengikuti best practices.

**Isu Kritis** (jika ada):
Tidak ada isu kritis yang ditemukan.

**Kesimpulan**:
✅ **Siap merge** - Tidak ada isu kritis ditemukan
      `;

      const result = reviewService.testHasCriticalIssues(reviewResult);
      expect(result).toBe(false);
    });

    it('should work correctly with Standard Mode format', () => {
      const reviewResult = `
## Review Kode

**Temuan Utama**:

**🔴 Kritis** (harus diperbaiki):
🔴 Potential memory leak in useEffect
**Masalah:** Missing cleanup function

**🟡 Penting** (sangat disarankan):
• Improve error handling in API calls

**Kesimpulan**:
⚠️ Perlu perbaikan minor
      `;

      const result = reviewService.testHasCriticalIssues(reviewResult);
      expect(result).toBe(true);
    });

    it('should work correctly with Detailed Mode format', () => {
      const reviewResult = `
## Review Kode (Detailed Analysis)

**Potensi Bug & Performa** (ANALISIS MENDALAM):
🔴 Race condition in state management
**Masalah:** Multiple async operations modifying same state
**Contoh perbaikan:**
\`\`\`javascript
// Before (bermasalah)
setState(prev => ({ ...prev, loading: true }));
fetchData().then(data => setState(prev => ({ ...prev, data, loading: false })));

// After (diperbaiki)
setState(prev => ({ ...prev, loading: true }));
const result = await fetchData();
setState(prev => ({ ...prev, data: result, loading: false }));
\`\`\`
**Cara implementasi:** Use async/await instead of Promise chains

**Kesimpulan**: Ada isu kritis yang perlu diperbaiki
      `;

      const result = reviewService.testHasCriticalIssues(reviewResult);
      expect(result).toBe(true);
    });
  });
});

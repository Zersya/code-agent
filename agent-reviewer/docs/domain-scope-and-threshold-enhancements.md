# Domain-Specific Review Scope and Critical Issue Threshold Enhancements

This document describes the new domain-specific review scope and critical issue threshold features added to the GitLab merge request review automation system.

## Overview

Two major enhancements have been implemented to make the reviewer agent more focused and less likely to flag minor issues as critical:

1. **Domain-Specific Review Scope**: Restricts the reviewer to only analyze code changes within the merge request diff
2. **Critical Issue Threshold**: Adjusts the sensitivity for flagging issues as critical (🔴)

## Domain-Specific Review Scope

### Configuration

Add the following environment variable to your `.env` file:

```bash
# Domain-Specific Review Scope Configuration
# Controls whether the reviewer analyzes only the diff changes or provides broader context
# 'diff-only': Only analyze code changes within the merge request diff
# 'full-context': Analyze changes with full project context (current behavior)
# 'auto': Automatically choose based on changeset size (diff-only for small changes, full-context for large)
REVIEW_DOMAIN_SCOPE='auto'
```

### Behavior

- **`diff-only`**: The reviewer will only analyze code that has been modified in the merge request diff. It will not provide general architectural suggestions or recommendations for unchanged code.

- **`full-context`**: The reviewer maintains the current behavior, providing comprehensive analysis including broader project context and architectural suggestions.

- **`auto`**: Intelligently switches between modes based on changeset size:
  - Small changesets (≤5 files, ≤50 lines): Uses `diff-only` mode
  - Large changesets: Uses `full-context` mode

### Implementation Details

When `diff-only` mode is active, the system prompt includes specific instructions:

- Only analyze code that is added (+) or modified in the diff
- Avoid suggesting improvements to unchanged code
- Focus on the specific modifications being made
- Don't provide general architectural or style suggestions outside the scope of changes
- Prioritize analysis of the impact of changes on existing functionality

## Critical Issue Threshold

### Configuration

Add the following environment variable to your `.env` file:

```bash
# Critical Issue Sensitivity Configuration
# Controls the threshold for flagging issues as critical (🔴) requiring manual intervention
# 'strict': Only security vulnerabilities, breaking changes, crashes, data corruption
# 'standard': Current behavior - bugs, performance issues, security concerns (default)
# 'lenient': Only deployment-blocking issues that prevent successful deployment
CRITICAL_ISSUE_THRESHOLD='standard'
```

### Threshold Levels

#### Strict Threshold
Only flags the most severe issues as critical:
- Security vulnerabilities (SQL injection, XSS, authentication bypass)
- Breaking changes that will break API or existing functionality
- Application crashes or system failures
- Data corruption or data loss risks
- Deployment blockers

**Does NOT flag as critical**: Code style issues, minor performance optimizations, refactoring suggestions, documentation issues.

#### Standard Threshold (Default)
Maintains current behavior, flagging these as critical:
- Significant bugs (logic errors, null pointer exceptions, infinite loops)
- Security issues (vulnerability, input validation, authentication problems)
- Critical performance bottlenecks
- Breaking changes
- Missing error handling for critical operations

#### Lenient Threshold
Only flags the most deployment-critical issues:
- Deployment blockers that prevent successful deployment
- Critical security vulnerabilities that allow unauthorized system access
- System failures that make the application completely non-functional
- Permanent data loss risks

**Does NOT flag as critical**: Minor bugs, performance issues, code quality concerns.

### Auto-Approval Integration

The auto-approval logic has been enhanced to work with the new threshold settings:

1. **Primary Logic**: Approve if NO critical issues (🔴) are found, regardless of review mode
2. **Threshold Validation**: Critical issues are validated against the configured threshold before being considered for auto-approval decisions
3. **Fallback Logic**: Traditional Indonesian approval phrases are still supported as fallback

## Logging and Monitoring

The system provides enhanced logging to track the new features:

```
🔧 Review Service Configuration:
   Mode: standard
   Max Suggestions: 5
   Conservative Mode: false
   Focus Areas: bugs, performance, security, style
   Domain Scope: auto
   Critical Issue Threshold: standard
   LLM Provider: openrouter

🎯 Domain Scope Decision: DIFF-ONLY (Config: auto, Files: 2, Lines: 15)
```

## Usage Examples

### Example 1: Strict Threshold with Diff-Only Scope

```bash
REVIEW_DOMAIN_SCOPE='diff-only'
CRITICAL_ISSUE_THRESHOLD='strict'
```

This configuration will:
- Only analyze code changes in the diff
- Only flag severe security vulnerabilities, crashes, or breaking changes as critical
- Auto-approve most merge requests unless they contain deployment-blocking issues

### Example 2: Auto Scope with Lenient Threshold

```bash
REVIEW_DOMAIN_SCOPE='auto'
CRITICAL_ISSUE_THRESHOLD='lenient'
```

This configuration will:
- Use diff-only for small changes, full-context for large changes
- Only flag deployment-blocking issues as critical
- Provide the most permissive auto-approval behavior

### Example 3: Full Context with Standard Threshold

```bash
REVIEW_DOMAIN_SCOPE='full-context'
CRITICAL_ISSUE_THRESHOLD='standard'
```

This configuration maintains the current behavior while providing the enhanced logging and configuration visibility.

## Testing

Comprehensive tests have been added to verify the new functionality:

- Domain scope decision logic
- Critical issue threshold validation
- System prompt integration
- Auto-approval logic with thresholds
- Backward compatibility

Run tests with:
```bash
bun test src/test/unit/services/review.test.ts
```

## Backward Compatibility

All existing functionality is preserved:
- Default values maintain current behavior
- Existing environment variables continue to work
- All review modes (quick, standard, detailed) are enhanced, not replaced
- Sequential thinking integration works with both new features
- Indonesian language output is maintained

## Migration Guide

To adopt the new features:

1. Add the new environment variables to your `.env` file
2. Start with `REVIEW_DOMAIN_SCOPE='auto'` and `CRITICAL_ISSUE_THRESHOLD='standard'` to maintain current behavior
3. Gradually adjust settings based on your team's needs:
   - Use `strict` threshold to reduce false positives
   - Use `diff-only` scope for focused reviews on small changes
4. Monitor the enhanced logging to understand the system's decisions
5. Adjust thresholds based on auto-approval patterns and team feedback

## Technical Implementation

The enhancements are implemented through:

1. **New Environment Variables**: `REVIEW_DOMAIN_SCOPE` and `CRITICAL_ISSUE_THRESHOLD`
2. **Helper Methods**: 
   - `shouldUseDiffOnlyScope()`: Determines scope based on configuration and changeset size
   - `getDomainScopeInstructions()`: Generates diff-only instructions for system prompts
   - `getCriticalIssueThresholdDefinition()`: Provides threshold-specific definitions
   - `validateCriticalIssueByThreshold()`: Validates issues against threshold criteria
3. **Enhanced System Prompts**: Both direct LLM and sequential thinking prompts include the new instructions
4. **Improved Critical Issue Detection**: Threshold-aware validation in emoji and section-based detection
5. **Enhanced Logging**: Detailed configuration and decision logging

The implementation maintains full backward compatibility while providing powerful new configuration options for teams to customize their review automation experience.

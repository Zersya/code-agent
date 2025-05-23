# Notion Task Context Integration

This document describes the Notion task context integration feature that enhances GitLab merge request reviews with business requirements and task context from Notion pages.

## Overview

The Notion integration automatically extracts Notion URLs from merge request descriptions, fetches task context from those pages, and includes this information in the AI code review process. This enables the reviewer to verify that code changes align with business requirements and acceptance criteria.

## Features

### 1. **Automatic URL Extraction**
- Parses merge request descriptions for Notion URLs
- Supports multiple URL formats:
  - `https://www.notion.so/workspace/page-title-id`
  - `https://notion.so/workspace/page-title-id`
  - `https://workspace.notion.site/page-title-id`
  - Direct page IDs: `https://www.notion.so/32-char-id`
- Prioritizes URLs found in "Related Links" sections
- Falls back to searching the entire description

### 2. **Task Context Fetching**
- Retrieves page content using Notion API
- Extracts structured information:
  - Task title and description
  - Requirements and acceptance criteria
  - Technical specifications
  - Related context and notes
- Handles multiple Notion pages per merge request
- Provides error handling for inaccessible pages

### 3. **Enhanced Code Reviews**
- Integrates task context into LLM prompts
- Instructs AI to verify code alignment with requirements
- Checks implementation against acceptance criteria
- Identifies missing functionality or edge cases
- Provides contextual feedback based on business objectives

### 4. **Error Handling & Fallback**
- Graceful degradation when Notion API is unavailable
- Timeout handling for slow API responses
- Continues with standard review if no Notion links found
- Comprehensive error logging for debugging

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# Notion Integration Configuration
ENABLE_NOTION_INTEGRATION='true'
NOTION_API_TOKEN='secret_your_notion_integration_token'
NOTION_API_TIMEOUT=10000
```

### Notion API Setup

1. **Create Notion Integration:**
   - Go to https://www.notion.so/my-integrations
   - Click "New integration"
   - Give it a name (e.g., "GitLab MR Reviewer")
   - Select the workspace
   - Copy the "Internal Integration Token"

2. **Grant Page Access:**
   - For each Notion page you want to access, click "Share"
   - Invite your integration by name
   - Grant "Read" permissions

3. **Configure Environment:**
   - Set `NOTION_API_TOKEN` to your integration token
   - Set `ENABLE_NOTION_INTEGRATION='true'`

## Usage

### 1. **In Merge Request Descriptions**

Include Notion URLs in your merge request descriptions:

```markdown
## Description
This MR implements the user authentication feature as specified in the requirements.

## Related Links:
- Notion Task: https://www.notion.so/workspace/User-Authentication-abc123
- Design: https://figma.com/design/123

## Changes
- Added login component
- Implemented JWT authentication
- Added password validation
```

### 2. **Notion Page Structure**

Structure your Notion pages to include:

- **Clear task title**
- **Detailed description** of what needs to be implemented
- **Requirements** (use bullet points or numbered lists)
- **Acceptance criteria** (clear, testable conditions)
- **Technical specifications** (architecture, patterns, constraints)

Example Notion page structure:
```
# User Authentication Implementation

## Description
Implement secure user login and registration system with JWT tokens.

## Requirements
- Users must be able to register with email and password
- Users must be able to login with valid credentials
- System must generate JWT tokens for authenticated sessions
- Passwords must be securely hashed

## Acceptance Criteria
- Registration form validates email format and password strength
- Login form shows appropriate error messages for invalid credentials
- Successful authentication redirects to user dashboard
- JWT tokens expire after 24 hours

## Technical Specifications
- Use bcrypt for password hashing
- JWT tokens stored in httpOnly cookies
- Implement rate limiting for login attempts
- Follow existing authentication patterns in the codebase
```

## Integration Flow

1. **Webhook Processing:**
   - GitLab webhook triggers merge request review
   - System extracts Notion URLs from MR description
   - Fetches task context from Notion API

2. **Context Enhancement:**
   - Combines Notion context with existing project context
   - Formats task information for LLM consumption
   - Includes requirements and acceptance criteria in review prompt

3. **AI Review:**
   - LLM analyzes code changes against business requirements
   - Verifies implementation meets acceptance criteria
   - Identifies missing functionality or misaligned implementations
   - Provides contextual feedback in Bahasa Indonesia

4. **Review Output:**
   - Standard code quality analysis
   - **New:** Requirement alignment verification
   - Specific feedback on business objective fulfillment
   - Approval/rejection based on both code quality and requirement compliance

## Benefits

### For Developers
- **Clear Context:** Understand business requirements while reviewing code
- **Requirement Traceability:** Verify that implementations match specifications
- **Reduced Back-and-forth:** Catch requirement mismatches early

### For Product Teams
- **Automated Compliance:** Ensure implementations follow specifications
- **Quality Assurance:** Verify acceptance criteria are addressed
- **Documentation Integration:** Link code changes to business requirements

### for Code Reviewers
- **Enhanced Context:** Review with full understanding of business objectives
- **Comprehensive Analysis:** Check both technical quality and business alignment
- **Informed Decisions:** Make approval decisions based on complete information

## Error Scenarios

The system handles various error scenarios gracefully:

1. **Invalid Notion URLs:** Logs error, continues with standard review
2. **Inaccessible Pages:** Reports access issues, proceeds without Notion context
3. **API Timeouts:** Falls back to standard review after timeout
4. **Network Issues:** Continues review process without Notion integration
5. **Malformed Content:** Handles parsing errors, uses available information

## Testing

Run the integration tests to verify functionality:

```bash
# Run Notion integration tests
bun run src/test/notion-integration.test.ts
```

The tests verify:
- URL extraction from various description formats
- Context formatting for LLM consumption
- Error handling scenarios
- Integration with review service

## Monitoring

Monitor the integration through logs:

```bash
# Look for Notion-related log entries
grep -i "notion" logs/webhook.log

# Common log patterns:
# "Getting Notion task context for merge request !123"
# "Found 2 Notion URLs in merge request description"
# "Retrieved Notion context: Found 1 task(s)..."
# "Error getting Notion task context, continuing without it"
```

## Troubleshooting

### Common Issues

1. **No Notion URLs Found:**
   - Check URL format in merge request description
   - Ensure URLs are properly formatted and accessible

2. **API Authentication Errors:**
   - Verify `NOTION_API_TOKEN` is correct
   - Check that integration has access to the pages
   - Ensure workspace permissions are properly configured

3. **Timeout Issues:**
   - Increase `NOTION_API_TIMEOUT` value
   - Check Notion API status
   - Verify network connectivity

4. **Integration Disabled:**
   - Ensure `ENABLE_NOTION_INTEGRATION='true'`
   - Check that `NOTION_API_TOKEN` is set
   - Verify service initialization logs

### Debug Mode

Enable detailed logging by setting log level to debug in your environment.

## Future Enhancements

Potential improvements for future versions:

1. **Caching:** Cache Notion page content to reduce API calls
2. **Webhooks:** Use Notion webhooks to update cached content
3. **Templates:** Support for standardized Notion page templates
4. **Metrics:** Track requirement compliance metrics
5. **Integration:** Support for other task management tools (Jira, Linear, etc.)

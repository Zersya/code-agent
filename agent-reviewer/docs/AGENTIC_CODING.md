# Agentic Coding Mode

The Agent Reviewer now supports **Agentic Coding Mode**, which allows developers to request automated code changes by commenting with `/agent` followed by their instructions.

## Overview

When a developer comments on a pull request or merge request with a message starting with `/agent`, the system will:

1. **Parse the request** and extract coding instructions
2. **Gather relevant codebase context** using semantic search
3. **Generate code changes** using AI/LLM analysis
4. **Validate the changes** for potential issues
5. **Respond with a summary** of what would be changed

## Supported Platforms

- ✅ **GitLab** - Comments on merge requests
- ✅ **GitHub** - Comments on pull requests and review comments

## How to Use

### Basic Usage

Comment on any pull request or merge request with:

```
/agent [your instructions here]
```

### Examples

```
/agent Add error handling to the login function in auth.js
```

```
/agent Refactor the UserService class to use async/await instead of promises
```

```
/agent Add TypeScript types to the API response interfaces
```

```
/agent Fix the memory leak in the WebSocket connection handler
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# GitHub API Configuration (if using GitHub)
GITHUB_API_TOKEN=your_github_token_here
GITHUB_API_URL=https://api.github.com

# Agentic Coding Configuration
ENABLE_AGENTIC_CODING=true
```

### Required Permissions

#### For GitLab:
- `api` scope for GitLab API token
- Access to read repository files
- Permission to post comments on merge requests

#### For GitHub:
- `repo` scope for GitHub API token
- Access to read repository contents
- Permission to post comments on pull requests

## How It Works

### 1. Comment Detection

The webhook server listens for comment events and checks if they start with `/agent`.

### 2. Context Gathering

The system uses semantic search to find relevant code files based on your instructions:
- Searches existing code embeddings
- Identifies files most relevant to your request
- Limits context to prevent overwhelming the AI

### 3. Code Generation

Using the gathered context and your instructions, the AI:
- Analyzes the current codebase structure
- Follows existing patterns and conventions
- Generates appropriate code changes
- Ensures compatibility with existing functionality

### 4. Response

The system posts a comment with:
- ✅ Success/failure status
- 📝 Summary of proposed changes
- 📄 List of files that would be modified
- 📁 List of files that would be created
- ⚠️ Any warnings or considerations
- 💡 Suggested next steps

## Example Response

```markdown
🤖 **Agentic Coding Response**

✅ **Status**: Successfully processed your request

📝 **Summary**: Added comprehensive error handling to the login function with try-catch blocks, input validation, and proper error logging.

📄 **Files Modified**:
- `src/auth/auth.js`
- `src/utils/logger.js`

⚠️ **Warnings**:
- Please test the error handling with various failure scenarios
- Consider updating unit tests to cover new error cases

> **Note**: This is a simulated response. In a production environment, the changes would be applied to a new branch and a pull request would be created for review.

🔍 **Next Steps**: Please review the proposed changes and test them thoroughly before merging.
```

## Limitations

### Current Implementation

- **Simulation Mode**: Changes are analyzed and described but not actually applied
- **Context Limits**: Limited to ~20 most relevant files to prevent token overflow
- **Single Request**: Each comment is processed independently

### Future Enhancements

- **Actual Code Application**: Create branches and apply real changes
- **Multi-step Conversations**: Support follow-up questions and refinements
- **Integration Testing**: Automatically run tests on proposed changes
- **Code Review**: Generate detailed code review comments

## Security Considerations

- Only authorized users can trigger agentic coding (based on repository permissions)
- All changes are logged and auditable
- No direct code execution - only analysis and suggestions
- Respects existing branch protection rules

## Troubleshooting

### Common Issues

1. **"No embeddings found"**
   - The repository hasn't been indexed yet
   - Wait for initial embedding generation to complete

2. **"Could not parse repository URL"**
   - Webhook configuration issue
   - Check that webhooks are properly configured

3. **"Failed to process request"**
   - Check API token permissions
   - Verify LLM service is available
   - Review server logs for detailed errors

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

## Best Practices

### Writing Effective Instructions

1. **Be Specific**: "Add error handling to login function" vs "improve code"
2. **Provide Context**: Mention specific files, functions, or patterns
3. **Set Scope**: Clearly define what should and shouldn't be changed
4. **Consider Dependencies**: Mention related files that might be affected

### Review Process

1. **Always Review**: Never merge AI-generated changes without review
2. **Test Thoroughly**: Run comprehensive tests on proposed changes
3. **Check Dependencies**: Verify that imports and dependencies are correct
4. **Validate Logic**: Ensure the AI understood your requirements correctly

## API Reference

### Webhook Events

The system responds to these webhook events:

#### GitLab
- `note` events on merge requests

#### GitHub
- `issue_comment` events on pull requests
- `pull_request_review_comment` events

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AGENTIC_CODING` | `false` | Enable/disable agentic coding mode |
| `GITHUB_API_TOKEN` | - | GitHub API access token |
| `GITHUB_API_URL` | `https://api.github.com` | GitHub API base URL |

## Contributing

To extend the agentic coding functionality:

1. **Add New Platforms**: Implement webhook handlers in `webhook.ts`
2. **Improve Context**: Enhance the context gathering in `agentic-coding.ts`
3. **Better Validation**: Add more sophisticated change validation
4. **Testing**: Add comprehensive test coverage

## Support

For issues or questions:

1. Check the server logs for detailed error messages
2. Verify webhook configuration and API permissions
3. Test with simple requests first
4. Review the troubleshooting section above

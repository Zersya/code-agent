# GitLab Webhook Integration with Qodo-Embed-1

A webhook integration that listens for GitLab repository events, fetches code, generates embeddings using Qodo-Embed-1, and stores them for later retrieval and search. It also provides automated code review for merge requests from Repopo.

## Features

- **Webhook Integration**: Listens for GitLab push and merge request events
- **Code Fetching**: Retrieves all code from the repository, not just diffs
- **Embedding Generation**: Uses Qodo-Embed-1 model to generate embeddings for code
- **Database Storage**: Stores embeddings in PostgreSQL database for later retrieval and search
- **LLM Analysis**: Analyzes code using either OpenRouter or Ollama (local) LLM providers
- **Security**: Implements webhook authentication and validation
- **Automated Code Review**: Reviews merge requests from Repopo using sequential thinking
- **Merge Request Approval**: Automatically approves merge requests that meet quality standards
- **Automatic Re-embedding**: Automatically re-embeds projects when merge requests are successfully merged
- **Emoji-Triggered Re-reviews**: Automatically triggers re-reviews when developers add emoji reactions to bot comments
- **🤖 Agentic Coding Mode**: Automatically responds to developer comments starting with `/agent` to generate code changes

## Prerequisites

- Node.js 18+
- PostgreSQL database (with pgvector extension for vector search)
- GitLab account with API access (for GitLab repositories)
- GitHub account with API access (for GitHub repositories)
- Qodo-Embed-1 API access
- OpenRouter API key (if using OpenRouter as LLM provider)
- Ollama installed locally (if using Ollama as LLM provider)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/repopo-reviewer-hooks.git
   cd repopo-reviewer-hooks
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on the `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Fill in the environment variables in the `.env` file:
   ```
   # GitLab API Configuration
   GITLAB_API_TOKEN='your-gitlab-api-token'
   GITLAB_API_URL='https://gitlab.com/api/v4'
   GITLAB_USERNAME='your-gitlab-username'

   # Webhook Configuration
   WEBHOOK_SECRET='your-webhook-secret'
   PORT=3000

   # Database Configuration
   DATABASE_URL='postgresql://postgres:postgres@localhost:5432/repopo_reviewer'

   # Embedding Configuration
   QODO_EMBED_API_KEY='your-qodo-embed-api-key'
   QODO_EMBED_API_URL='https://api.qodo.ai/v1/embeddings'

   # LLM Configuration
   # Provider can be 'openrouter' or 'ollama'
   LLM_PROVIDER='openrouter'

   # OpenRouter Configuration (used when LLM_PROVIDER='openrouter')
   OPENROUTER_API_KEY='your-openrouter-api-key'
   OPENROUTER_API_URL='https://openrouter.ai/api/v1'

   # Ollama Configuration (used when LLM_PROVIDER='ollama')
   OLLAMA_API_URL='http://localhost:11434/api'
   OLLAMA_MODEL='llama3'
   ```

5. Build the project:
   ```bash
   npm run build
   ```

## Usage

### Starting the Webhook Server

```bash
npm run start:webhook
```

The webhook server will start on the port specified in the `.env` file (default: 3000).

### Setting Up GitLab Webhook

1. Go to your GitLab project
2. Navigate to Settings > Webhooks
3. Add a new webhook with the following settings:
   - URL: `https://your-server.com/webhook`
   - Secret Token: The same value as `WEBHOOK_SECRET` in your `.env` file
   - Trigger events:
     - Push events
     - Merge request events
   - SSL verification: Enabled (recommended for production)

4. Click "Add webhook"

### Testing the Webhook

1. Make a push to your GitLab repository
2. Check the logs of your webhook server to see if the event was received and processed
3. Verify that the embeddings were generated and stored in the database

## Database Schema

The PostgreSQL database contains the following tables:

### `embeddings`

Stores the embeddings for each file in the repository.

```sql
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  repository_url TEXT,
  file_path TEXT NOT NULL,
  content TEXT,
  embedding vector(1536), -- Uses pgvector extension
  language TEXT,
  commit_id TEXT NOT NULL,
  branch TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, file_path)
)
```

### `projects`

Stores metadata about each project.

```sql
CREATE TABLE projects (
  project_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  default_branch TEXT,
  last_processed_commit TEXT,
  last_processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_reembedding_at TIMESTAMP WITH TIME ZONE
)
```

### `batches`

Stores information about each batch of embeddings generated.

```sql
CREATE TABLE batches (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  commit_id TEXT NOT NULL,
  branch TEXT,
  files JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

### Vector Search

The system uses the `pgvector` extension for PostgreSQL to enable efficient similarity search of code embeddings. If the extension is not available, it will fall back to storing embeddings as JSONB and using basic filtering.

### Merge Request Review

The system can automatically review merge requests from Repopo using a sequential thinking process:

1. When a merge request webhook is received from Repopo, the system:
   - Processes the code changes to generate embeddings
   - Analyzes the code changes using sequential thinking with 4 thought steps
   - Provides a comprehensive review in Bahasa Indonesia
   - Approves the merge request if it meets quality standards

2. The review focuses on:
   - Code quality and best practices
   - Logical flow and architecture
   - Code clarity and readability
   - Potential bugs and edge cases

3. Review comments are structured with:
   - A greeting: "Halo, berikut review untuk MR ini:"
   - A review section with analysis
   - A feedback section with actionable suggestions
   - An approval message if appropriate: "Silahkan merge! \nTerima kasih"

To enable or disable this feature, set `ENABLE_MR_REVIEW=true` or `ENABLE_MR_REVIEW=false` in your `.env` file.

## Automatic Project Re-embedding

The system automatically re-embeds projects when merge requests are successfully merged to ensure that the embedded knowledge base stays current with the latest code changes.

### How It Works

1. **Merge Detection**: When a GitLab webhook indicates a merge request has been successfully merged (action: 'merge', state: 'merged'), the system triggers the re-embedding process.

2. **Data Cleanup**: The system first clears all existing embeddings and batches for the affected project to prevent conflicts and ensure a clean re-embedding.

3. **Queue Re-embedding**: A new embedding job is queued with high priority (priority level 10) to process the entire repository with the latest merged code.

4. **Asynchronous Processing**: The re-embedding process runs asynchronously through the existing queue system, so it doesn't block the webhook response.

### Benefits

- **Up-to-date Context**: Code reviews and searches always use the most current version of the codebase
- **Improved Accuracy**: Embeddings reflect the actual state of the main branch after merges
- **Automatic Maintenance**: No manual intervention required to keep embeddings current
- **Performance Optimized**: Uses the existing queue system with proper concurrency controls

### Configuration

The re-embedding feature is automatically enabled and uses the same configuration as the regular embedding process:

- **File Filtering**: Uses the same `ALLOWED_FILE_EXTENSIONS` configuration
- **Queue Settings**: Respects `QUEUE_CONCURRENCY` and `QUEUE_MAX_ATTEMPTS` settings
- **Embedding API**: Uses the same Qodo-Embed-1 API configuration

### Monitoring

Re-embedding activities are logged with clear messages:

```
Processing merge completion event for project 12345, MR !42, target branch: main
Triggering re-embedding for project 12345 after successful merge to main
Cleared existing data for project 12345: 150 embeddings, 5 batches
Project 12345 queued for re-embedding after merge (processingId: uuid-here)
```

### Weekly Re-embedding Schedule

To prevent excessive re-embedding operations while ensuring the knowledge base stays current, the system implements a weekly schedule check:

**How It Works:**
- Each project tracks its last re-embedding timestamp in the `last_reembedding_at` field
- Before triggering automatic re-embedding on merge completion, the system checks if the last re-embedding occurred within the past 7 days
- If less than 7 days have passed, the re-embedding is skipped with appropriate logging
- Manual re-embedding requests can bypass this limit by setting the `forceReembedding` parameter to `true`

**Benefits:**
- **Resource Optimization**: Prevents unnecessary re-embedding operations for frequently merged projects
- **Cost Control**: Reduces API calls to the embedding service
- **Performance**: Maintains system responsiveness by avoiding queue overload
- **Flexibility**: Allows manual override when immediate re-embedding is needed

**Monitoring:**
```
Skipping re-embedding for project 12345 due to weekly limit (last re-embedding was within 7 days)
Project 12345: Last re-embedding was 3.2 days ago
```

### Rate Limiting

The system includes built-in rate limiting to prevent overwhelming the embedding API:
- Re-embedding only triggers for actual merge completions, not merge attempts
- Weekly schedule check prevents excessive re-embedding operations
- Uses the existing queue system's concurrency controls
- Includes delays between batch processing to respect API limits

## Emoji-Triggered Re-reviews

The system automatically triggers re-reviews when developers add emoji reactions to bot comments containing the phrase "Merge request has already been reviewed". This allows developers to request fresh reviews when they've made changes after the initial review.

### How It Works

1. **Emoji Detection**: The system monitors GitLab webhook events for emoji reactions (👍, 👎, 🔄, or any emoji) added to comments.

2. **Trigger Phrase Matching**: Only comments containing the exact phrase "Merge request has already been reviewed" will trigger re-reviews when reacted to with emojis.

3. **New Commit Analysis**: When triggered, the system:
   - Compares the current merge request's latest commit SHA with the previously reviewed commit SHA stored in the database
   - Fetches only the changes introduced in commits since the last review
   - Analyzes only the incremental changes, not the entire merge request

4. **Incremental Review**: The re-review process:
   - Uses the same LLM-powered sequential thinking review process
   - Focuses specifically on new changes since the last review
   - Posts a new comment indicating this is a re-review of recent changes
   - Updates the merge request approval status if the new changes meet quality standards

### Benefits

- **Efficient Reviews**: Only analyzes new changes, saving time and computational resources
- **Developer-Friendly**: Simple emoji reaction triggers re-review without complex commands
- **Contextual Analysis**: Maintains review history to provide incremental feedback
- **Automatic Approval**: Can approve merge requests if new changes meet quality standards

### Usage

1. **Initial Review**: The bot reviews a merge request and posts a comment ending with "Merge request has already been reviewed"
2. **Developer Makes Changes**: Developer pushes new commits to the merge request
3. **Request Re-review**: Developer adds any emoji reaction (👍, 👎, 🔄, etc.) to the bot's review comment
4. **Automatic Re-review**: The system automatically:
   - Detects the emoji reaction
   - Identifies new commits since the last review
   - Analyzes only the new changes
   - Posts an incremental review comment
   - Updates approval status if appropriate

### Database Schema

The system uses a `merge_request_reviews` table to track review history:

```sql
CREATE TABLE merge_request_reviews (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  merge_request_iid INTEGER NOT NULL,
  last_reviewed_commit_sha TEXT NOT NULL,
  review_comment_id INTEGER,
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, merge_request_iid)
);
```

### Configuration

The re-review feature uses the same configuration as regular reviews:
- **LLM Provider**: Uses the configured OpenRouter or Ollama provider
- **Review Settings**: Respects `ENABLE_MR_REVIEW` setting
- **Project Context**: Uses `ENABLE_PROJECT_CONTEXT` if enabled

### Monitoring

Re-review activities are logged with detailed messages:

```
Processing emoji event for project 12345, emoji 👍, action: add
Emoji 👍 added to note with re-review trigger phrase, triggering re-review
Starting re-review for merge request !42 in project 12345
Found 3 new changes since last review for MR !42
Successfully completed re-review for merge request !42 in project 12345
```

### Error Handling

The system gracefully handles various error scenarios:
- **Missing Review History**: Falls back to full review if no previous review found
- **No New Commits**: Skips re-review if no changes since last review
- **API Failures**: Continues processing with appropriate error logging
- **Invalid Webhooks**: Ignores non-merge request notes and invalid emoji events

## 🤖 Agentic Coding Mode

The system now supports **Agentic Coding Mode**, which allows developers to request automated code changes by commenting with `/agent` followed by their instructions. This feature works with both GitLab and GitHub repositories.

### Quick Start

Comment on any pull request or merge request with:

```
/agent Add error handling to the login function in auth.js
```

The system will:
1. **Analyze your request** and gather relevant codebase context
2. **Generate appropriate code changes** using AI analysis
3. **Validate the changes** for potential issues
4. **Respond with a detailed summary** of what would be changed

### Supported Platforms

- ✅ **GitLab**: Comments on merge requests
- ✅ **GitHub**: Comments on pull requests and review comments

### Configuration

Add these environment variables to enable agentic coding:

```bash
# GitHub API Configuration (if using GitHub)
GITHUB_API_TOKEN=your_github_token_here
GITHUB_API_URL=https://api.github.com

# Agentic Coding Configuration
ENABLE_AGENTIC_CODING=true
```

### Example Usage

```
/agent Refactor the UserService class to use async/await instead of promises
```

```
/agent Add TypeScript types to the API response interfaces
```

```
/agent Fix the memory leak in the WebSocket connection handler
```

### How It Works

1. **Comment Detection**: Webhook listens for comments starting with `/agent`
2. **Context Gathering**: Uses semantic search to find relevant code files
3. **AI Analysis**: Generates appropriate code changes using LLM
4. **Response**: Posts detailed summary of proposed changes

### Documentation

For detailed documentation, examples, and troubleshooting, see [docs/AGENTIC_CODING.md](docs/AGENTIC_CODING.md).

### Testing

Test the agentic coding functionality:

```bash
node scripts/test-agentic-coding.js
```

## LLM Providers

The system supports two LLM providers for code analysis:

### OpenRouter

[OpenRouter](https://openrouter.ai/) is a unified API that provides access to various LLM models including Claude, GPT-4, and others. This is the default provider.

**Configuration:**
- Set `LLM_PROVIDER=openrouter` in your `.env` file
- Obtain an API key from OpenRouter and set `OPENROUTER_API_KEY` in your `.env` file
- Optionally, specify a custom API URL with `OPENROUTER_API_URL`

### Ollama

[Ollama](https://ollama.ai/) allows you to run open-source LLMs locally on your machine. This is useful for environments where you need to keep data private or don't have internet access.

**Prerequisites:**
1. Install Ollama on your machine by following the instructions at [ollama.ai](https://ollama.ai/)
2. Pull a model (e.g., `ollama pull llama3`)

**Configuration:**
- Set `LLM_PROVIDER=ollama` in your `.env` file
- Set `OLLAMA_MODEL` to the name of the model you pulled (default is `llama3`)
- If Ollama is running on a different machine or port, set `OLLAMA_API_URL` accordingly

### Switching Between Providers

To switch between providers, simply change the `LLM_PROVIDER` value in your `.env` file and restart the application. No code changes are required.

## Next Steps

1. **Configure GitLab Webhook**: Set up a webhook in your GitLab project pointing to your server's `/webhook` endpoint
2. **Set Up PostgreSQL**: Install and configure PostgreSQL for storing the embeddings. For vector search capabilities, install the pgvector extension
3. **Get API Keys**: Obtain API keys for GitLab, Qodo-Embed-1, and OpenRouter (if using OpenRouter as LLM provider)
4. **Set Up Ollama**: If using Ollama as LLM provider, install Ollama and pull the desired model
5. **Test the Integration**: Make a push to your repository and verify that embeddings are generated and stored

## Security Considerations

- The webhook endpoint is protected by a secret token
- The GitLab API token should have read-only access to repositories
- The Qodo-Embed-1 API key should be kept secure
- For production deployments, use HTTPS for the webhook endpoint

## License

MIT

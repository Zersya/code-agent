# Documentation Embedding System

The GitLab merge request review automation system now includes documentation embedding capability to enhance code reviews with authoritative framework knowledge.

## Overview

This feature automatically:
- Detects frameworks used in merge requests (Nuxt.js, Vue.js, React, etc.)
- Retrieves relevant documentation context from embedded documentation sources
- Integrates documentation knowledge into AI code reviews
- Provides more informed feedback about best practices and proper API usage

## Features

### 1. Documentation Source Management
- Support for multiple documentation sources per framework
- Automatic framework detection from file extensions and imports
- Configurable refresh intervals for documentation updates
- Status tracking for documentation fetching and embedding

### 2. Context Enhancement for Reviews
- Automatic retrieval of relevant documentation based on code changes
- Framework-specific context matching
- Integration with existing sequential thinking review process
- Balanced weighting between code context and documentation context

### 3. Queue System Integration
- Documentation embedding jobs processed through existing queue system
- Concurrent processing with code embedding jobs
- Retry logic and error handling for documentation fetching
- Background processing to avoid blocking reviews

## Database Schema

### Documentation Sources Table
```sql
CREATE TABLE documentation_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  framework TEXT NOT NULL,
  version TEXT,
  is_active BOOLEAN DEFAULT true,
  refresh_interval_days INTEGER DEFAULT 7,
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  last_embedded_at TIMESTAMP WITH TIME ZONE,
  fetch_status TEXT DEFAULT 'pending',
  fetch_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Documentation Embeddings Table
```sql
CREATE TABLE documentation_embeddings (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES documentation_sources(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- or JSONB if pgvector not available
  url TEXT,
  framework TEXT NOT NULL,
  version TEXT,
  keywords TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Project Documentation Mappings Table
```sql
CREATE TABLE project_documentation_mappings (
  project_id INTEGER NOT NULL,
  source_id TEXT NOT NULL REFERENCES documentation_sources(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (project_id, source_id)
);
```

## API Endpoints

### Documentation Source Management

#### Add Documentation Source
```http
POST /api/documentation/sources
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "name": "Nuxt.js Official Documentation",
  "description": "Official Nuxt.js framework documentation",
  "url": "https://nuxt.com/llms-full.txt",
  "framework": "nuxt",
  "version": "3.x",
  "isActive": true,
  "refreshIntervalDays": 7
}
```

#### List Documentation Sources
```http
GET /api/documentation/sources?framework=nuxt&active=true
Authorization: Bearer <API_KEY>
```

#### Update Documentation Source
```http
PUT /api/documentation/sources/{id}
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "isActive": false,
  "refreshIntervalDays": 14
}
```

#### Trigger Re-embedding
```http
POST /api/documentation/sources/{id}/reembed
Authorization: Bearer <API_KEY>
```

### Project Documentation Mapping

#### Map Project to Documentation
```http
POST /api/projects/{projectId}/documentation
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "sourceId": "nuxt-docs-id",
  "priority": 10,
  "isEnabled": true
}
```

#### Get Project Documentation Mappings
```http
GET /api/projects/{projectId}/documentation
Authorization: Bearer <API_KEY>
```

## Setup and Configuration

### 1. Initialize Documentation Sources
```bash
# Run the setup script to add default documentation sources
npm run setup:documentation
```

### 2. Environment Variables
No additional environment variables are required. The system uses existing configuration for:
- Database connection
- Embedding service (Qodo-Embed-1)
- Queue processing

### 3. Framework Detection
The system automatically detects frameworks based on:
- File extensions (`.vue` → Nuxt/Vue, `.tsx/.jsx` → React)
- Import statements (`nuxt`, `@vue`, `react`)
- Configuration files (`nuxt.config.ts`, `package.json`)
- Content patterns (Vue composition API, React hooks)

## Usage Examples

### Automatic Framework Detection
When a merge request contains Vue/Nuxt files, the system will:
1. Detect the framework from file extensions and imports
2. Auto-map the project to relevant documentation sources
3. Retrieve documentation context during review
4. Include framework-specific guidance in the review

### Manual Documentation Mapping
For projects using multiple frameworks or custom setups:
```bash
# Map a project to specific documentation sources
curl -X POST "http://localhost:3000/api/projects/123/documentation" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "nuxt-docs-id",
    "priority": 10,
    "isEnabled": true
  }'
```

### Custom Documentation Sources
Add your own documentation sources:
```bash
curl -X POST "http://localhost:3000/api/documentation/sources" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Framework Docs",
    "description": "Internal framework documentation",
    "url": "https://internal-docs.company.com/framework.txt",
    "framework": "custom",
    "version": "1.0",
    "isActive": true,
    "refreshIntervalDays": 3
  }'
```

## Best Practices

### 1. Documentation URL Format
- Use LLM-optimized documentation when available (like Nuxt's `/llms-full.txt`)
- Ensure URLs return plain text or markdown content
- Avoid HTML-heavy documentation that's hard to parse

### 2. Framework Naming
- Use consistent framework names: `nuxt`, `vue`, `react`, `angular`, `svelte`
- Use `general` for framework-agnostic documentation

### 3. Priority Settings
- Higher priority (10) for primary framework documentation
- Medium priority (5) for related frameworks
- Lower priority (1) for general programming documentation

### 4. Refresh Intervals
- 7 days for stable framework documentation
- 3 days for rapidly evolving frameworks
- 14+ days for mature, stable frameworks

## Monitoring and Troubleshooting

### Check Documentation Status
```bash
# Get all documentation sources and their status
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:3000/api/documentation/sources"
```

### Queue Status
Documentation embedding jobs appear in the standard queue status:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:3000/api/queue/status"
```

### Common Issues

1. **Documentation not fetching**: Check URL accessibility and format
2. **No documentation context in reviews**: Verify project mappings and framework detection
3. **Embedding failures**: Check embedding service availability and content size limits

### Logs
Documentation processing logs appear with prefixes:
- `[DocumentationService]` - Service operations
- `[DocumentationJob]` - Queue processing
- `[DocumentationContext]` - Context retrieval

## Future Enhancements

- Support for private documentation sources with authentication
- Automatic documentation updates based on framework version detection
- Documentation relevance scoring improvements
- Integration with more LLM-optimized documentation sources
- Custom documentation parsing for different formats

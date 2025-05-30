# GitLab Agent Reviewer

A comprehensive GitLab merge request review automation system with AI-powered code analysis, vector embeddings, and intelligent context gathering.

## Overview

This project provides automated GitLab merge request reviews using:

- **AI-Powered Analysis**: LLM-based code review with sequential thinking
- **Vector Embeddings**: Code and documentation embeddings for context-aware reviews
- **PostgreSQL + pgvector**: High-performance vector similarity search
- **Notion Integration**: Task context integration for enhanced reviews
- **Multi-Provider LLM Support**: OpenRouter and Ollama compatibility

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitLab        │    │  Agent Reviewer  │    │  PostgreSQL     │
│   Webhooks      │───▶│  (Node.js)       │───▶│  + pgvector     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Qodo Embedding  │
                       │  Service (Python)│
                       └──────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- GitLab API access token

### 1. Clone and Setup

```bash
git clone <repository-url>
cd gitlab-agent-reviewer
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file with your settings:

```bash
# GitLab Configuration
GITLAB_API_TOKEN='your-gitlab-token'
GITLAB_API_URL='https://gitlab.com/api/v4'
GITLAB_USERNAME='your-username'

# Database (PostgreSQL with pgvector)
POSTGRES_DB='repopo_reviewer'
POSTGRES_USER='postgres'
POSTGRES_PASSWORD='postgres'
POSTGRES_PORT='5432'  # Change if port 5432 is in use

# LLM Provider (OpenRouter or Ollama)
LLM_PROVIDER='openrouter'
OPENROUTER_API_KEY='your-openrouter-key'
```

### 3. Start Services

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f agent-reviewer
```

### 4. Verify Setup

```bash
# Check database health
node scripts/check-database.js

# Test webhook endpoint
curl http://localhost:4100/health
```

## Services

### PostgreSQL Database

- **Image**: `pgvector/pgvector:pg16`
- **Port**: `5432`
- **Features**: Vector similarity search, automatic schema initialization
- **Documentation**: [PostgreSQL Setup Guide](docs/postgresql-setup.md)

### Agent Reviewer

- **Port**: `4100`
- **Features**: Webhook processing, AI reviews, embedding management
- **Documentation**: [Agent Reviewer README](agent-reviewer/README.md)

### Qodo Embedding Service

- **Port**: `4000`
- **Features**: Code embedding generation using Qodo models
- **GPU Support**: Optional NVIDIA GPU acceleration

## Key Features

### 🤖 AI-Powered Reviews

- Sequential thinking for structured analysis
- Multi-mode reviews (quick/standard/detailed)
- Critical issue detection with severity levels
- Indonesian language support

### 📊 Vector Embeddings

- Code similarity analysis
- Documentation context integration
- Efficient vector storage with pgvector
- Automatic project embedding

### 🔗 Integrations

- **GitLab**: Webhook-based MR processing
- **Notion**: Task context extraction
- **Multiple LLM Providers**: OpenRouter, Ollama
- **Documentation Sources**: Nuxt.js and more

### 🚀 Performance

- Concurrent processing with queue management
- Intelligent context gathering for small changes
- Duplicate webhook prevention
- Health monitoring and auto-recovery

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `repopo_reviewer` |
| `POSTGRES_USER` | Database user | `postgres` |
| `POSTGRES_PASSWORD` | Database password | `postgres` |
| `POSTGRES_PORT` | Host port for PostgreSQL | `5432` |
| `LLM_PROVIDER` | LLM provider (openrouter/ollama) | `openrouter` |
| `ENABLE_MR_REVIEW` | Enable MR reviews | `true` |
| `ENABLE_PROJECT_CONTEXT` | Enable project context | `true` |
| `ENABLE_SEQUENTIAL_THINKING` | Enable sequential thinking | `true` |

See [.env.example](.env.example) for complete configuration options.

### Network Configuration

All services communicate through Docker networks:

- `qodo_network`: Internal service communication
- `llm-network`: LLM service communication
- `proxy`: External proxy access

## Development

### Local Development

```bash
# Install dependencies
cd agent-reviewer
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Database Management

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d repopo_reviewer

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

### Monitoring

```bash
# View all logs
docker-compose logs -f

# Monitor specific service
docker-compose logs -f agent-reviewer

# Check resource usage
docker stats
```

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure PostgreSQL is healthy
2. **Port Conflicts**: Check if ports 4100, 4000, 5432 are available
3. **GPU Issues**: Verify NVIDIA Docker runtime for embedding service

### Health Checks

```bash
# Database health
node scripts/check-database.js

# Service health
curl http://localhost:4100/health
curl http://localhost:4000/health
```

### Logs Analysis

```bash
# Check for errors
docker-compose logs agent-reviewer | grep ERROR

# Monitor webhook processing
docker-compose logs -f agent-reviewer | grep webhook
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

[Add your license information here]

## Support

For issues and questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review service-specific documentation
3. Create an issue with detailed logs

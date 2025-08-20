# Agent Reviewer Dashboard Deployment Guide

This guide covers the deployment of the comprehensive admin dashboard for the GitLab merge request review automation system.

## Overview

The dashboard consists of two main components:
- **Backend API**: Node.js/Express server with authentication and data endpoints
- **Frontend Dashboard**: Vue.js 3 SPA with responsive design and real-time updates

## Prerequisites

- Docker and Docker Compose
- PostgreSQL database (with pgvector extension)
- GitLab API access
- LLM provider access (OpenRouter or Ollama)

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the `agent-reviewer` directory with the following variables:

```bash
# Database Configuration
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/repopo_reviewer'

# GitLab API Configuration
GITLAB_API_TOKEN='your-gitlab-token'
GITLAB_API_URL='https://gitlab.com/api/v4'
GITLAB_USERNAME='your-gitlab-username'

# Webhook Configuration
WEBHOOK_SECRET='your-webhook-secret'
PORT=3000

# API Configuration
API_KEY='your-api-key'
APP_URL='http://localhost:3000'

# Admin Dashboard Configuration
ADMIN_SECRET_KEY='your-admin-secret-key'
JWT_SECRET='your-jwt-secret-key'
DASHBOARD_PORT=8080  # Port for the unified dashboard interface

# Embedding Service Configuration
QODO_EMBED_API_KEY='your-qodo-embed-api-key'
QODO_EMBED_API_URL='https://api.qodo.ai/v1'

# LLM Provider Configuration (choose one)
# OpenRouter
OPENROUTER_API_KEY='your-openrouter-api-key'
OPENROUTER_API_URL='https://openrouter.ai/api/v1'

# OR Ollama
OLLAMA_API_URL='http://localhost:11434/api'
OLLAMA_MODEL='qwen3:4b'

# Additional Configuration
LLM_PROVIDER='openrouter'  # or 'ollama'
ENABLE_MR_REVIEW='true'
ENABLE_PROJECT_CONTEXT='true'
ENABLE_SEQUENTIAL_THINKING='true'
```

## Deployment Options

### Option 1: Docker Compose (Recommended)

1. **Install Dependencies**
   ```bash
   cd agent-reviewer
   npm install
   cd frontend
   npm install
   cd ..
   ```

2. **Build and Start Services**
   ```bash
   docker-compose up -d
   ```

3. **Access the Dashboard**
   - **Unified Interface**: http://localhost:8080
   - All frontend routes (/, /login, /reviews, etc.) are served directly
   - All API routes (/api/*, /webhook, /health) are proxied to the backend
   - Backend is not directly accessible from outside the Docker network

### Option 2: Manual Deployment

#### Backend Deployment

1. **Install Dependencies**
   ```bash
   cd agent-reviewer
   npm install
   ```

2. **Build the Application**
   ```bash
   npm run build
   ```

3. **Start the Server**
   ```bash
   npm start
   ```

#### Frontend Deployment

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Build for Production**
   ```bash
   npm run build
   ```

3. **Serve Static Files**
   Deploy the `dist` folder to your web server (nginx, Apache, etc.)

## Database Setup

The application will automatically create the required database tables on first run. Ensure your PostgreSQL database has the pgvector extension installed:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Authentication Setup

### Admin Access

1. Set the `ADMIN_SECRET_KEY` environment variable to a secure value
2. Access the dashboard at the frontend URL
3. Login with the admin secret key

### API Access

The backend API uses the `API_KEY` environment variable for authentication. Include this key in the `X-API-Key` header for API requests.

## Configuration

### Frontend Configuration

The frontend automatically connects to the backend API through the configured proxy. No additional configuration is required.

### Backend Configuration

Key configuration options:

- **Review Settings**: Enable/disable automatic merge request reviews
- **LLM Provider**: Choose between OpenRouter and Ollama
- **Sequential Thinking**: Enable advanced review analysis
- **Project Context**: Include project-specific context in reviews

## Features

### Dashboard Pages

1. **Overview Dashboard**
   - System health indicators
   - Key performance metrics
   - Quick action buttons
   - Recent activity summary

2. **Review History**
   - Complete review history with pagination
   - Advanced filtering and search
   - CSV export functionality
   - Direct links to GitLab merge requests

3. **Current Status**
   - Real-time system health monitoring
   - Queue status and job tracking
   - Auto-refresh capabilities
   - Processing statistics

4. **Analytics**
   - Review trends and performance metrics
   - Top projects by activity
   - Configurable date ranges
   - Success rate analysis

### Security Features

- Secret key-based authentication
- JWT token management
- Session persistence
- Secure API endpoints
- CORS protection

## Monitoring and Maintenance

### Health Checks

The system provides several health check endpoints:

- `/health` - Basic health check
- `/health/system` - Comprehensive system health
- `/health/embedding` - Embedding service metrics
- `/health/queue` - Queue statistics

### Logs

Monitor the application logs for:
- Authentication attempts
- API errors
- Review processing status
- System health issues

### Backup

Regularly backup:
- PostgreSQL database
- Environment configuration
- Application logs

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify DATABASE_URL is correct
   - Ensure PostgreSQL is running
   - Check pgvector extension is installed

2. **Authentication Failures**
   - Verify ADMIN_SECRET_KEY is set
   - Check JWT_SECRET is configured
   - Ensure API_KEY matches client configuration

3. **Frontend Not Loading**
   - Check if backend is running on port 3000
   - Verify proxy configuration in nginx.conf
   - Check browser console for errors

4. **Review Processing Issues**
   - Verify GitLab API token has required permissions
   - Check LLM provider configuration
   - Monitor queue status in the dashboard

### Performance Optimization

1. **Database**
   - Create indexes on frequently queried columns
   - Regular VACUUM and ANALYZE operations
   - Monitor connection pool usage

2. **Frontend**
   - Enable gzip compression
   - Configure proper caching headers
   - Use CDN for static assets

3. **Backend**
   - Monitor memory usage
   - Optimize queue processing
   - Configure appropriate timeouts

## Scaling

### Horizontal Scaling

- Deploy multiple backend instances behind a load balancer
- Use shared database and Redis for session storage
- Configure sticky sessions if needed

### Vertical Scaling

- Increase memory allocation for embedding processing
- Optimize database configuration
- Monitor CPU usage during peak loads

## Security Considerations

1. **Environment Variables**
   - Use secure secret generation
   - Rotate keys regularly
   - Store secrets securely

2. **Network Security**
   - Use HTTPS in production
   - Configure proper firewall rules
   - Implement rate limiting

3. **Database Security**
   - Use strong database passwords
   - Enable SSL connections
   - Regular security updates

## Support

For issues and questions:
1. Check the application logs
2. Review the troubleshooting section
3. Monitor system health endpoints
4. Check GitLab webhook delivery logs

## Updates

To update the dashboard:
1. Pull latest changes
2. Update dependencies: `npm install`
3. Rebuild containers: `docker-compose build`
4. Restart services: `docker-compose up -d`

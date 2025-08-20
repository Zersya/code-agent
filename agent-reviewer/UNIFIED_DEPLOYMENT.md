# Unified Port Deployment Guide

This guide explains the unified port deployment configuration where both frontend and backend services are accessible through a single port with intelligent request routing.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Port 8080 (Configurable)                │
├─────────────────────────────────────────────────────────────┤
│                  Nginx (Frontend Container)                │
├─────────────────────────────────────────────────────────────┤
│  Route Handling:                                           │
│  ┌─────────────────┬─────────────────────────────────────┐ │
│  │ Frontend Routes │ Backend Routes                      │ │
│  │ /               │ /api/*                              │ │
│  │ /login          │ /webhook                            │ │
│  │ /reviews        │ /health                             │ │
│  │ /status         │                                     │ │
│  │ /analytics      │                                     │ │
│  │ /static/*       │                                     │ │
│  └─────────────────┴─────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Internal Network                        │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │ Frontend        │    │ Backend                         │ │
│  │ (Vue.js SPA)    │    │ (Node.js/Express)              │ │
│  │ Static Files    │    │ API Endpoints                   │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Key Benefits

1. **Single Entry Point**: Only one port to expose and manage
2. **Simplified Networking**: No need to configure multiple ports or CORS
3. **Production Ready**: Nginx handles static files efficiently and proxies API requests
4. **Security**: Backend is not directly accessible from outside the Docker network
5. **Easy SSL**: Only need to configure SSL for one port
6. **Clean URLs**: No need for different domains or ports for API vs frontend

## Configuration Details

### Docker Compose Configuration

```yaml
services:
  agent-reviewer-backend:
    build:
      context: .
      dockerfile: Dockerfile
    # No ports exposed - only accessible internally
    environment:
      - PORT=3000
      # ... other environment variables
    networks:
      - agent-reviewer-network

  agent-reviewer-dashboard:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "${DASHBOARD_PORT:-8080}:80"  # Single port exposure
    depends_on:
      - agent-reviewer-backend
    networks:
      - agent-reviewer-network

networks:
  agent-reviewer-network:
    driver: bridge
```

### Nginx Routing Rules

The nginx configuration in the frontend container handles request routing:

1. **API Routes** (`/api/*`): Proxied to `agent-reviewer-backend:3000`
2. **Webhook Routes** (`/webhook`): Proxied to `agent-reviewer-backend:3000`
3. **Health Routes** (`/health`): Proxied to `agent-reviewer-backend:3000`
4. **All Other Routes**: Served by the Vue.js SPA (with fallback to index.html for client-side routing)

### Environment Variables

```bash
# Set the dashboard port (optional, defaults to 8080)
DASHBOARD_PORT=8080

# Backend configuration (same as before)
ADMIN_SECRET_KEY='your-admin-secret-key'
JWT_SECRET='your-jwt-secret-key'
# ... other variables
```

## Deployment Instructions

### Quick Start

1. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start Services**:
   ```bash
   docker-compose up -d
   ```

3. **Access Dashboard**:
   ```
   http://localhost:8080
   ```

### Custom Port

To use a different port:

```bash
# Set in .env file
DASHBOARD_PORT=3000

# Or set when starting
DASHBOARD_PORT=3000 docker-compose up -d
```

## Request Flow Examples

### Frontend Requests
- `http://localhost:8080/` → Served by nginx (index.html)
- `http://localhost:8080/login` → Served by nginx (index.html, Vue Router handles routing)
- `http://localhost:8080/reviews` → Served by nginx (index.html, Vue Router handles routing)
- `http://localhost:8080/static/app.js` → Served by nginx (static file)

### API Requests
- `http://localhost:8080/api/auth/login` → Proxied to `agent-reviewer-backend:3000/api/auth/login`
- `http://localhost:8080/api/reviews` → Proxied to `agent-reviewer-backend:3000/api/reviews`
- `http://localhost:8080/webhook` → Proxied to `agent-reviewer-backend:3000/webhook`
- `http://localhost:8080/health` → Proxied to `agent-reviewer-backend:3000/health`

## Development vs Production

### Development Mode
For development, you can still run services separately:

```bash
# Terminal 1: Backend
npm run dev:webhook

# Terminal 2: Frontend
cd frontend
npm run dev
```

Access at: `http://localhost:5173` (Vite dev server with proxy)

### Production Mode
Use Docker Compose for production:

```bash
docker-compose up -d
```

Access at: `http://localhost:8080` (Unified nginx-served interface)

## SSL/HTTPS Configuration

To add SSL support, modify the nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # ... rest of configuration
}

server {
    listen 80;
    return 301 https://$server_name$request_uri;
}
```

## Monitoring and Troubleshooting

### Check Service Status
```bash
docker-compose ps
docker-compose logs agent-reviewer-dashboard
docker-compose logs agent-reviewer-backend
```

### Test Connectivity
```bash
# Test the unified interface
npm run test:dashboard

# Test specific endpoints
curl http://localhost:8080/health
curl http://localhost:8080/api/auth/login -X POST -H "Content-Type: application/json" -d '{"secretKey":"test"}'
```

### Common Issues

1. **502 Bad Gateway**: Backend service is not running or not accessible
   - Check: `docker-compose logs agent-reviewer-backend`
   - Verify: Backend is listening on port 3000

2. **404 for API routes**: Nginx proxy configuration issue
   - Check: `docker-compose logs agent-reviewer-dashboard`
   - Verify: Nginx configuration is correct

3. **Frontend not loading**: Static file serving issue
   - Check: Frontend build completed successfully
   - Verify: Files exist in `/usr/share/nginx/html`

## Migration from Separate Ports

If migrating from a setup with separate ports:

1. **Update bookmarks/links**: Change from separate URLs to unified URL
2. **Update API base URL**: Frontend should use relative URLs (already configured)
3. **Update webhook URLs**: Change GitLab webhook URL to use the unified port
4. **Update monitoring**: Update health check URLs to use unified port

## Security Considerations

1. **Firewall**: Only expose the dashboard port (8080), not the backend port (3000)
2. **Network isolation**: Backend is only accessible within the Docker network
3. **Proxy headers**: Nginx forwards real client IP and other headers to backend
4. **Rate limiting**: Can be configured in nginx for additional protection

This unified deployment provides a cleaner, more secure, and easier-to-manage setup while maintaining all functionality.

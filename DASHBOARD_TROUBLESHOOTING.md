# Agent Reviewer Dashboard Troubleshooting Guide

This guide helps resolve common issues with the Agent Reviewer Dashboard deployment.

## 🔍 Quick Diagnosis

### Issue: 404 Not Found on Root URL

**Root Cause**: The parent `docker-compose.yml` was missing the frontend dashboard service.

**Solution**: The parent `docker-compose.yml` has been updated to include both:
- `agent-reviewer-backend` (API server)
- `agent-reviewer-dashboard` (Frontend with nginx)

## 🛠️ Step-by-Step Resolution

### 1. Verify Services are Running

```bash
# Check running containers
docker ps | grep agent_reviewer

# You should see both:
# - agent_reviewer_backend
# - agent_reviewer_dashboard
```

### 2. Run the Debug Script

```bash
# Make executable and run
chmod +x debug-dashboard-deployment.sh
./debug-dashboard-deployment.sh
```

### 3. Rebuild and Restart Services

```bash
# Stop all services
docker-compose down

# Rebuild and start (this ensures latest changes)
docker-compose up -d --build

# Check status
docker-compose ps
```

### 4. Check Logs

```bash
# Dashboard logs (nginx + frontend)
docker-compose logs -f agent-reviewer-dashboard

# Backend logs (API server)
docker-compose logs -f agent-reviewer-backend
```

### 5. Test Connectivity

```bash
# Test dashboard access
curl -I http://localhost:3000

# Test API proxy
curl http://localhost:3000/health

# Test API endpoints
curl http://localhost:3000/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"secretKey":"your-admin-secret"}'
```

## 🔧 Common Issues and Solutions

### Issue 1: Dashboard Container Not Starting

**Symptoms**: 
- `docker ps` shows only backend container
- 404 on all URLs

**Diagnosis**:
```bash
docker-compose logs agent-reviewer-dashboard
```

**Solutions**:
1. **Missing frontend build**:
   ```bash
   cd agent-reviewer/frontend
   npm install
   npm run build
   cd ../..
   docker-compose up -d --build agent-reviewer-dashboard
   ```

2. **Dockerfile issues**:
   ```bash
   # Check if Dockerfile exists
   ls -la agent-reviewer/frontend/Dockerfile
   
   # Rebuild from scratch
   docker-compose build --no-cache agent-reviewer-dashboard
   ```

### Issue 2: 502 Bad Gateway on API Routes

**Symptoms**:
- Frontend loads but API calls fail
- `/api/*` routes return 502

**Diagnosis**:
```bash
# Check if backend is reachable from dashboard container
docker exec agent_reviewer_dashboard ping agent-reviewer-backend
```

**Solutions**:
1. **Network connectivity**:
   ```bash
   # Ensure both services are on same networks
   docker network ls
   docker network inspect qodo_network
   ```

2. **Backend not ready**:
   ```bash
   # Check backend health
   docker exec agent_reviewer_backend curl http://localhost:3000/health
   ```

### Issue 3: Environment Variables

**Symptoms**:
- Authentication fails
- Services start but don't work properly

**Check**:
```bash
# Verify environment variables
docker exec agent_reviewer_backend env | grep -E "(ADMIN_SECRET_KEY|JWT_SECRET|DATABASE_URL)"
```

**Fix**:
```bash
# Update .env file
cp .env.example .env
# Edit .env with correct values
# Restart services
docker-compose down && docker-compose up -d
```

### Issue 4: Port Conflicts

**Symptoms**:
- Cannot bind to port
- Service fails to start

**Check**:
```bash
# Check what's using the port
lsof -i :3000
netstat -tulpn | grep :3000
```

**Fix**:
```bash
# Change port in .env
echo "DASHBOARD_PORT=8080" >> .env
docker-compose down && docker-compose up -d
```

## 📋 Verification Checklist

After deployment, verify these work:

- [ ] **Frontend Access**: http://localhost:3000 shows login page
- [ ] **Health Check**: http://localhost:3000/health returns 200
- [ ] **API Proxy**: http://localhost:3000/api/auth/login accepts POST
- [ ] **Webhook Endpoint**: http://localhost:3000/webhook accepts POST
- [ ] **Static Files**: CSS/JS files load correctly
- [ ] **Authentication**: Can login with admin secret key
- [ ] **Dashboard Pages**: All pages (reviews, status, analytics) load
- [ ] **API Calls**: Dashboard can fetch data from backend

## 🔍 Advanced Debugging

### Container Inspection

```bash
# Enter dashboard container
docker exec -it agent_reviewer_dashboard /bin/sh

# Check nginx config
cat /etc/nginx/conf.d/default.conf

# Check static files
ls -la /usr/share/nginx/html/

# Test internal connectivity
ping agent-reviewer-backend
curl http://agent-reviewer-backend:3000/health
```

### Network Analysis

```bash
# Inspect Docker networks
docker network inspect qodo_network
docker network inspect llm-network
docker network inspect proxy

# Check container network settings
docker inspect agent_reviewer_dashboard | grep -A 10 "Networks"
docker inspect agent_reviewer_backend | grep -A 10 "Networks"
```

### Log Analysis

```bash
# Detailed logs with timestamps
docker-compose logs -t agent-reviewer-dashboard
docker-compose logs -t agent-reviewer-backend

# Follow logs in real-time
docker-compose logs -f --tail=50 agent-reviewer-dashboard

# Nginx access logs (if available)
docker exec agent_reviewer_dashboard tail -f /var/log/nginx/access.log
docker exec agent_reviewer_dashboard tail -f /var/log/nginx/error.log
```

## 🚀 Quick Recovery Commands

```bash
# Complete reset
docker-compose down -v
docker system prune -f
docker-compose up -d --build

# Restart specific service
docker-compose restart agent-reviewer-dashboard

# Rebuild specific service
docker-compose up -d --build agent-reviewer-dashboard

# View service status
docker-compose ps
docker-compose top
```

## 📞 Getting Help

If issues persist:

1. **Run the debug script**: `./debug-dashboard-deployment.sh`
2. **Collect logs**: Save output of `docker-compose logs`
3. **Check environment**: Verify `.env` file configuration
4. **Test manually**: Use curl commands to test each endpoint
5. **Network inspection**: Check Docker network configuration

## 🎯 Expected Working State

When everything is working correctly:

```bash
$ docker ps
CONTAINER ID   IMAGE                    COMMAND                  STATUS
abc123def456   gitlab_agent-reviewer-dashboard   "/docker-entrypoint.…"   Up 2 minutes   0.0.0.0:3000->80/tcp
def456ghi789   gitlab_agent-reviewer-backend     "node dist/webhook-s…"   Up 2 minutes

$ curl -I http://localhost:3000
HTTP/1.1 200 OK
Content-Type: text/html

$ curl http://localhost:3000/health
{"status":"healthy","timestamp":"2024-01-01T12:00:00.000Z"}
```

The dashboard should be accessible at http://localhost:3000 with the login page displayed.

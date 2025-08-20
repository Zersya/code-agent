#!/bin/bash

# Debug script for Agent Reviewer Dashboard deployment issues
# This script helps diagnose common deployment problems

echo "🔍 Agent Reviewer Dashboard Deployment Debugger"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK") echo -e "${GREEN}✅ $message${NC}" ;;
        "WARN") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "ERROR") echo -e "${RED}❌ $message${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️  $message${NC}" ;;
    esac
}

# Check if Docker is running
print_status "INFO" "Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    print_status "ERROR" "Docker is not running or not accessible"
    exit 1
else
    print_status "OK" "Docker is running"
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    print_status "ERROR" "docker-compose is not installed or not in PATH"
    exit 1
else
    print_status "OK" "docker-compose is available"
fi

echo ""
print_status "INFO" "Checking container status..."

# Check running containers
BACKEND_CONTAINER=$(docker ps --filter "name=agent_reviewer_backend" --format "table {{.Names}}\t{{.Status}}" | grep -v NAMES)
DASHBOARD_CONTAINER=$(docker ps --filter "name=agent_reviewer_dashboard" --format "table {{.Names}}\t{{.Status}}" | grep -v NAMES)

if [ -z "$BACKEND_CONTAINER" ]; then
    print_status "ERROR" "Backend container (agent_reviewer_backend) is not running"
else
    print_status "OK" "Backend container: $BACKEND_CONTAINER"
fi

if [ -z "$DASHBOARD_CONTAINER" ]; then
    print_status "ERROR" "Dashboard container (agent_reviewer_dashboard) is not running"
    print_status "WARN" "This is likely the cause of your 404 error!"
else
    print_status "OK" "Dashboard container: $DASHBOARD_CONTAINER"
fi

echo ""
print_status "INFO" "Checking container logs..."

# Check backend logs for errors
if [ ! -z "$BACKEND_CONTAINER" ]; then
    echo ""
    print_status "INFO" "Recent backend logs:"
    docker logs --tail 10 agent_reviewer_backend 2>/dev/null || print_status "WARN" "Could not retrieve backend logs"
fi

# Check dashboard logs for errors
if [ ! -z "$DASHBOARD_CONTAINER" ]; then
    echo ""
    print_status "INFO" "Recent dashboard logs:"
    docker logs --tail 10 agent_reviewer_dashboard 2>/dev/null || print_status "WARN" "Could not retrieve dashboard logs"
fi

echo ""
print_status "INFO" "Checking network connectivity..."

# Check if containers can communicate
if [ ! -z "$BACKEND_CONTAINER" ] && [ ! -z "$DASHBOARD_CONTAINER" ]; then
    # Test internal connectivity
    docker exec agent_reviewer_dashboard ping -c 1 agent-reviewer-backend > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        print_status "OK" "Dashboard can reach backend internally"
    else
        print_status "ERROR" "Dashboard cannot reach backend internally"
    fi
fi

echo ""
print_status "INFO" "Checking port accessibility..."

# Check if ports are accessible
DASHBOARD_PORT=${DASHBOARD_PORT:-3000}
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$DASHBOARD_PORT > /dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$DASHBOARD_PORT)
    if [ "$HTTP_CODE" = "200" ]; then
        print_status "OK" "Dashboard is accessible on port $DASHBOARD_PORT"
    else
        print_status "WARN" "Dashboard responds with HTTP $HTTP_CODE on port $DASHBOARD_PORT"
    fi
else
    print_status "ERROR" "Dashboard is not accessible on port $DASHBOARD_PORT"
fi

echo ""
print_status "INFO" "Checking file structure..."

# Check if required files exist
if [ -f "agent-reviewer/frontend/Dockerfile" ]; then
    print_status "OK" "Frontend Dockerfile exists"
else
    print_status "ERROR" "Frontend Dockerfile missing"
fi

if [ -f "agent-reviewer/frontend/nginx.conf" ]; then
    print_status "OK" "Nginx configuration exists"
else
    print_status "ERROR" "Nginx configuration missing"
fi

if [ -d "agent-reviewer/frontend/src" ]; then
    print_status "OK" "Frontend source directory exists"
else
    print_status "ERROR" "Frontend source directory missing"
fi

echo ""
print_status "INFO" "Environment check..."

# Check environment variables
if [ -f ".env" ]; then
    print_status "OK" ".env file exists"
    
    # Check critical variables
    if grep -q "ADMIN_SECRET_KEY" .env; then
        print_status "OK" "ADMIN_SECRET_KEY is set"
    else
        print_status "WARN" "ADMIN_SECRET_KEY not found in .env"
    fi
    
    if grep -q "JWT_SECRET" .env; then
        print_status "OK" "JWT_SECRET is set"
    else
        print_status "WARN" "JWT_SECRET not found in .env"
    fi
    
    if grep -q "DASHBOARD_PORT" .env; then
        DASHBOARD_PORT_VALUE=$(grep "DASHBOARD_PORT" .env | cut -d'=' -f2)
        print_status "OK" "DASHBOARD_PORT is set to: $DASHBOARD_PORT_VALUE"
    else
        print_status "INFO" "DASHBOARD_PORT not set, using default (3000)"
    fi
else
    print_status "WARN" ".env file not found"
fi

echo ""
print_status "INFO" "Recommendations:"

if [ -z "$DASHBOARD_CONTAINER" ]; then
    echo "🔧 The dashboard container is not running. This is likely why you're getting 404 errors."
    echo "   To fix this:"
    echo "   1. Make sure the parent docker-compose.yml includes the agent-reviewer-dashboard service"
    echo "   2. Run: docker-compose up -d agent-reviewer-dashboard"
    echo "   3. Check logs: docker-compose logs agent-reviewer-dashboard"
fi

if [ -z "$BACKEND_CONTAINER" ]; then
    echo "🔧 The backend container is not running."
    echo "   To fix this:"
    echo "   1. Run: docker-compose up -d agent-reviewer-backend"
    echo "   2. Check logs: docker-compose logs agent-reviewer-backend"
fi

echo ""
echo "🚀 Quick fix commands:"
echo "   # Rebuild and restart all services"
echo "   docker-compose down && docker-compose up -d --build"
echo ""
echo "   # Check specific service logs"
echo "   docker-compose logs -f agent-reviewer-dashboard"
echo "   docker-compose logs -f agent-reviewer-backend"
echo ""
echo "   # Test the dashboard"
echo "   curl -I http://localhost:${DASHBOARD_PORT:-3000}"
echo ""
echo "   # Access the dashboard"
echo "   open http://localhost:${DASHBOARD_PORT:-3000}"

echo ""
print_status "INFO" "Debug complete!"

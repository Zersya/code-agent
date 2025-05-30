#!/bin/bash

# GitLab Agent Reviewer Setup Script
# This script helps set up the development environment

set -e

echo "🚀 GitLab Agent Reviewer Setup"
echo "================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your configuration."
    echo "⚠️  Don't forget to set your GitLab API token and other required variables!"
else
    echo "✅ .env file already exists"
fi

# Create init-scripts directory if it doesn't exist
if [ ! -d "init-scripts" ]; then
    echo "📁 Creating init-scripts directory..."
    mkdir -p init-scripts
fi

# Create docs directory if it doesn't exist
if [ ! -d "docs" ]; then
    echo "📁 Creating docs directory..."
    mkdir -p docs
fi

# Create scripts directory if it doesn't exist
if [ ! -d "scripts" ]; then
    echo "📁 Creating scripts directory..."
    mkdir -p scripts
fi

# Create temp directory if it doesn't exist
if [ ! -d "temp" ]; then
    echo "📁 Creating temp directory..."
    mkdir -p temp
fi

# Make scripts executable
if [ -f "scripts/check-database.js" ]; then
    chmod +x scripts/check-database.js
fi

echo ""
echo "🔧 Setup completed! Next steps:"
echo ""
echo "1. Edit .env file with your configuration:"
echo "   - Set GITLAB_API_TOKEN"
echo "   - Set GITLAB_API_URL"
echo "   - Set GITLAB_USERNAME"
echo "   - Configure LLM provider settings"
echo ""
echo "2. Start the services:"
echo "   docker-compose up -d"
echo ""
echo "3. Check service health:"
echo "   docker-compose ps"
echo "   node scripts/check-database.js"
echo ""
echo "4. View logs:"
echo "   docker-compose logs -f"
echo ""
echo "📚 Documentation:"
echo "   - Main README: README.md"
echo "   - PostgreSQL Setup: docs/postgresql-setup.md"
echo "   - Agent Reviewer: agent-reviewer/README.md"
echo ""
echo "🎉 Happy coding!"

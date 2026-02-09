#!/bin/bash
set -e

# ============================================================================
# AI Learning App - Backend Deployment Script
# ============================================================================
# This script handles the backend deployment process on EC2
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production

ENVIRONMENT=${1:-production}
PROJECT_DIR="$HOME/BE-AILearningApp/BE"
VENV_DIR="$PROJECT_DIR/venv"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 AI Learning App - Backend Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Environment: $ENVIRONMENT"
echo "Directory: $PROJECT_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Navigate to project directory
cd "$PROJECT_DIR" || {
    echo "❌ Error: Project directory not found"
    exit 1
}

# Create backup of current version
echo "📦 Creating backup..."
BACKUP_DIR="$HOME/backups/ai-learning-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r "$PROJECT_DIR" "$BACKUP_DIR/" 2>/dev/null || true

# Pull latest changes
echo "⬇️  Pulling latest changes..."
git stash
git pull origin main || git pull origin master
git stash pop 2>/dev/null || true

# Setup virtual environment
echo "🐍 Setting up Python virtual environment..."
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📚 Installing dependencies..."
pip install --no-cache-dir -r requirements-minimal.txt

# Run database migrations
echo "🗄️  Running database migrations..."
alembic upgrade head

# Build FAISS index if needed
if [ -d "data/question_docs_faiss_index" ]; then
    echo "🔍 FAISS index already exists, skipping build..."
else
    echo "🔍 Building FAISS index..."
    # Uncomment if you have a Python script to build FAISS
    # python scripts/build_faiss_index.py
fi

# Restart Celery workers
echo "🔄 Restarting Celery workers..."
if command -v pm2 &> /dev/null; then
    pm2 restart celery-worker 2>/dev/null || true
fi

# Restart main application
echo "🔄 Restarting application..."
if command -v pm2 &> /dev/null; then
    pm2 restart ai-learning-backend || pm2 start ecosystem.config.js --name ai-learning-backend
    pm2 save
elif command -v systemctl &> /dev/null; then
    sudo systemctl restart ai-learning-app
else
    echo "⚠️  No process manager found. Please restart manually."
fi

# Health check
echo "🏥 Running health check..."
sleep 5
if curl -f http://localhost:8000/health > /dev/null 2>&1 || \
   curl -f http://localhost:8000/api/v1/health > /dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "⚠️  Health check failed. Please verify manually."
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Backend deployment completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Backup location: $BACKUP_DIR"
echo "Logs: Check PM2 logs with 'pm2 logs ai-learning-backend'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

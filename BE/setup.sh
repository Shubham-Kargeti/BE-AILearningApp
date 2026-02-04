#!/bin/bash

# AI Learning App - Setup Script
# Run this script to set up the development environment
# Usage: chmod +x setup.sh && ./setup.sh

echo -e "\033[0;32m🚀 Setting up AI Learning App Backend...\033[0m"

# Check Python version
echo -e "\n\033[0;33m📍 Checking Python version...\033[0m"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    if [[ $PYTHON_VERSION =~ Python\ 3\.1[1-9] ]]; then
        echo -e "\033[0;32m✅ $PYTHON_VERSION\033[0m"
    else
        echo -e "\033[0;31m❌ Python 3.11+ required. Found: $PYTHON_VERSION\033[0m"
        exit 1
    fi
else
    echo -e "\033[0;31m❌ Python 3 not found. Please install Python 3.11+\033[0m"
    exit 1
fi

# Check Docker
echo -e "\n\033[0;33m📍 Checking Docker...\033[0m"
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version 2>&1)
    echo -e "\033[0;32m✅ $DOCKER_VERSION\033[0m"
else
    echo -e "\033[0;33m⚠️  Docker not found. Install Docker to use docker-compose.\033[0m"
fi

# Create virtual environment
echo -e "\n\033[0;33m📍 Creating virtual environment...\033[0m"
if [ -d "venv" ]; then
    echo -e "\033[0;32m✅ Virtual environment already exists\033[0m"
else
    python3 -m venv venv
    echo -e "\033[0;32m✅ Virtual environment created\033[0m"
fi

# Activate virtual environment
echo -e "\n\033[0;33m📍 Activating virtual environment...\033[0m"
source venv/bin/activate

# Upgrade pip
echo -e "\n\033[0;33m📍 Upgrading pip...\033[0m"
python -m pip install --upgrade pip

# Install dependencies
echo -e "\n\033[0;33m📍 Installing dependencies...\033[0m"
pip install -r requirements.txt
if [ $? -eq 0 ]; then
    echo -e "\033[0;32m✅ Dependencies installed\033[0m"
else
    echo -e "\033[0;31m❌ Failed to install dependencies\033[0m"
    exit 1
fi

# Create .env file
echo -e "\n\033[0;33m📍 Setting up environment configuration...\033[0m"
if [ -f ".env" ]; then
    echo -e "\033[0;32m✅ .env file already exists\033[0m"
else
    cp .env.example .env
    echo -e "\033[0;32m✅ Created .env file from .env.example\033[0m"
    echo -e "\033[0;33m⚠️  Please edit .env and add your API keys!\033[0m"
fi

# Start Docker containers
echo -e "\n\033[0;33m📍 Starting infrastructure with Docker Compose...\033[0m"
read -p "Start PostgreSQL, Redis, and MinIO? (y/n): " START_DOCKER
if [ "$START_DOCKER" = "y" ] || [ "$START_DOCKER" = "Y" ]; then
    docker-compose up -d postgres redis minio
    if [ $? -eq 0 ]; then
        echo -e "\033[0;32m✅ Infrastructure services started\033[0m"
        echo -e "\033[0;36m   - PostgreSQL: localhost:5432\033[0m"
        echo -e "\033[0;36m   - Redis: localhost:6379\033[0m"
        echo -e "\033[0;36m   - MinIO: localhost:9000 (Console: localhost:9001)\033[0m"
        
        # Wait for services
        echo -e "\n\033[0;33m⏳ Waiting for services to be ready...\033[0m"
        sleep 10
    fi
fi

# Run migrations
echo -e "\n\033[0;33m📍 Running database migrations...\033[0m"
read -p "Run Alembic migrations? (y/n): " RUN_MIGRATIONS
if [ "$RUN_MIGRATIONS" = "y" ] || [ "$RUN_MIGRATIONS" = "Y" ]; then
    alembic upgrade head
    if [ $? -eq 0 ]; then
        echo -e "\033[0;32m✅ Database migrations completed\033[0m"
    else
        echo -e "\033[0;33m⚠️  Migration failed. Make sure PostgreSQL is running.\033[0m"
    fi
fi

echo -e "\n\033[0;32m✨ Setup Complete! ✨\033[0m"
echo -e "\n\033[0;36mNext steps:\033[0m"
echo -e "\033[0;37m1. Edit .env file with your API keys (GROQ_API_KEY, etc.)\033[0m"
echo -e "\033[0;37m2. Start the FastAPI server:\033[0m"
echo -e "\033[0;33m   uvicorn app.main:app --reload\033[0m"
echo -e "\033[0;37m3. Start Celery worker (new terminal):\033[0m"
echo -e "\033[0;33m   celery -A app.core.celery_app worker --loglevel=info\033[0m"
echo -e "\033[0;37m4. Visit http://localhost:8000/docs for API documentation\033[0m"
echo -e "\n\033[0;36mOptional: Start all services with docker-compose:\033[0m"
echo -e "\033[0;33m   docker-compose up -d\033[0m"
echo ""

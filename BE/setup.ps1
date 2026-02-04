# AI Learning App - Setup Script
# Run this script to set up the development environment

Write-Host "🚀 Setting up AI Learning App Backend..." -ForegroundColor Green

# Check Python version
Write-Host "`n📍 Checking Python version..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1
if ($pythonVersion -match "Python 3\.1[1-9]") {
    Write-Host "✅ $pythonVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Python 3.11+ required. Found: $pythonVersion" -ForegroundColor Red
    exit 1
}

# Check Docker
Write-Host "`n📍 Checking Docker..." -ForegroundColor Yellow
$dockerVersion = docker --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ $dockerVersion" -ForegroundColor Green
} else {
    Write-Host "⚠️  Docker not found. Install Docker to use docker-compose." -ForegroundColor Yellow
}

# Create virtual environment
Write-Host "`n📍 Creating virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "✅ Virtual environment already exists" -ForegroundColor Green
} else {
    python -m venv venv
    Write-Host "✅ Virtual environment created" -ForegroundColor Green
}

# Activate virtual environment
Write-Host "`n📍 Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

# Upgrade pip
Write-Host "`n📍 Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip

# Install dependencies
Write-Host "`n📍 Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Create .env file
Write-Host "`n📍 Setting up environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
} else {
    Copy-Item .env.example .env
    Write-Host "✅ Created .env file from .env.example" -ForegroundColor Green
    Write-Host "⚠️  Please edit .env and add your API keys!" -ForegroundColor Yellow
}

# Start Docker containers
Write-Host "`n📍 Starting infrastructure with Docker Compose..." -ForegroundColor Yellow
$startDocker = Read-Host "Start PostgreSQL, Redis, and MinIO? (y/n)"
if ($startDocker -eq "y") {
    docker-compose up -d postgres redis minio
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Infrastructure services started" -ForegroundColor Green
        Write-Host "   - PostgreSQL: localhost:5432" -ForegroundColor Cyan
        Write-Host "   - Redis: localhost:6379" -ForegroundColor Cyan
        Write-Host "   - MinIO: localhost:9000 (Console: localhost:9001)" -ForegroundColor Cyan
        
        # Wait for services
        Write-Host "`n⏳ Waiting for services to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
    }
}

# Run migrations
Write-Host "`n📍 Running database migrations..." -ForegroundColor Yellow
$runMigrations = Read-Host "Run Alembic migrations? (y/n)"
if ($runMigrations -eq "y") {
    alembic upgrade head
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database migrations completed" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Migration failed. Make sure PostgreSQL is running." -ForegroundColor Yellow
    }
}

Write-Host "`n✨ Setup Complete! ✨" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env file with your API keys (GROQ_API_KEY, etc.)" -ForegroundColor White
Write-Host "2. Start the FastAPI server:" -ForegroundColor White
Write-Host "   uvicorn app.main:app --reload" -ForegroundColor Yellow
Write-Host "3. Start Celery worker (new terminal):" -ForegroundColor White
Write-Host "   celery -A app.core.celery_app worker --loglevel=info" -ForegroundColor Yellow
Write-Host "4. Visit http://localhost:8000/docs for API documentation" -ForegroundColor White
Write-Host "`nOptional: Start all services with docker-compose:" -ForegroundColor Cyan
Write-Host "   docker-compose up -d" -ForegroundColor Yellow

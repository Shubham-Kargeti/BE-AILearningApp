# Deployment Guide

## Prerequisites

### GitHub Secrets Configuration

Add the following secrets to your GitHub repository (Settings → Secrets → Actions):

1. **AWS_ACCESS_KEY_ID** - AWS access key for deployment
2. **AWS_SECRET_ACCESS_KEY** - AWS secret key for deployment
3. **EC2_SSH_PRIVATE_KEY** - Contents of your PEM file for SSH access
4. **EC2_HOST** - Your EC2 instance IP (e.g., 13.126.216.128)
5. **DOCKERHUB_USERNAME** - Docker Hub username (optional, for Docker builds)
6. **DOCKERHUB_TOKEN** - Docker Hub token (optional, for Docker builds)

### EC2 Server Setup

Ensure your EC2 instance has:

1. **Git** installed and repository cloned at `~/BE-AILearningApp`
2. **Python 3.11+** with virtual environment at `~/BE-AILearningApp/BE/venv`
3. **PM2** installed globally (`npm install -g pm2`)
4. **PostgreSQL** running locally or accessible
5. **Security Group** allowing inbound traffic on port 8000

## CI/CD Workflows

### 1. Continuous Integration (ci.yml)

**Triggers:**
- Push to `master` or `develop` branches
- Pull requests to `master` or `develop` branches

**Jobs:**
- **Test**: Runs unit tests with PostgreSQL and Redis services
- **Lint**: Checks code formatting (Black) and linting (Ruff)
- **Security**: Scans for vulnerabilities (Safety, Bandit)

### 2. Continuous Deployment (cd.yml)

**Triggers:**
- Push to `master` branch (automatic deployment)
- Git tags matching `v*.*.*` (versioned releases)
- Manual trigger via workflow_dispatch

**Jobs:**
- **Deploy**: SSH into EC2, pull code, install deps, run migrations, restart PM2
- **Docker Build**: Builds and pushes Docker image (only for tagged releases)

### 3. Docker Compose Test (docker-compose-test.yml)

**Triggers:**
- Pull requests that modify Docker-related files

**Jobs:**
- Tests docker-compose configuration
- Verifies services start correctly

## Deployment Process

### Automatic Deployment

1. **Push to master:**
   ```bash
   git push origin master
   ```
   This triggers automatic deployment to production.

2. **Create a release:**
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```
   This deploys AND creates a Docker image.

### Manual Deployment

1. Go to GitHub Actions tab
2. Select "CD - Deploy to Production"
3. Click "Run workflow"
4. Select branch and run

## Server Setup Commands

### Initial Setup on EC2

```bash
# Install Node.js and PM2
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
sudo npm install -g pm2

# Clone repository
cd ~
git clone https://github.com/Shubham-Kargeti/BE-AILearningApp.git
cd BE-AILearningApp/BE

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --no-cache-dir -r requirements-minimal.txt

# Create logs directory
mkdir -p ~/logs

# Setup PM2 to start on boot
pm2 startup systemd
# Run the command it outputs
pm2 save
```

### Environment Variables

Create `.env` file on server:

```bash
cd ~/BE-AILearningApp/BE
nano .env
```

Add production values:

```env
ENVIRONMENT=production
DEBUG=False
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/ai_learning_db
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=<generate-strong-secret>
GROQ_API_KEY=<your-groq-api-key>
CORS_ORIGINS=["https://yourdomain.com"]
```

## Monitoring

### View PM2 Logs
```bash
pm2 logs ai-learning-backend
```

### Check Application Status
```bash
pm2 status
pm2 monit
```

### View Deployment Logs
Check GitHub Actions tab for detailed deployment logs.

## Rollback

If deployment fails:

```bash
# SSH into server
ssh -i your-key.pem ec2-user@13.126.216.128

# Navigate to project
cd ~/BE-AILearningApp/BE

# Checkout previous commit
git log --oneline -n 5
git checkout <previous-commit-hash>

# Restart PM2
pm2 restart ai-learning-backend
```

## Security Notes

1. Never commit `.env` files or secrets
2. Rotate SSH keys and AWS credentials regularly
3. Use GitHub environments for production protection
4. Enable branch protection rules for master
5. Review security scan results in CI

## Troubleshooting

### Deployment fails at SSH step
- Verify EC2_SSH_PRIVATE_KEY secret is correct
- Check EC2 security group allows SSH (port 22)
- Ensure EC2_HOST is the correct IP address

### Application won't start
- Check PM2 logs: `pm2 logs ai-learning-backend`
- Verify `.env` file exists and has correct values
- Check database connection
- Ensure virtual environment has dependencies installed

### Tests fail in CI
- Check if services (PostgreSQL, Redis) started correctly
- Review test logs in GitHub Actions
- Ensure requirements-minimal.txt has all test dependencies

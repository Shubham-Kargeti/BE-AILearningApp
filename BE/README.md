# AI Learning App - Backend

Production-ready FastAPI backend with SQLAlchemy 2.x (async), Alembic, PostgreSQL, Redis, S3, and Celery.

## 🏗️ Architecture

- **FastAPI** - Modern async web framework
- **SQLAlchemy 2.x** - Async ORM with PostgreSQL
- **Alembic** - Database migrations
- **Redis** - Caching, rate limiting, OTP storage, distributed locks
- **S3/MinIO** - Document storage
- **Celery** - Async task queue (question generation, score release)
- **JWT** - Token-based authentication with refresh tokens
- **Structlog** - JSON structured logging
- **Prometheus** - Metrics and monitoring
- **Sentry** - Error tracking and performance monitoring

## 📋 Features

- ✅ Email-based OTP authentication
- ✅ JWT access + refresh token system
- ✅ Async database operations (SQLAlchemy 2.x)
- ✅ S3-compatible document storage
- ✅ Background job processing (Celery)
- ✅ Rate limiting
- ✅ Request ID tracking
- ✅ Structured logging (JSON)
- ✅ Prometheus metrics
- ✅ Sentry error tracking
- ✅ Database migrations (Alembic)
- ✅ Docker Compose setup

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Docker & Docker Compose (for local development)
- PostgreSQL 16+
- Redis 7+

### Installation

1. **Clone the repository**
```bash
cd BE-AILearningApp/BE
```

2. **Create virtual environment**
```bash
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Start infrastructure with Docker Compose**
```bash
docker-compose up -d postgres redis minio
```

6. **Run database migrations**
```bash
alembic upgrade head
```

7. **Start the application**
```bash
uvicorn app.main:app --reload
```

8. **Start Celery worker (separate terminal)**
```bash
celery -A app.core.celery_app worker --loglevel=info
```

## 🐳 Docker Compose

Start all services:
```bash
docker-compose up -d
```

Services:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001
- **Flower (Celery)**: http://localhost:5555
- **Metrics**: http://localhost:8000/metrics

## 📚 API Documentation

Interactive API documentation available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

#### Authentication
- `POST /api/v1/auth/request-otp` - Request OTP for email
- `POST /api/v1/auth/verify-otp` - Verify OTP and get tokens
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout and revoke token

#### Users
- `GET /api/v1/users/me` - Get current user
- `PUT /api/v1/users/me` - Update user profile

#### Job Descriptions
- `POST /api/v1/upload-jd` - Upload job description
- `GET /api/v1/job-descriptions` - List job descriptions

#### Questions
- `POST /api/v1/generate-questions` - Generate MCQ questions
- `GET /api/v1/questions/{jd_id}` - Get questions for JD

#### Test Sessions
- `POST /api/v1/test-sessions` - Start test session
- `POST /api/v1/test-sessions/{session_id}/submit` - Submit answer
- `GET /api/v1/test-sessions/{session_id}/results` - Get results

## 🗄️ Database Migrations

Create new migration:
```bash
alembic revision --autogenerate -m "description"
```

Apply migrations:
```bash
alembic upgrade head
```

Rollback:
```bash
alembic downgrade -1
```

## 📊 Monitoring

### Prometheus Metrics
Access metrics at: http://localhost:8000/metrics

Custom metrics:
- `questions_generated_total` - Questions generated
- `test_sessions_total` - Test sessions
- `test_scores_percentage` - Score distribution
- `otp_requests_total` - OTP requests
- `auth_attempts_total` - Auth attempts

### Celery Monitoring (Flower)
Access at: http://localhost:5555

### Sentry
Configure `SENTRY_DSN` in `.env` for error tracking.

## 🔒 Security

- JWT-based authentication
- OTP email verification
- Rate limiting on sensitive endpoints
- CORS protection
- Input validation (Pydantic)
- SQL injection protection (SQLAlchemy)
- Secure password hashing (bcrypt)

## 📁 Project Structure

```
BE/
├── alembic/              # Database migrations
├── app/
│   ├── api/              # API endpoints
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── admin.py
│   │   ├── upload_jd.py
│   │   ├── mcq_generation.py
│   │   └── test_session.py
│   ├── core/             # Core functionality
│   │   ├── celery_app.py
│   │   ├── dependencies.py
│   │   ├── email.py
│   │   ├── logging.py
│   │   ├── metrics.py
│   │   ├── redis.py
│   │   ├── security.py
│   │   ├── sentry.py
│   │   ├── storage.py
│   │   └── tasks/
│   ├── db/               # Database
│   │   ├── base.py
│   │   ├── models.py
│   │   └── session.py
│   ├── models/           # Pydantic schemas
│   ├── utils/            # Utilities
│   └── main.py           # FastAPI app
├── config.py             # Configuration
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── alembic.ini
```

## 🧪 Testing

Run tests:
```bash
pytest
```

With coverage:
```bash
pytest --cov=app --cov-report=html
```

## 🚀 Deployment

### Environment Variables
Set all required environment variables in production:
- Change `JWT_SECRET_KEY`
- Configure production database URL
- Set up SMTP credentials
- Configure Sentry DSN
- Set `ENVIRONMENT=production`
- Set `DEBUG=False`

### Production Checklist
- [ ] Configure production database
- [ ] Set strong JWT secret
- [ ] Configure email SMTP
- [ ] Set up Sentry monitoring
- [ ] Configure CORS origins
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Set up log aggregation
- [ ] Configure auto-scaling

## 📝 License

[Your License]

## 👥 Contributors

[Your Team]

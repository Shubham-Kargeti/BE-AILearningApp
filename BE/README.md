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
- ✅ **Azure AD SSO authentication** (Microsoft 365 / Nagarro emails)
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
- `POST /api/v1/auth/login` - Simple login (testing/development)
- `POST /api/v1/auth/sso/azure/exchange` - Exchange a validated MSAL ID token for application JWTs
- `GET /api/v1/auth/sso/azure/login` - **Azure AD SSO login** (production)
- `GET /api/v1/auth/sso/azure/callback` - Azure AD callback (internal)
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

## FAISS Vector Index (Course Recommendations) 🔎

The project includes tooling to build a FAISS index used by the course recommendation endpoint.

- Local build script: `BE/app/vector_db/build_course_vector_index.py` (also wrapped by `BE/scripts/build_faiss_index.ps1`).
- CI Workflow: `.github/workflows/faiss_ingest.yml` runs on push or manual dispatch, downloads `Courses Masterdata.xlsx` (if `COURSES_MASTER_URL` secret provided), builds the FAISS index and uploads it as a workflow artifact.

To build locally, place the master spreadsheet at `BE/data/Courses Masterdata.xlsx` and run:
```powershell
python BE/app/vector_db/build_course_vector_index.py --excel BE/data/"Courses Masterdata.xlsx" --out BE/data/course_faiss_index
```

On CI, set `COURSES_MASTER_URL` as a GitHub secret pointing to a downloadable file (or commit the file to `BE/data/` in a protected branch) so the workflow can build the index.


### Azure AD SSO Configuration

#### MSAL frontend token exchange (current flow)

The React application signs in with MSAL, then exchanges its Microsoft ID token for
the application's existing access/refresh JWT pair:

```http
POST /api/v1/auth/sso/azure/exchange
Content-Type: application/json

{
  "id_token": "<MSAL authentication result idToken>"
}
```

The response intentionally matches `/api/v1/auth/login`, including `role` and
`candidate_id`, so existing API authorization continues to use the application JWT:

```json
{
  "access_token": "<application JWT>",
  "refresh_token": "<application refresh JWT>",
  "token_type": "bearer",
  "role": "candidate",
  "candidate_id": "cand_..."
}
```

Required backend environment values:

```env
# Must be the same IDs used by VITE_CLIENT_ID and VITE_TENANT_ID in the SPA.
AZURE_CLIENT_ID=00000000-0000-0000-0000-000000000000
AZURE_TENANT_ID=00000000-0000-0000-0000-000000000000

# Pydantic list syntax; change this only when another workforce domain is approved.
AZURE_ALLOWED_EMAIL_DOMAINS=["nagarro.com"]

# Create a minimal candidate profile when an allowed employee signs in for the first time.
AZURE_AUTO_PROVISION_CANDIDATES=true
AZURE_JWKS_CACHE_TTL_SECONDS=3600
AZURE_HTTP_TIMEOUT_SECONDS=5
```

`AZURE_CLIENT_SECRET` is not required by the MSAL token-exchange endpoint. It is only
used by the older server-initiated callback flow. Run `alembic upgrade head` before
deploying so users can be bound to their immutable Azure tenant/object IDs.

For production with Azure AD SSO (Nagarro emails):

1. **Register Azure AD Application**
   - See `AZURE_AD_SSO_SETUP.md` for detailed steps
   - Configure redirect URI for production domain

2. **Set Azure AD Environment Variables**
   ```bash
   AZURE_CLIENT_ID=your-production-client-id
   AZURE_CLIENT_SECRET=your-production-secret
   AZURE_TENANT_ID=your-tenant-id
   AZURE_REDIRECT_URI=https://api.yourdomain.com/api/v1/auth/sso/azure/callback
   ```

3. **Verify Configuration**
   ```bash
   python scripts/check_sso_config.py
   ```

### Environment Variables
Set all required environment variables in production:
- Change `JWT_SECRET_KEY`
- Configure production database URL
- Set up SMTP credentials
- Configure Sentry DSN
- **Set Azure AD credentials** (see above)
- Set `ENVIRONMENT=production`
- Set `DEBUG=False`

### Production Checklist
- [ ] Configure production database
- [ ] Set strong JWT secret
- [ ] **Register and configure Azure AD app**
- [ ] **Set Azure AD environment variables**
- [ ] Configure email SMTP
- [ ] Set up Sentry monitoring
- [ ] Configure CORS origins
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Set up log aggregation
- [ ] Configure auto-scaling

## 📖 Documentation

- **[AZURE_AD_SSO_SETUP.md](AZURE_AD_SSO_SETUP.md)** - Complete Azure AD SSO setup guide
- **[SSO_IMPLEMENTATION_SUMMARY.md](SSO_IMPLEMENTATION_SUMMARY.md)** - SSO implementation overview
- **[TESTING_MODE.md](TESTING_MODE.md)** - Authentication testing guide
- **[HLD.md](HLD.md)** - High-Level Design document

## 📝 License

[Your License]

## 👥 Contributors

[Your Team]

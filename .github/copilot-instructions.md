# AI Learning App - Copilot Instructions

## Project Overview

Full-stack AI-powered assessment platform with FastAPI backend and React/TypeScript frontend. Creates role-specific technical assessments using RAG (Retrieval-Augmented Generation), manages question banks, and conducts candidate testing with analytics.

**Key Technologies**: FastAPI + SQLAlchemy 2.x (async), PostgreSQL, Redis, Celery, React 19, Vite, Material-UI, Vector DB (FAISS)

## Architecture

### Backend (`BE/`)
- **Framework**: FastAPI with async/await patterns throughout
- **Database**: SQLAlchemy 2.x with async engine (`asyncpg` driver for PostgreSQL)
- **Background Jobs**: Celery for question generation, score release, and long-running tasks
- **Storage**: MinIO/S3 for document uploads (JDs, CVs, question bank docs)
- **Vector DB**: FAISS index for RAG-powered question generation from uploaded documents
- **Authentication**: JWT (access + refresh tokens), Azure AD SSO, Email OTP
- **Caching**: Redis for OTP storage, rate limiting, distributed locks (currently disabled in production)

### Frontend (`FE/`)
- **Framework**: React 19 + TypeScript, Vite bundler
- **UI Library**: Material-UI (MUI) v7
- **Routing**: React Router v7
- **State**: Component state + localStorage for auth tokens
- **API**: Custom `apiCall` wrapper using `fetch` with JWT bearer tokens

### Critical Architectural Patterns

1. **Async Everything**: All database operations use `async def` and SQLAlchemy 2.x async sessions
   - Example: `async with get_db() as db:` from `app.core.dependencies`
   - Never use sync SQLAlchemy patterns or blocking operations

2. **RAG-First Question Generation** (`app/services/question_generator.py`):
   - Query FAISS vector store with `doc_ingest.query_text(topic, top_k=5)`
   - If retrieval confidence sufficient → ground LLM prompts with snippets
   - Otherwise → fallback to LLM-only generation
   - All questions persist to `QuestionBank` table with `source_type` (rag/ai/manual)

3. **Service Layer Pattern**:
   - Business logic in `app/services/` (e.g., `question_generator.py`, `assessment_generator.py`)
   - API routes in `app/api/` call services, not direct DB operations
   - Services use sync `sessionmaker` for Celery tasks, async sessions for API requests

4. **Role-Based Access**:
   - Admin emails hardcoded in `config.ADMIN_EMAILS` for MVP
   - Azure AD domain-based admin detection (e.g., `@nagarro.com`)
   - Candidates access assessments via tokenized URLs (`AssessmentToken` model)

## Development Workflows

### Backend Setup
```powershell
cd BE
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
docker-compose up -d postgres redis minio  # Start infrastructure
alembic upgrade head                       # Run migrations
uvicorn app.main:app --reload              # Start API (port 8000)
celery -A app.core.celery_app worker --loglevel=info  # Separate terminal
```

### Frontend Setup
```powershell
cd FE
npm install
npm run dev  # Vite dev server (port 5173)
```

### Database Migrations (Alembic)
- **Create**: `alembic revision --autogenerate -m "description"`
- **Apply**: `alembic upgrade head`
- **Rollback**: `alembic downgrade -1`
- Naming convention: `YYYYMMDD_NNN_description.py` (see `alembic/versions/`)
- Always import models in `alembic/env.py` for autogenerate to detect changes

### Common Development Commands (Makefile)
- `make dev` - Start uvicorn with reload
- `make celery` - Run Celery worker with queues: default, questions, scores, emails
- `make migrate` - Apply all pending migrations
- `make docker-up` - Start all Docker Compose services

## Project-Specific Conventions

### Backend Code Patterns

1. **Configuration**: All settings in `config.py` via `pydantic_settings.BaseSettings`
   - Access with `get_settings()` (cached via `@lru_cache`)
   - Environment variables override defaults (`.env` file)

2. **Error Handling**: Use custom error codes from `app.core.error_handlers.ERROR_CODES`
   - Return `ValidationErrorResponse` for client errors
   - Structured logging with `structlog` (JSON output)

3. **API Structure**:
   ```python
   # Standard pattern for endpoints
   @router.post("/generate-questions")
   async def generate_questions(
       request: GenerateQuestionsRequest,
       db: AsyncSession = Depends(get_db),
       current_user: dict = Depends(get_current_user)
   ):
       # Business logic in service layer
       result = await question_service.generate(db, request, current_user)
       return result
   ```

4. **Database Models** (`app/db/models.py`):
   - All models inherit from `Base` (declarative base)
   - Use mixins: `TimestampMixin` (created_at, updated_at), `SoftDeleteMixin`
   - Relationships: eager loading with `selectinload()` for async queries
   - Example: `Assessment`, `Question`, `QuestionBank`, `TestSession`, `ScreeningResponse`

5. **Celery Tasks**:
   - Decorated with `@celery_app.task`
   - Use sync database sessions from `app.db.session.get_db_sync_engine()`
   - Track task status in `CeleryTask` model

### Frontend Code Patterns

1. **Component Structure**:
   - Containers: `FE/src/containers/` (pages with logic)
   - Components: `FE/src/components/` (reusable UI elements)
   - No global state library - use component state + props

2. **API Calls** (`FE/src/API/services.ts`):
   ```typescript
   // Centralized service pattern
   export const assessmentService = {
     getAll: () => apiCall(`${BASE_URL}/assessments`, "GET"),
     create: (data) => apiCall(`${BASE_URL}/assessments`, "POST", data),
   };
   ```
   - Always use `apiCall` wrapper (handles auth headers)
   - Auth token stored in `localStorage.getItem("authToken")`

3. **Routing**:
   - Admin routes: `/admin/*` (protected by `adminProtectedRoute`)
   - Candidate routes: `/candidate/*` or tokenized assessment URLs
   - Auth routes: `/login`, `/signup`

## Key Integration Points

1. **Document Upload → Skill Extraction**:
   - Upload via `POST /api/v1/upload-jd` → S3/MinIO
   - Extract skills: `POST /api/v1/admin/extract-candidate-skills` (LLM parses CV/JD)
   - Auto-populate `CandidateInfo` fields (name, email, experience)

2. **Question Generation Flow**:
   - Upload question bank doc → `POST /api/v1/question-docs/upload`
   - Build FAISS index → `scripts/build_faiss_index.ps1`
   - Generate questions → `POST /api/v1/generate-questions` (Celery task)
   - Review drafts → `GET /api/v1/question-bank` (admin UI)

3. **Assessment Flow**:
   - Admin creates assessment → `POST /api/v1/assessments`
   - Publish → generates `AssessmentToken` with unique URL
   - Candidate accesses → `GET /api/v1/candidates/assessment/{token}`
   - Submit answers → `POST /api/v1/candidates/assessment/{token}/submit`
   - View results → `GET /api/v1/candidates/assessment/{token}/results`

4. **Experience-Based Difficulty**:
   - If `auto_adjust_by_experience` enabled, `assessment_generator.py` queries `Question` table filtering by experience level (0-2 years → easy, 3-5 → medium, 6+ → hard)
   - Uses `question_experience_level` column

## Testing & Debugging

- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **Celery Monitor**: http://localhost:5555 (Flower UI)
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **Logs**: Structured JSON logs via `structlog` (check console or Sentry)
- **Database**: Direct connection with `psql -h localhost -U postgres -d ai_learning_db`

## Common Pitfalls

1. **Async Sessions**: Never use `.commit()` on async sessions - use `await db.commit()`
2. **Celery Task Context**: Tasks run in separate processes - cannot access FastAPI request context
3. **CORS**: Frontend origins must be in `config.CORS_ORIGINS` (default: localhost:3000, localhost:5173)
4. **Redis Disabled**: Redis imports commented out in `app/main.py` - do not rely on Redis caching in production
5. **Migration Conflicts**: Multiple heads in Alembic history - use merge migrations (`20260119_001_merge_heads.py` example)
6. **S3 URLs**: MinIO uses `http://localhost:9000` in dev - production should use AWS S3 with `S3_USE_SSL=true`

## File References

- Backend entry: [BE/app/main.py](BE/app/main.py)
- Config: [BE/config.py](BE/config.py)
- Models: [BE/app/db/models.py](BE/app/db/models.py)
- Schemas: [BE/app/models/schemas.py](BE/app/models/schemas.py)
- Question generator: [BE/app/services/question_generator.py](BE/app/services/question_generator.py)
- Frontend API: [FE/src/API/services.ts](FE/src/API/services.ts)
- Frontend entry: [FE/src/main.tsx](FE/src/main.tsx)
- User guides: [USER_GUIDE.md](USER_GUIDE.md), [USER_GUIDE_ADMIN.md](USER_GUIDE_ADMIN.md)

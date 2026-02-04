"""Add Candidate, Assessment, and related models

Revision ID: 004_cand_assess
Revises: 003_add_user_streaks
Create Date: 2025-12-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004_cand_assess'
down_revision = '003_add_user_streaks'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create candidates table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS candidates (
            id SERIAL PRIMARY KEY,
            candidate_id VARCHAR(100) NOT NULL UNIQUE,
            user_id INTEGER REFERENCES users(id),
            full_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(20),
            experience_level VARCHAR(50) NOT NULL,
            skills JSON DEFAULT '{}',
            availability_percentage INTEGER DEFAULT 100,
            jd_file_id VARCHAR(100),
            cv_file_id VARCHAR(100),
            portfolio_file_id VARCHAR(100),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    
    # Create indexes for candidates if they don't exist
    op.execute("CREATE INDEX IF NOT EXISTS ix_candidates_email ON candidates(email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_candidates_user_id ON candidates(user_id)")
    
    # Create assessments table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS assessments (
            id SERIAL PRIMARY KEY,
            assessment_id VARCHAR(100) NOT NULL UNIQUE,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            job_title VARCHAR(255) NOT NULL,
            jd_id VARCHAR(100) REFERENCES job_descriptions(jd_id),
            required_skills JSON DEFAULT '{}',
            required_roles JSON DEFAULT '[]',
            question_set_id VARCHAR(100) REFERENCES question_sets(question_set_id),
            assessment_method VARCHAR(50) NOT NULL,
            duration_minutes INTEGER DEFAULT 30,
            is_questionnaire_enabled BOOLEAN DEFAULT true,
            is_interview_enabled BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            is_published BOOLEAN DEFAULT false,
            created_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    
    # Create indexes for assessments if they don't exist
    op.execute("CREATE INDEX IF NOT EXISTS ix_assessments_title ON assessments(title)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_assessments_is_published ON assessments(is_published)")
    
    # Create assessment_applications table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS assessment_applications (
            id SERIAL PRIMARY KEY,
            application_id VARCHAR(100) NOT NULL UNIQUE,
            candidate_id INTEGER NOT NULL REFERENCES candidates(id),
            assessment_id INTEGER NOT NULL REFERENCES assessments(id),
            test_session_id VARCHAR(100) REFERENCES test_sessions(session_id),
            status VARCHAR(50) NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            candidate_availability INTEGER NOT NULL,
            submitted_skills JSON DEFAULT '{}',
            role_applied_for VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(candidate_id, assessment_id)
        )
    """)
    
    # Create indexes for assessment_applications if they don't exist
    op.execute("CREATE INDEX IF NOT EXISTS ix_assessment_applications_status ON assessment_applications(status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_assessment_applications_created_at ON assessment_applications(created_at)")
    
    # Create uploaded_documents table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS uploaded_documents (
            id SERIAL PRIMARY KEY,
            file_id VARCHAR(100) NOT NULL UNIQUE,
            candidate_id INTEGER REFERENCES candidates(id),
            user_id INTEGER REFERENCES users(id),
            original_filename VARCHAR(500) NOT NULL,
            file_type VARCHAR(50) NOT NULL,
            document_category VARCHAR(50) NOT NULL,
            s3_key VARCHAR(500) NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            extracted_text TEXT,
            extraction_preview VARCHAR(1000),
            is_encrypted BOOLEAN DEFAULT true,
            encryption_method VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    
    # Create indexes for uploaded_documents if they don't exist
    op.execute("CREATE INDEX IF NOT EXISTS ix_uploaded_documents_candidate_id ON uploaded_documents(candidate_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_uploaded_documents_document_type ON uploaded_documents(document_category)")
    
    # Create skills table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS skills (
            id SERIAL PRIMARY KEY,
            skill_id VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            category VARCHAR(100) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    
    # Create indexes for skills if they don't exist
    op.execute("CREATE INDEX IF NOT EXISTS ix_skills_category ON skills(category)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_skills_name ON skills(name)")
    
    # Create roles table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS roles (
            id SERIAL PRIMARY KEY,
            role_id VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT,
            department VARCHAR(100),
            required_skills JSON DEFAULT '{}',
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    
    # Create indexes for roles if they don't exist
    op.execute("CREATE INDEX IF NOT EXISTS ix_roles_name ON roles(name)")


def downgrade() -> None:
    # Drop tables in reverse order
    op.execute("DROP TABLE IF EXISTS roles CASCADE")
    op.execute("DROP TABLE IF EXISTS skills CASCADE")
    op.execute("DROP TABLE IF EXISTS uploaded_documents CASCADE")
    op.execute("DROP TABLE IF EXISTS assessment_applications CASCADE")
    op.execute("DROP TABLE IF EXISTS assessments CASCADE")
    op.execute("DROP TABLE IF EXISTS candidates CASCADE")


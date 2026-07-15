"""create employee onboarding tracking tables

Revision ID: a1b2c3d4e5f6
Revises: 75181fa1a5e4
Create Date: 2026-07-07 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "75181fa1a5e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create employee onboarding tracking tables."""
    
    # Create enum type for module status using DO block to handle duplicates
    op.execute("""
DO $$ BEGIN
    CREATE TYPE module_status_enum AS ENUM ('LOCKED', 'NOT_STARTED', 'VIDEO_IN_PROGRESS', 'VIDEO_COMPLETED', 'QUIZ_IN_PROGRESS', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
""")

    # Table 1: Onboarding Module Employee Progress (Main mapping)
    op.create_table(
        "onboarding_module_employee_progress",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "module_id",
            sa.Integer(),
            sa.ForeignKey("onboarding_modules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "LOCKED",
                "NOT_STARTED",
                "VIDEO_IN_PROGRESS",
                "VIDEO_COMPLETED",
                "QUIZ_IN_PROGRESS",
                "COMPLETED",
                name="module_status_enum",
                create_type=False,  # Already created above
            ),
            nullable=False,
            server_default="LOCKED",
        ),
        sa.Column(
            "started_date",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "video_completed_date",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "completed_date",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "created_date",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "modified_date",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "user_id",
            "module_id",
            name="uq_user_module",
        ),
    )

    # Table 2: Onboarding Module Video Progress
    op.create_table(
        "onboarding_module_video_progress",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "employee_progress_id",
            sa.Integer(),
            sa.ForeignKey(
                "onboarding_module_employee_progress.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "video_url",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "current_duration_seconds",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "total_duration_seconds",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "completion_percentage",
            sa.Numeric(5, 2),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "is_completed",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
        sa.Column(
            "completed_date",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "created_date",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "modified_date",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Table 3: Onboarding Module Quiz Attempts
    op.create_table(
        "onboarding_module_quiz_attempts",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "employee_progress_id",
            sa.Integer(),
            sa.ForeignKey(
                "onboarding_module_employee_progress.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "quiz_id",
            sa.Integer(),
            sa.ForeignKey(
                "onboarding_module_quiz.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.Column(
            "score",
            sa.Numeric(5, 2),
            nullable=True,
        ),
        sa.Column(
            "passing_status",
            sa.String(20),  # PASS / FAIL
            nullable=True,
        ),
        sa.Column(
            "attempt_number",
            sa.Integer(),
            server_default="1",
            nullable=False,
        ),
        sa.Column(
            "time_spent_seconds",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "attempted_date",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_date",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "modified_date",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Table 4: Onboarding Module Quiz Responses (Individual Q&A)
    op.create_table(
        "onboarding_module_quiz_responses",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "quiz_attempt_id",
            sa.Integer(),
            sa.ForeignKey(
                "onboarding_module_quiz_attempts.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "question_id",
            sa.Integer(),
            nullable=False,  # Reference to onboarding_module_quiz questions
        ),
        sa.Column(
            "question_text",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "employee_answer",
            sa.Text(),
            nullable=True,  # Can be selected option, text response, etc.
        ),
        sa.Column(
            "correct_answer",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "is_correct",
            sa.Boolean(),
            nullable=True,
        ),
        sa.Column(
            "time_spent_seconds",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "created_date",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create index for efficient queries
    op.create_index(
        "idx_onboarding_employee_progress_user_id",
        "onboarding_module_employee_progress",
        ["user_id"],
    )
    op.create_index(
        "idx_onboarding_employee_progress_status",
        "onboarding_module_employee_progress",
        ["status"],
    )
    op.create_index(
        "idx_onboarding_video_progress_employee_progress_id",
        "onboarding_module_video_progress",
        ["employee_progress_id"],
    )
    op.create_index(
        "idx_onboarding_quiz_attempts_employee_progress_id",
        "onboarding_module_quiz_attempts",
        ["employee_progress_id"],
    )
    op.create_index(
        "idx_onboarding_quiz_responses_quiz_attempt_id",
        "onboarding_module_quiz_responses",
        ["quiz_attempt_id"],
    )


def downgrade() -> None:
    """Drop onboarding module employee tracking tables."""
    
    op.drop_index("idx_onboarding_quiz_responses_quiz_attempt_id")
    op.drop_index("idx_onboarding_quiz_attempts_employee_progress_id")
    op.drop_index("idx_onboarding_video_progress_employee_progress_id")
    op.drop_index("idx_onboarding_employee_progress_status")
    op.drop_index("idx_onboarding_employee_progress_user_id")
    
    op.drop_table("onboarding_module_quiz_responses")
    op.drop_table("onboarding_module_quiz_attempts")
    op.drop_table("onboarding_module_video_progress")
    op.drop_table("onboarding_module_employee_progress")
    
    # Drop enum type
    op.execute("DROP TYPE IF EXISTS module_status_enum CASCADE")

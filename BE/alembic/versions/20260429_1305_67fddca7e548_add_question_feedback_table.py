"""add question_feedback table"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '67fddca7e548'
down_revision: Union[str, None] = '20260427_q_ans_text'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'question_feedback',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('test_session_id', sa.Integer(), nullable=False),
        sa.Column('answer_id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('feedback_text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        sa.ForeignKeyConstraint(['test_session_id'], ['test_sessions.id']),
        sa.ForeignKeyConstraint(['answer_id'], ['answers.id']),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
    )

    op.create_index('ix_question_feedback_test_session_id', 'question_feedback', ['test_session_id'])
    op.create_index('ix_question_feedback_answer_id', 'question_feedback', ['answer_id'])
    op.create_index('ix_question_feedback_question_id', 'question_feedback', ['question_id'])


def downgrade() -> None:
    op.drop_index('ix_question_feedback_question_id', table_name='question_feedback')
    op.drop_index('ix_question_feedback_answer_id', table_name='question_feedback')
    op.drop_index('ix_question_feedback_test_session_id', table_name='question_feedback')
    op.drop_table('question_feedback')
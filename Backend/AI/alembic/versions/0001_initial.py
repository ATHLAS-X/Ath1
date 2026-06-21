"""initial: video / psychology / ocr owned tables

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "video_analysis_tasks",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("player_id", sa.String(length=64), nullable=False),
        sa.Column("submitted_by_user_id", sa.String(length=64), nullable=False),
        sa.Column("player_role", sa.String(length=32), nullable=False),
        sa.Column("clips", sa.JSON(), nullable=False),
        sa.Column("context_notes", sa.Text(), nullable=False),
        sa.Column("cache_key", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("error_code", sa.String(length=48), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_video_analysis_tasks_player_id", "video_analysis_tasks", ["player_id"])
    op.create_index(
        "ix_video_analysis_tasks_submitted_by_user_id", "video_analysis_tasks", ["submitted_by_user_id"]
    )
    op.create_index("ix_video_analysis_tasks_cache_key", "video_analysis_tasks", ["cache_key"])
    op.create_index("ix_video_tasks_player_status", "video_analysis_tasks", ["player_id", "status"])

    op.create_table(
        "video_analysis_results",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("task_id", sa.String(length=36), nullable=False),
        sa.Column("player_id", sa.String(length=64), nullable=False),
        sa.Column("analysis", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["video_analysis_tasks.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("task_id"),
    )
    op.create_index("ix_video_analysis_results_player_id", "video_analysis_results", ["player_id"])

    op.create_table(
        "psychology_assessment_tasks",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("player_id", sa.String(length=64), nullable=False),
        sa.Column("submitted_by_user_id", sa.String(length=64), nullable=False),
        sa.Column("submission", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("error_code", sa.String(length=48), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_psychology_assessment_tasks_player_id", "psychology_assessment_tasks", ["player_id"]
    )
    op.create_index(
        "ix_psychology_assessment_tasks_submitted_by_user_id",
        "psychology_assessment_tasks", ["submitted_by_user_id"],
    )
    op.create_index(
        "ix_psych_tasks_player_created", "psychology_assessment_tasks", ["player_id", "created_at"]
    )

    op.create_table(
        "psychology_assessment_results",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("task_id", sa.String(length=36), nullable=False),
        sa.Column("player_id", sa.String(length=64), nullable=False),
        sa.Column("profile", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["psychology_assessment_tasks.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("task_id"),
    )
    op.create_index(
        "ix_psychology_assessment_results_player_id", "psychology_assessment_results", ["player_id"]
    )

    op.create_table(
        "ocr_tasks",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("submitted_by_user_id", sa.String(length=64), nullable=False),
        sa.Column("image_source_type", sa.String(length=8), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("image_data", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("review_status", sa.String(length=20), nullable=False),
        sa.Column("error_code", sa.String(length=48), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ocr_tasks_submitted_by_user_id", "ocr_tasks", ["submitted_by_user_id"])

    op.create_table(
        "ocr_results",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("task_id", sa.String(length=36), nullable=False),
        sa.Column("submitted_by_user_id", sa.String(length=64), nullable=False),
        sa.Column("extraction", sa.JSON(), nullable=False),
        sa.Column("review_status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["ocr_tasks.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("task_id"),
    )
    op.create_index("ix_ocr_results_submitted_by_user_id", "ocr_results", ["submitted_by_user_id"])


def downgrade() -> None:
    op.drop_table("ocr_results")
    op.drop_table("ocr_tasks")
    op.drop_table("psychology_assessment_results")
    op.drop_table("psychology_assessment_tasks")
    op.drop_table("video_analysis_results")
    op.drop_table("video_analysis_tasks")

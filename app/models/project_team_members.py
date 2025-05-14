from sqlalchemy import Column, Integer, ForeignKey, DateTime, Float, Table
from sqlalchemy.sql import func
from app.db.base_class import Base

project_team_members = Table(
    "project_team_members",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("project.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True),
    Column("hourly_rate", Float, nullable=True),  # Optional override of project rate
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now()),
    extend_existing=True  # This allows the table to be redefined if needed
) 
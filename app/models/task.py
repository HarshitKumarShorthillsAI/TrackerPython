from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base_class import Base

class TaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"

class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class Task(Base):
    __tablename__ = "task"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.TODO)
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    estimated_hours = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    due_date = Column(DateTime(timezone=True), nullable=True)

    # Foreign keys
    project_id = Column(Integer, ForeignKey("project.id", ondelete="CASCADE"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    created_by = relationship("User", foreign_keys=[created_by_id], back_populates="created_tasks")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="assigned_tasks")
    time_entries = relationship("TimeEntry", back_populates="task") 
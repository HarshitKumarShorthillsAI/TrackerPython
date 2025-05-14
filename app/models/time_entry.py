from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base_class import Base

class TimeEntryStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    BILLED = "billed"

class TimeEntry(Base):
    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    hourly_rate = Column(Float, nullable=False)
    billable = Column(Boolean, default=True)
    status = Column(Enum(TimeEntryStatus), default=TimeEntryStatus.DRAFT)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Foreign keys
    user_id = Column(Integer, ForeignKey("user.id"))
    task_id = Column(Integer, ForeignKey("task.id"))
    project_id = Column(Integer, ForeignKey("project.id"))
    approved_by_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="time_entries")
    task = relationship("Task", back_populates="time_entries")
    project = relationship("Project", back_populates="time_entries")
    approved_by = relationship("User", foreign_keys=[approved_by_id]) 
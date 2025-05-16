from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base_class import Base

class TimeEntryStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    BILLED = "BILLED"

class TimeEntry(Base):
    __tablename__ = "timeentry"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    hourly_rate = Column(Float, nullable=False)
    billable = Column(Boolean, default=True)
    status = Column(Enum(TimeEntryStatus), default=TimeEntryStatus.DRAFT)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    rejection_reason = Column(String, nullable=True)
    
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
    
    @property
    def duration_hours(self):
        """Calculate duration in hours if end_time is set"""
        if not self.end_time:
            return 0
        delta = self.end_time - self.start_time
        return delta.total_seconds() / 3600

    @property
    def cost(self):
        """Calculate cost based on duration and hourly rate"""
        return self.duration_hours * self.hourly_rate if self.hourly_rate else 0

    def can_transition_to(self, new_status: TimeEntryStatus) -> bool:
        """Check if the time entry can transition to the new status."""
        allowed_transitions = {
            TimeEntryStatus.DRAFT: [TimeEntryStatus.SUBMITTED],
            TimeEntryStatus.SUBMITTED: [TimeEntryStatus.APPROVED, TimeEntryStatus.REJECTED],
            TimeEntryStatus.APPROVED: [TimeEntryStatus.BILLED],
            TimeEntryStatus.REJECTED: [TimeEntryStatus.DRAFT],
            TimeEntryStatus.BILLED: []  # Cannot transition from BILLED
        }
        return new_status in allowed_transitions.get(self.status, [])
        
    def validate_for_submission(self) -> bool:
        """Validate if the time entry can be submitted."""
        return all([
            self.end_time is not None,
            self.start_time < self.end_time,
            self.description is not None and len(self.description.strip()) > 0,
            self.hourly_rate > 0
        ])
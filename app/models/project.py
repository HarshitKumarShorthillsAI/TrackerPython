from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base_class import Base
from app.models.project_team_members import project_team_members

class ProjectStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Project(Base):
    __tablename__ = "project"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.PLANNED)
    budget_hours = Column(Float, nullable=False, default=0.0)
    hourly_rate = Column(Float, nullable=False, default=0.0)  # Default hourly rate for the project
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Foreign keys
    manager_id = Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    owner_id = Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    manager = relationship("User", foreign_keys=[manager_id], back_populates="managed_projects")
    owner = relationship("User", foreign_keys=[owner_id], back_populates="owned_projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    team_members = relationship(
        "User",
        secondary=project_team_members,
        back_populates="project_teams"
    )
    time_entries = relationship("TimeEntry", back_populates="project", cascade="all, delete-orphan")

    @property
    def team_member_ids(self) -> list[int]:
        """Get list of team member IDs."""
        return [member.id for member in self.team_members] 
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Enum, Float, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base_class import Base

class ProjectStatus(str, enum.Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class ProjectTeamMember(Base):
    __tablename__ = "project_team_members"
    
    project_id = Column(Integer, ForeignKey("project.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True)
    hourly_rate = Column(Float, nullable=True)  # Optional override of project rate

    # Relationships
    project = relationship("Project", back_populates="team_members")
    user = relationship("User", back_populates="project_memberships")

class Project(Base):
    __tablename__ = "project"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    budget_hours = Column(Float, nullable=False, default=0)
    hourly_rate = Column(Float, nullable=False, default=0)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.PLANNED)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Foreign keys
    manager_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    
    # Relationships
    manager = relationship("User", foreign_keys=[manager_id], back_populates="managed_projects")
    owner = relationship("User", foreign_keys=[owner_id], back_populates="owned_projects")
    tasks = relationship("Task", back_populates="project")
    time_entries = relationship("TimeEntry", back_populates="project")
    team_members = relationship("ProjectTeamMember", back_populates="project")

    @property
    def team_member_ids(self) -> list[int]:
        """Get list of team member IDs."""
        return [member.user_id for member in self.team_members] 
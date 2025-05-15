from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base_class import Base

class UserRole(str, enum.Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    ADMIN = "admin"
    CLIENT = "client"

class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String)
    hashed_password = Column(String, nullable=False)
    hourly_rate = Column(Float, nullable=True)  # Base hourly rate for the user
    role = Column(Enum(UserRole), default=UserRole.EMPLOYEE)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    client_id = Column(Integer, nullable=True)  # For client users

    # Relationships
    created_tasks = relationship("Task", foreign_keys="[Task.created_by_id]", back_populates="created_by")
    assigned_tasks = relationship("Task", foreign_keys="[Task.assigned_to_id]", back_populates="assigned_to")
    time_entries = relationship("TimeEntry", foreign_keys="[TimeEntry.user_id]", back_populates="user")
    managed_projects = relationship("Project", foreign_keys="[Project.manager_id]", back_populates="manager")
    owned_projects = relationship("Project", foreign_keys="[Project.owner_id]", back_populates="owner")
    project_teams = relationship("Project", secondary="project_team_members", back_populates="team_members")
    approved_time_entries = relationship("TimeEntry", foreign_keys="[TimeEntry.approved_by_id]", back_populates="approved_by") 
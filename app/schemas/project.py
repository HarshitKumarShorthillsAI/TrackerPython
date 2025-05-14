from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.project import ProjectStatus

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: Optional[bool] = True
    status: Optional[ProjectStatus] = ProjectStatus.PLANNED
    budget_hours: Optional[float] = 0.0
    hourly_rate: Optional[float] = 0.0
    client_id: Optional[int] = None
    manager_id: Optional[int] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    status: Optional[ProjectStatus] = None
    budget_hours: Optional[float] = None
    hourly_rate: Optional[float] = None
    client_id: Optional[int] = None
    manager_id: Optional[int] = None

class Project(ProjectBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ProjectWithTeam(Project):
    team_member_ids: List[int] = [] 
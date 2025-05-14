from typing import Any, Dict, Optional, Union, List
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.crud.base import CRUDBase
from app.models.project import Project, ProjectStatus, ProjectTeamMember
from app.models.user import User, UserRole
from app.schemas.project import ProjectCreate, ProjectUpdate

class CRUDProject(CRUDBase[Project, ProjectCreate, ProjectUpdate]):
    def get_multi_by_owner(
        self, db: Session, *, owner_id: int, skip: int = 0, limit: int = 100,
        status: Optional[ProjectStatus] = None
    ) -> List[Project]:
        query = db.query(self.model).filter(Project.owner_id == owner_id)
        if status:
            query = query.filter(Project.status == status)
        return query.offset(skip).limit(limit).all()

    def get_multi_by_manager(
        self, db: Session, *, manager_id: int, skip: int = 0, limit: int = 100,
        status: Optional[ProjectStatus] = None
    ) -> List[Project]:
        query = db.query(self.model).filter(Project.manager_id == manager_id)
        if status:
            query = query.filter(Project.status == status)
        return query.offset(skip).limit(limit).all()

    def create_with_owner(
        self, db: Session, *, obj_in: ProjectCreate, owner_id: int
    ) -> Project:
        obj_in_data = obj_in.dict()
        db_obj = Project(**obj_in_data, owner_id=owner_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_team_member(
        self, db: Session, project_id: int, user_id: int
    ) -> Optional[ProjectTeamMember]:
        result = db.query(ProjectTeamMember).filter(
            and_(
                ProjectTeamMember.project_id == project_id,
                ProjectTeamMember.user_id == user_id
            )
        ).first()
        return result

    def add_team_member(
        self, db: Session, *, project: Project, user: User, hourly_rate: Optional[float] = None
    ) -> Project:
        team_member = ProjectTeamMember(
            project_id=project.id,
            user_id=user.id,
            hourly_rate=hourly_rate
        )
        db.add(team_member)
        db.commit()
        db.refresh(project)
        return project

    def remove_team_member(
        self, db: Session, *, project: Project, user: User
    ) -> Project:
        db.query(ProjectTeamMember).filter(
            and_(
                ProjectTeamMember.project_id == project.id,
                ProjectTeamMember.user_id == user.id
            )
        ).delete()
        db.commit()
        db.refresh(project)
        return project

    def update_status(
        self, db: Session, *, project: Project, status: ProjectStatus
    ) -> Project:
        project.status = status
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    def can_update(self, db: Session, user: User, project: Project) -> bool:
        return (
            user.is_superuser
            or project.manager_id == user.id
            or user.role == UserRole.MANAGER
        )

    def can_read(self, db: Session, user: User, project: Project) -> bool:
        if user.is_superuser or project.manager_id == user.id:
            return True
        # Check if user is a team member
        return bool(self.get_team_member(db, project.id, user.id))

    def can_manage_team(self, db: Session, user: User, project: Project) -> bool:
        return (
            user.is_superuser
            or project.manager_id == user.id
        )

    def can_delete(self, db: Session, user: User, project: Project) -> bool:
        return user.is_superuser or project.manager_id == user.id

project = CRUDProject(Project) 
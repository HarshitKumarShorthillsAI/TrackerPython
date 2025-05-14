from typing import Any, Dict, Optional, Union, List
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.crud.base import CRUDBase
from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole
from app.models.project_team_members import project_team_members
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

    def get_multi_by_team_member(
        self, db: Session, *, user_id: int, skip: int = 0, limit: int = 100,
        status: Optional[ProjectStatus] = None
    ) -> List[Project]:
        query = db.query(self.model).join(project_team_members).filter(
            project_team_members.c.user_id == user_id
        )
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
        self, db: Session, *, project_id: int, user_id: int
    ) -> Optional[Dict[str, Any]]:
        result = db.execute(
            project_team_members.select().where(
                project_team_members.c.project_id == project_id,
                project_team_members.c.user_id == user_id
            )
        ).first()
        return dict(result._mapping) if result else None

    def add_team_member(
        self, db: Session, *, project_id: int, user_id: int, hourly_rate: Optional[float] = None
    ) -> bool:
        try:
            values = {
                "project_id": project_id,
                "user_id": user_id,
            }
            if hourly_rate is not None:
                values["hourly_rate"] = hourly_rate
            
            db.execute(project_team_members.insert().values(**values))
            db.commit()
            return True
        except Exception:
            db.rollback()
            return False

    def remove_team_member(
        self, db: Session, *, project_id: int, user_id: int
    ) -> bool:
        try:
            db.execute(
                project_team_members.delete().where(
                    project_team_members.c.project_id == project_id,
                    project_team_members.c.user_id == user_id
                )
            )
            db.commit()
            return True
        except Exception:
            db.rollback()
            return False

    def get_team_member_hourly_rate(
        self, db: Session, *, project_id: int, user_id: int
    ) -> Optional[float]:
        result = db.execute(
            project_team_members.select().where(
                project_team_members.c.project_id == project_id,
                project_team_members.c.user_id == user_id
            )
        ).first()
        return result.hourly_rate if result else None

    def update_status(
        self, db: Session, *, db_obj: Project, status: ProjectStatus
    ) -> Project:
        db_obj.status = status
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def can_update(self, db: Session, user: User, project: Project) -> bool:
        return (
            user.is_superuser
            or project.owner_id == user.id
            or project.manager_id == user.id
            or user.role == UserRole.MANAGER
        )

    def can_read(self, db: Session, user: User, project: Project) -> bool:
        team_member = self.get_team_member(db, project_id=project.id, user_id=user.id)
        return (
            user.is_superuser
            or project.owner_id == user.id
            or project.manager_id == user.id
            or user.role == UserRole.MANAGER
            or team_member is not None
        )

    def can_manage_team(self, db: Session, user: User, project: Project) -> bool:
        return (
            user.is_superuser
            or project.manager_id == user.id
        )

    def can_delete(self, db: Session, user: User, project: Project) -> bool:
        return user.is_superuser or project.manager_id == user.id

project = CRUDProject(Project) 
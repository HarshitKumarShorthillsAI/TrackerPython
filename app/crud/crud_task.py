from typing import Any, Dict, Optional, Union, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.crud.base import CRUDBase
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.project_team_members import project_team_members
from app.schemas.task import TaskCreate, TaskUpdate

class CRUDTask(CRUDBase[Task, TaskCreate, TaskUpdate]):
    def get_multi_by_user(
        self, db: Session, *, user_id: int, skip: int = 0, limit: int = 100,
        status: Optional[TaskStatus] = None, priority: Optional[TaskPriority] = None,
        project_id: Optional[int] = None
    ) -> List[Task]:
        # Get projects where user is a team member
        user_projects = db.query(project_team_members.c.project_id).filter(
            project_team_members.c.user_id == user_id
        ).subquery()

        # Base query for tasks
        query = db.query(self.model).filter(
            or_(
                Task.assigned_to_id == user_id,  # Tasks assigned to user
                Task.project_id.in_(user_projects)  # Tasks from projects where user is a team member
            )
        )

        if status:
            query = query.filter(Task.status == status)
        if priority:
            query = query.filter(Task.priority == priority)
        if project_id:
            query = query.filter(Task.project_id == project_id)
        return query.offset(skip).limit(limit).all()

    def get_multi_by_manager(
        self, db: Session, *, manager_id: int, skip: int = 0, limit: int = 100,
        status: Optional[TaskStatus] = None, priority: Optional[TaskPriority] = None,
        project_id: Optional[int] = None
    ) -> List[Task]:
        query = db.query(self.model).join(Task.project).filter(
            Task.project.has(manager_id=manager_id)
        )
        if status:
            query = query.filter(Task.status == status)
        if priority:
            query = query.filter(Task.priority == priority)
        if project_id:
            query = query.filter(Task.project_id == project_id)
        return query.offset(skip).limit(limit).all()

    def get_multi_by_owner(
        self, db: Session, *, owner_id: int, skip: int = 0, limit: int = 100
    ) -> List[Task]:
        return (
            db.query(self.model)
            .filter(Task.created_by_id == owner_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_multi_by_assigned(
        self, db: Session, *, assigned_to_id: int, skip: int = 0, limit: int = 100
    ) -> List[Task]:
        return (
            db.query(self.model)
            .filter(Task.assigned_to_id == assigned_to_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_multi_by_project(
        self, db: Session, *, project_id: int, skip: int = 0, limit: int = 100
    ) -> List[Task]:
        return (
            db.query(self.model)
            .filter(Task.project_id == project_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create_with_owner(
        self, db: Session, *, obj_in: TaskCreate, created_by_id: int
    ) -> Task:
        obj_in_data = obj_in.dict()
        db_obj = Task(**obj_in_data, created_by_id=created_by_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def assign_to(self, db: Session, *, task: Task, user: User) -> Task:
        task.assigned_to_id = user.id
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    def update_status(self, db: Session, *, task: Task, status: TaskStatus) -> Task:
        task.status = status
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    def update_priority(self, db: Session, *, task: Task, priority: TaskPriority) -> Task:
        task.priority = priority
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    def can_update(self, db: Session, user: User, task: Task) -> bool:
        if user.is_superuser:
            return True
        if task.created_by_id == user.id:
            return True
        if task.assigned_to_id == user.id:
            return True
        if task.project and task.project.manager_id == user.id:
            return True
        return False

    def can_read(self, db: Session, user: User, task: Task) -> bool:
        if user.is_superuser:
            return True
        if task.created_by_id == user.id:
            return True
        if task.assigned_to_id == user.id:
            return True
        if task.project and task.project.manager_id == user.id:
            return True
        # Check if user is a team member of the project
        if task.project:
            team_member = db.query(project_team_members).filter(
                project_team_members.c.project_id == task.project_id,
                project_team_members.c.user_id == user.id
            ).first()
            if team_member:
                return True
        return False

    def can_assign(self, db: Session, user: User, task: Task) -> bool:
        return (
            user.is_superuser
            or task.created_by_id == user.id
            or task.project.manager_id == user.id
            or user.role == UserRole.MANAGER
        )

    def can_update_status(self, db: Session, user: User, task: Task) -> bool:
        return (
            user.is_superuser
            or task.created_by_id == user.id
            or task.assigned_to_id == user.id
            or task.project.manager_id == user.id
            or user.role == UserRole.MANAGER
        )

    def can_track_time(self, db: Session, user: User, task: Task) -> bool:
        # Check if user is a project team member
        project_member = db.execute(
            project_team_members.select().where(
                project_team_members.c.project_id == task.project_id,
                project_team_members.c.user_id == user.id
            )
        ).first()
        
        return (
            user.is_superuser
            or task.assigned_to_id == user.id
            or task.project.manager_id == user.id
            or project_member is not None  # Allow project team members to track time
        )

task = CRUDTask(Task) 
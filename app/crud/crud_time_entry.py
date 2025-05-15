from typing import Any, Dict, Optional, Union, List
from sqlalchemy.orm import Session
from sqlalchemy import and_
from sqlalchemy.orm import joinedload

from app.crud.base import CRUDBase
from app.models.time_entry import TimeEntry, TimeEntryStatus
from app.models.user import User, UserRole
from app.models.project import Project
from app.schemas.time_entry import TimeEntryCreate, TimeEntryUpdate

class CRUDTimeEntry(CRUDBase[TimeEntry, TimeEntryCreate, TimeEntryUpdate]):
    def get_multi_by_user(
        self, db: Session, *, user_id: int, skip: int = 0, limit: int = 100,
        status: Optional[TimeEntryStatus] = None, project_id: Optional[int] = None,
        task_id: Optional[int] = None, billable_only: bool = False
    ) -> List[TimeEntry]:
        query = db.query(self.model).filter(TimeEntry.user_id == user_id)
        if status:
            query = query.filter(TimeEntry.status == status)
        if project_id:
            query = query.filter(TimeEntry.project_id == project_id)
        if task_id:
            query = query.filter(TimeEntry.task_id == task_id)
        if billable_only:
            query = query.filter(TimeEntry.billable == True)
        return query.offset(skip).limit(limit).all()

    def get_multi_by_manager(
        self, db: Session, *, manager_id: int, skip: int = 0, limit: int = 100,
        status: Optional[TimeEntryStatus] = None, project_id: Optional[int] = None,
        task_id: Optional[int] = None, billable_only: bool = False
    ) -> List[TimeEntry]:
        # Get the user to check their role
        user = db.query(User).filter(User.id == manager_id).first()
        
        # Base query with eager loading of project relationship
        query = db.query(self.model).options(
            joinedload(TimeEntry.project)  # Eager load project relationship
        )
        
        # If user has MANAGER role, they can see all time entries
        # Otherwise, only show time entries for projects they manage
        if user.role != UserRole.MANAGER:
            managed_project_ids = db.query(Project.id).filter(
                Project.manager_id == manager_id
            ).all()
            managed_project_ids = [p[0] for p in managed_project_ids]
            query = query.filter(TimeEntry.project_id.in_(managed_project_ids))
        
        if status:
            query = query.filter(TimeEntry.status == status)
        if project_id:
            query = query.filter(TimeEntry.project_id == project_id)
        if task_id:
            query = query.filter(TimeEntry.task_id == task_id)
        if billable_only:
            query = query.filter(TimeEntry.billable == True)
        return query.offset(skip).limit(limit).all()

    def create_with_owner(
        self, db: Session, *, obj_in: TimeEntryCreate, user_id: int, hourly_rate: float
    ) -> TimeEntry:
        obj_in_data = obj_in.dict()
        # Remove hourly_rate from obj_in_data if it exists to avoid duplicate
        obj_in_data.pop('hourly_rate', None)
        db_obj = TimeEntry(**obj_in_data, user_id=user_id, hourly_rate=hourly_rate)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def submit(self, db: Session, *, time_entry: TimeEntry) -> TimeEntry:
        time_entry.status = TimeEntryStatus.SUBMITTED
        db.add(time_entry)
        db.commit()
        db.refresh(time_entry)
        return time_entry

    def approve(self, db: Session, *, time_entry: TimeEntry, approved_by: User) -> TimeEntry:
        time_entry.status = TimeEntryStatus.APPROVED
        time_entry.approved_by_id = approved_by.id
        db.add(time_entry)
        db.commit()
        db.refresh(time_entry)
        return time_entry

    def reject(self, db: Session, *, time_entry: TimeEntry, rejection_reason: str) -> TimeEntry:
        time_entry.status = TimeEntryStatus.REJECTED
        # You might want to add a rejection_reason field to the TimeEntry model
        db.add(time_entry)
        db.commit()
        db.refresh(time_entry)
        return time_entry

    def mark_billed(self, db: Session, *, time_entry: TimeEntry) -> TimeEntry:
        time_entry.status = TimeEntryStatus.BILLED
        db.add(time_entry)
        db.commit()
        db.refresh(time_entry)
        return time_entry

    def can_update(self, db: Session, user: User, time_entry: TimeEntry) -> bool:
        if user.is_superuser or time_entry.user_id == user.id:
            return True
        
        # Check if user is the project manager
        if time_entry.project and time_entry.project.manager_id == user.id:
            return True
            
        return False

    def can_read(self, db: Session, user: User, time_entry: TimeEntry) -> bool:
        if user.is_superuser or time_entry.user_id == user.id or user.role == UserRole.MANAGER:
            return True
            
        # Check if user is the project manager
        if time_entry.project and time_entry.project.manager_id == user.id:
            return True
            
        return False

    def can_submit(self, db: Session, user: User, time_entry: TimeEntry) -> bool:
        return time_entry.user_id == user.id

    def can_approve(self, db: Session, user: User, time_entry: TimeEntry) -> bool:
        if user.is_superuser or user.role == UserRole.MANAGER:
            return True
            
        # Check if user is the project manager
        if time_entry.project and time_entry.project.manager_id == user.id:
            return True
            
        return False

    def can_mark_billed(self, db: Session, user: User, time_entry: TimeEntry) -> bool:
        return user.is_superuser or user.role == UserRole.MANAGER

time_entry = CRUDTimeEntry(TimeEntry) 
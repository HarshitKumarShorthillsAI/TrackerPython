from typing import Any, Dict, Optional, Union, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from datetime import datetime

from app.crud.base import CRUDBase
from app.models.time_entry import TimeEntry, TimeEntryStatus
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.project_team_members import project_team_members
from app.schemas.time_entry import TimeEntryCreate, TimeEntryUpdate

class CRUDTimeEntry(CRUDBase[TimeEntry, TimeEntryCreate, TimeEntryUpdate]):
    def get_multi(
        self, db: Session, *, skip: int = 0, limit: int = 100,
        status: Optional[TimeEntryStatus] = None, project_id: Optional[int] = None,
        task_id: Optional[int] = None, billable_only: bool = False
    ) -> List[TimeEntry]:
        query = db.query(self.model)
        if status:
            query = query.filter(TimeEntry.status == status)
        if project_id:
            query = query.filter(TimeEntry.project_id == project_id)
        if task_id:
            query = query.filter(TimeEntry.task_id == task_id)
        if billable_only:
            query = query.filter(TimeEntry.billable == True)
        return query.offset(skip).limit(limit).all()

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
        # Get all projects where user is manager
        managed_project_ids = db.query(Project.id).filter(
            Project.manager_id == manager_id
        ).all()
        managed_project_ids = [p[0] for p in managed_project_ids]
        
        # Base query with eager loading
        query = db.query(self.model).options(
            joinedload(TimeEntry.user),
            joinedload(TimeEntry.project),
            joinedload(TimeEntry.task)
        )
        
        # Filter by managed projects
        if managed_project_ids:
            query = query.filter(TimeEntry.project_id.in_(managed_project_ids))
        else:
            return []  # Return empty list if no managed projects
        
        # Apply additional filters
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
        self, db: Session, *, obj_in: Union[TimeEntryCreate, dict], user_id: int
    ) -> TimeEntry:
        user = db.query(User).filter(User.id == user_id).first()
        
        # Convert input to dictionary if it's a Pydantic model
        obj_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump()
        
        # Create time entry with user data
        db_obj = TimeEntry(
            **obj_data,
            user_id=user_id,
            status=TimeEntryStatus.DRAFT
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: TimeEntry, obj_in: Union[TimeEntryUpdate, Dict[str, Any]]
    ) -> TimeEntry:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
            
        # If end_time is being set, calculate duration and update status
        if "end_time" in update_data:
            end_time = datetime.fromisoformat(update_data["end_time"].replace("Z", "+00:00"))
            start_time = db_obj.start_time
            duration = (end_time - start_time).total_seconds() / 3600  # Convert to hours
            
            # Update the status to SUBMITTED when timer is stopped
            update_data["status"] = TimeEntryStatus.SUBMITTED
            
        return super().update(db, db_obj=db_obj, obj_in=update_data)

    def get_multi_by_owner(
        self, db: Session, *, user_id: int, skip: int = 0, limit: int = 100
    ) -> List[TimeEntry]:
        return (
            db.query(self.model)
            .filter(TimeEntry.user_id == user_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_multi_by_project(
        self, db: Session, *, project_id: int, skip: int = 0, limit: int = 100
    ) -> List[TimeEntry]:
        return (
            db.query(self.model)
            .filter(TimeEntry.project_id == project_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

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

crud_time_entry = CRUDTimeEntry(TimeEntry)
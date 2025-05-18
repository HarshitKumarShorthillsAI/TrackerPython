from typing import Any, Dict, Optional, Union, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
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
        task_id: Optional[int] = None, billable_only: bool = False,
        start_date: Optional[datetime] = None, end_date: Optional[datetime] = None
    ) -> List[TimeEntry]:
        query = db.query(self.model).options(
            joinedload(TimeEntry.user),
            joinedload(TimeEntry.project),
            joinedload(TimeEntry.task)
        )
        
        if status:
            query = query.filter(TimeEntry.status == status)
        if project_id:
            query = query.filter(TimeEntry.project_id == project_id)
        if task_id:
            query = query.filter(TimeEntry.task_id == task_id)
        if billable_only:
            query = query.filter(TimeEntry.billable == True)
        if start_date:
            query = query.filter(TimeEntry.start_time >= start_date)
        if end_date:
            query = query.filter(TimeEntry.start_time <= end_date)
            
        return query.offset(skip).limit(limit).all()

    def get_multi_by_user(
        self, db: Session, *, user_id: int, skip: int = 0, limit: int = 100,
        status: Optional[TimeEntryStatus] = None, project_id: Optional[int] = None,
        task_id: Optional[int] = None, billable_only: bool = False,
        start_date: Optional[datetime] = None, end_date: Optional[datetime] = None
    ) -> List[TimeEntry]:
        """Get time entries for a specific user"""
        query = db.query(self.model).options(
            joinedload(TimeEntry.user),
            joinedload(TimeEntry.project),
            joinedload(TimeEntry.task)
        ).filter(TimeEntry.user_id == user_id)
        
        if status:
            query = query.filter(TimeEntry.status == status)
        if project_id:
            query = query.filter(TimeEntry.project_id == project_id)
        if task_id:
            query = query.filter(TimeEntry.task_id == task_id)
        if billable_only:
            query = query.filter(TimeEntry.billable == True)
        if start_date:
            query = query.filter(func.date(TimeEntry.start_time) >= start_date.date())
        if end_date:
            query = query.filter(func.date(TimeEntry.start_time) <= end_date.date())
        
        return query.order_by(TimeEntry.start_time.desc()).offset(skip).limit(limit).all()

    def get_multi_by_manager(
        self, db: Session, *, manager_id: int, skip: int = 0, limit: int = 100,
        status: Optional[TimeEntryStatus] = None, project_id: Optional[int] = None,
        task_id: Optional[int] = None, billable_only: bool = False,
        start_date: Optional[datetime] = None, end_date: Optional[datetime] = None
    ) -> List[TimeEntry]:
        """Get time entries for projects managed by a specific manager"""
        # Get projects managed by the user
        managed_projects = db.query(Project.id).filter(Project.manager_id == manager_id)
        
        query = db.query(self.model).options(
            joinedload(TimeEntry.user),
            joinedload(TimeEntry.project),
            joinedload(TimeEntry.task)
        ).filter(TimeEntry.project_id.in_(managed_projects))
        
        if status:
            query = query.filter(TimeEntry.status == status)
        if project_id:
            query = query.filter(TimeEntry.project_id == project_id)
        if task_id:
            query = query.filter(TimeEntry.task_id == task_id)
        if billable_only:
            query = query.filter(TimeEntry.billable == True)
        if start_date:
            query = query.filter(func.date(TimeEntry.start_time) >= start_date.date())
        if end_date:
            query = query.filter(func.date(TimeEntry.start_time) <= end_date.date())
        
        return query.order_by(TimeEntry.start_time.desc()).offset(skip).limit(limit).all()

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
        """Update a time entry."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        # Convert end_time string to datetime if present
        if "end_time" in update_data and update_data["end_time"]:
            try:
                if isinstance(update_data["end_time"], str):
                    # Handle ISO format with Z
                    end_time_str = update_data["end_time"]
                    if end_time_str.endswith('Z'):
                        end_time_str = end_time_str[:-1] + '+00:00'
                    update_data["end_time"] = datetime.fromisoformat(end_time_str)
            except Exception as e:
                print(f"Error parsing end_time: {e}")
                raise ValueError(f"Invalid end_time format: {update_data['end_time']}")

        # Update the object using parent class method
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
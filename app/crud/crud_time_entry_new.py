from typing import Any, Dict, Optional, Union, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from datetime import datetime
from fastapi import HTTPException, status

from app.crud.base import CRUDBase
from app.models.time_entry import TimeEntry, TimeEntryStatus
from app.models.user import User, UserRole
from app.models.project import Project
from app.schemas.time_entry import TimeEntryCreate, TimeEntryUpdate
from app.core.permissions import TimesheetPermissions

class CRUDTimeEntry(CRUDBase[TimeEntry, TimeEntryCreate, TimeEntryUpdate]):
    def get_multi(
        self, db: Session, *, skip: int = 0, limit: int = 100,
        status: Optional[TimeEntryStatus] = None, project_id: Optional[int] = None,
        task_id: Optional[int] = None, billable_only: bool = False
    ) -> List[TimeEntry]:
        """Get all time entries (for superusers)"""
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
            
        return query.offset(skip).limit(limit).all()

    def get_multi_by_user(
        self, db: Session, *, user: User, skip: int = 0, limit: int = 100,
        status: Optional[TimeEntryStatus] = None, project_id: Optional[int] = None,
        task_id: Optional[int] = None, billable_only: bool = False
    ) -> List[TimeEntry]:
        """Get time entries based on user's role and permissions."""
        query = db.query(self.model)
        query = TimesheetPermissions.filter_viewable_timesheets(user, db, query)
        
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
        self, db: Session, *, manager: User, skip: int = 0, limit: int = 100,
        status: Optional[TimeEntryStatus] = None, project_id: Optional[int] = None,
        task_id: Optional[int] = None, billable_only: bool = False
    ) -> List[TimeEntry]:
        """Get time entries for a manager."""
        if not manager.role == UserRole.MANAGER and not manager.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to access manager view"
            )
            
        # Base query with eager loading of project relationship
        query = db.query(self.model).options(
            joinedload(TimeEntry.project)  # Eager load project relationship
        )
        
        # Apply role-based filtering
        query = TimesheetPermissions.filter_viewable_timesheets(manager, db, query)
        
        if status:
            query = query.filter(TimeEntry.status == status)
        if project_id:
            query = query.filter(TimeEntry.project_id == project_id)
        if task_id:
            query = query.filter(TimeEntry.task_id == task_id)
        if billable_only:
            query = query.filter(TimeEntry.billable == True)
            
        return query.offset(skip).limit(limit).all()

    def get_entries_by_role(
        self, db: Session, *, user: User, skip: int = 0, limit: int = 100,
        status: Optional[TimeEntryStatus] = None, project_id: Optional[int] = None,
        task_id: Optional[int] = None, billable_only: bool = False
    ) -> List[TimeEntry]:
        """Get time entries based on user role"""
        if user.is_superuser:
            return self.get_multi(
                db=db,
                skip=skip,
                limit=limit,
                status=status,
                project_id=project_id,
                task_id=task_id,
                billable_only=billable_only
            )
        elif user.role == UserRole.MANAGER:
            return self.get_multi_by_manager(
                db=db,
                manager=user,
                skip=skip,
                limit=limit,
                status=status,
                project_id=project_id,
                task_id=task_id,
                billable_only=billable_only
            )
        else:
            return self.get_multi_by_user(
                db=db,
                user=user,
                skip=skip,
                limit=limit,
                status=status,
                project_id=project_id,
                task_id=task_id,
                billable_only=billable_only
            )

    def create_with_owner(
        self, db: Session, *, obj_in: Union[TimeEntryCreate, dict], user: User
    ) -> TimeEntry:
        """Create a new time entry."""
        # Convert input to dictionary if it's a Pydantic model
        obj_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump()
        
        # Create time entry with user data
        db_obj = TimeEntry(
            **obj_data,
            user_id=user.id,
            status=TimeEntryStatus.DRAFT
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: TimeEntry, obj_in: Union[TimeEntryUpdate, Dict[str, Any]], user: User
    ) -> TimeEntry:
        """Update a time entry with permission check."""
        if not TimesheetPermissions.can_edit_timesheet(user, db_obj):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to edit this time entry"
            )
            
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

    def remove(self, db: Session, *, id: int, user: User) -> TimeEntry:
        """Delete a time entry with permission check."""
        obj = db.query(self.model).get(id)
        if not obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Time entry not found"
            )
            
        if not TimesheetPermissions.can_edit_timesheet(user, obj):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to delete this time entry"
            )
            
        return super().remove(db, id=id)

    def submit(self, db: Session, *, time_entry: TimeEntry, user: User) -> TimeEntry:
        """Submit a time entry for approval."""
        if time_entry.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only submit your own time entries"
            )
            
        if time_entry.status != TimeEntryStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only submit time entries in DRAFT status"
            )
            
        time_entry.status = TimeEntryStatus.SUBMITTED
        db.add(time_entry)
        db.commit()
        db.refresh(time_entry)
        return time_entry

    def approve(self, db: Session, *, time_entry: TimeEntry, user: User) -> TimeEntry:
        """Approve a time entry."""
        if not TimesheetPermissions.can_approve_timesheet(user, time_entry):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to approve this time entry"
            )
            
        time_entry.status = TimeEntryStatus.APPROVED
        time_entry.approved_by_id = user.id
        db.add(time_entry)
        db.commit()
        db.refresh(time_entry)
        return time_entry

    def reject(self, db: Session, *, time_entry: TimeEntry, user: User, rejection_reason: str) -> TimeEntry:
        """Reject a time entry."""
        if not TimesheetPermissions.can_approve_timesheet(user, time_entry):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to reject this time entry"
            )
            
        time_entry.status = TimeEntryStatus.REJECTED
        time_entry.rejection_reason = rejection_reason
        db.add(time_entry)
        db.commit()
        db.refresh(time_entry)
        return time_entry

    def mark_billed(self, db: Session, *, time_entry: TimeEntry, user: User) -> TimeEntry:
        """Mark a time entry as billed."""
        if not TimesheetPermissions.can_mark_billed(user, time_entry):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to mark this time entry as billed"
            )
            
        time_entry.status = TimeEntryStatus.BILLED
        db.add(time_entry)
        db.commit()
        db.refresh(time_entry)
        return time_entry

crud_time_entry = CRUDTimeEntry(TimeEntry) 
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.crud.crud_time_entry import crud_time_entry
from app.crud.crud_task import task as crud_task
from app.crud.crud_project import project as crud_project
from app.models.time_entry import TimeEntryStatus
from app.models.user import User, UserRole
from app.schemas.time_entry import (
    TimeEntry,
    TimeEntryCreate,
    TimeEntryUpdate
)

router = APIRouter()

@router.get("/", response_model=List[TimeEntry])
def get_time_entries(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    skip: int = 0,
    limit: int = 100,
    status: Optional[TimeEntryStatus] = None,
    project_id: Optional[int] = None,
    task_id: Optional[int] = None,
    billable_only: bool = False
) -> List[TimeEntry]:
    """
    Get time entries.
    If user is superuser, returns all time entries.
    If user is manager, returns all time entries from their projects.
    Otherwise, returns only the user's own time entries.
    """
    if current_user.is_superuser:
        # Superusers can see all time entries
        time_entries = crud_time_entry.get_multi(
            db,
            skip=skip,
            limit=limit,
            status=status,
            project_id=project_id,
            task_id=task_id,
            billable_only=billable_only
        )
    elif current_user.role == UserRole.MANAGER:
        # Managers can see all time entries from their projects
        time_entries = crud_time_entry.get_multi_by_manager(
            db,
            manager_id=current_user.id,
            skip=skip,
            limit=limit,
            status=status,
            project_id=project_id,
            task_id=task_id,
            billable_only=billable_only
        )
    else:
        # Regular employees can only see their own time entries
        time_entries = crud_time_entry.get_multi_by_user(
            db,
            user_id=current_user.id,
            skip=skip,
            limit=limit,
            status=status,
            project_id=project_id,
            task_id=task_id,
            billable_only=billable_only
        )
    return time_entries

@router.post("/", response_model=TimeEntry)
def create_time_entry(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_in: TimeEntryCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new time entry.
    """
    task = crud_task.get(db=db, id=time_entry_in.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Allow any employee to create time entries in draft status
    if time_entry_in.status != TimeEntryStatus.DRAFT:
        raise HTTPException(
            status_code=400, 
            detail="New time entries must be created in draft status"
        )
    
    # Get project member's hourly rate or use user's default rate
    project_member = crud_project.get_team_member(
        db=db,
        project_id=task.project_id,
        user_id=current_user.id
    )
    hourly_rate = None
    if project_member and project_member.get("hourly_rate"):
        hourly_rate = project_member["hourly_rate"]
    else:
        hourly_rate = current_user.hourly_rate
    
    # Create time entry with project_id from task and hourly rate
    time_entry_data = time_entry_in.model_dump()
    time_entry_data["project_id"] = task.project_id
    time_entry_data["hourly_rate"] = hourly_rate
    
    # Remove status as it will be set by create_with_owner
    if "status" in time_entry_data:
        del time_entry_data["status"]
    
    time_entry = crud_time_entry.create_with_owner(
        db=db,
        obj_in=time_entry_data,
        user_id=current_user.id
    )
    
    return time_entry

@router.put("/{time_entry_id}", response_model=TimeEntry)
def update_time_entry(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_id: int,
    time_entry_in: TimeEntryUpdate,
    current_user: User = Depends(deps.get_current_user)
) -> TimeEntry:
    """Update a time entry."""
    time_entry = crud_time_entry.get(db=db, id=time_entry_id)
    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    if not crud_time_entry.can_update(db, current_user, time_entry):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        time_entry = crud_time_entry.update(db=db, db_obj=time_entry, obj_in=time_entry_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return time_entry

@router.post("/{time_entry_id}/submit", response_model=TimeEntry)
def submit_time_entry(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_id: int,
    current_user: User = Depends(deps.get_current_user)
) -> TimeEntry:
    """Submit a time entry for approval."""
    time_entry = crud_time_entry.get(db=db, id=time_entry_id)
    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    if not crud_time_entry.can_submit(db, current_user, time_entry):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        time_entry = crud_time_entry.submit(db=db, time_entry=time_entry)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return time_entry

@router.post("/{time_entry_id}/approve", response_model=TimeEntry)
def approve_time_entry(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_id: int,
    current_user: User = Depends(deps.get_current_user)
) -> TimeEntry:
    """Approve a time entry."""
    time_entry = crud_time_entry.get(db=db, id=time_entry_id)
    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    if not crud_time_entry.can_approve(db, current_user, time_entry):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        time_entry = crud_time_entry.approve(db=db, time_entry=time_entry, approved_by=current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return time_entry

@router.post("/{time_entry_id}/reject", response_model=TimeEntry)
def reject_time_entry(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_id: int,
    rejection_reason: str = Query(..., min_length=1),
    current_user: User = Depends(deps.get_current_user)
) -> TimeEntry:
    """Reject a time entry."""
    time_entry = crud_time_entry.get(db=db, id=time_entry_id)
    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    if not crud_time_entry.can_approve(db, current_user, time_entry):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        time_entry = crud_time_entry.reject(
            db=db,
            time_entry=time_entry,
            rejection_reason=rejection_reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return time_entry

@router.post("/{time_entry_id}/mark-billed", response_model=TimeEntry)
def mark_time_entry_billed(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_id: int,
    current_user: User = Depends(deps.get_current_user)
) -> TimeEntry:
    """Mark a time entry as billed."""
    time_entry = crud_time_entry.get(db=db, id=time_entry_id)
    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    
    if not crud_time_entry.can_mark_billed(db, current_user, time_entry):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        time_entry = crud_time_entry.mark_billed(db=db, time_entry=time_entry)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return time_entry 
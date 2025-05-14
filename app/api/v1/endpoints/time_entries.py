from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.models.time_entry import TimeEntryStatus
from app.models.user import UserRole

router = APIRouter()

@router.get("/", response_model=List[schemas.TimeEntry])
def read_time_entries(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[TimeEntryStatus] = None,
    project_id: Optional[int] = None,
    task_id: Optional[int] = None,
    billable_only: bool = False,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve time entries. Can filter by status, project, task, and billable flag.
    """
    if current_user.is_superuser:
        return crud.time_entry.get_multi(
            db, skip=skip, limit=limit, status=status,
            project_id=project_id, task_id=task_id, billable_only=billable_only
        )
    elif current_user.role == UserRole.MANAGER:
        return crud.time_entry.get_multi_by_manager(
            db=db, manager_id=current_user.id, skip=skip, limit=limit,
            status=status, project_id=project_id, task_id=task_id,
            billable_only=billable_only
        )
    else:
        return crud.time_entry.get_multi_by_user(
            db=db, user_id=current_user.id, skip=skip, limit=limit,
            status=status, project_id=project_id, task_id=task_id,
            billable_only=billable_only
        )

@router.post("/", response_model=schemas.TimeEntry)
def create_time_entry(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_in: schemas.TimeEntryCreate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new time entry.
    """
    task = crud.task.get(db=db, id=time_entry_in.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Allow any employee to create time entries in draft status
    if time_entry_in.status != TimeEntryStatus.DRAFT:
        raise HTTPException(
            status_code=400, 
            detail="New time entries must be created in draft status"
        )
    
    # Set hourly rate from project team member rate or user rate
    project_member = crud.project.get_team_member(
        db=db,
        project_id=task.project_id,
        user_id=current_user.id
    )
    hourly_rate = (
        project_member["hourly_rate"] if project_member and project_member.get("hourly_rate")
        else current_user.hourly_rate
    )
    
    time_entry = crud.time_entry.create_with_owner(
        db=db,
        obj_in=time_entry_in,
        user_id=current_user.id,
        hourly_rate=hourly_rate
    )
    return time_entry

@router.put("/{time_entry_id}", response_model=schemas.TimeEntry)
def update_time_entry(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_id: int,
    time_entry_in: schemas.TimeEntryUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update time entry.
    """
    time_entry = crud.time_entry.get(db=db, id=time_entry_id)
    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    if not crud.time_entry.can_update(db, current_user, time_entry):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    # Don't allow updates if entry is approved or billed
    if time_entry.status in [TimeEntryStatus.APPROVED, TimeEntryStatus.BILLED]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot update time entry in {time_entry.status} status"
        )
    
    time_entry = crud.time_entry.update(db=db, db_obj=time_entry, obj_in=time_entry_in)
    return time_entry

@router.get("/{time_entry_id}", response_model=schemas.TimeEntry)
def read_time_entry(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_id: int,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get time entry by ID.
    """
    time_entry = crud.time_entry.get(db=db, id=time_entry_id)
    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    if not crud.time_entry.can_read(db, current_user, time_entry):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return time_entry

@router.put("/{time_entry_id}/submit", response_model=schemas.TimeEntry)
def submit_time_entry(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_id: int,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Submit time entry for approval.
    """
    time_entry = crud.time_entry.get(db=db, id=time_entry_id)
    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    if not crud.time_entry.can_submit(db, current_user, time_entry):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    time_entry = crud.time_entry.submit(db=db, time_entry=time_entry)
    return time_entry

@router.put("/{time_entry_id}/approve", response_model=schemas.TimeEntry)
def approve_time_entry(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_id: int,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Approve time entry.
    """
    time_entry = crud.time_entry.get(db=db, id=time_entry_id)
    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    if not crud.time_entry.can_approve(db, current_user, time_entry):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    time_entry = crud.time_entry.approve(db=db, time_entry=time_entry, approved_by=current_user)
    return time_entry

@router.put("/{time_entry_id}/reject", response_model=schemas.TimeEntry)
def reject_time_entry(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_id: int,
    rejection_reason: str = Body(...),
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Reject time entry.
    """
    time_entry = crud.time_entry.get(db=db, id=time_entry_id)
    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    if not crud.time_entry.can_approve(db, current_user, time_entry):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    time_entry = crud.time_entry.reject(
        db=db, time_entry=time_entry,
        rejection_reason=rejection_reason
    )
    return time_entry

@router.put("/{time_entry_id}/mark-billed", response_model=schemas.TimeEntry)
def mark_time_entry_billed(
    *,
    db: Session = Depends(deps.get_db),
    time_entry_id: int,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Mark time entry as billed.
    """
    time_entry = crud.time_entry.get(db=db, id=time_entry_id)
    if not time_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    if not crud.time_entry.can_mark_billed(db, current_user, time_entry):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    time_entry = crud.time_entry.mark_billed(db=db, time_entry=time_entry)
    return time_entry 
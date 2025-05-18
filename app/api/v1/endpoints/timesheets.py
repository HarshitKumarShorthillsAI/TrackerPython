from typing import Any, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.models.user import UserRole

router = APIRouter()

@router.post("/", response_model=schemas.Timesheet)
def create_timesheet(
    *,
    db: Session = Depends(deps.get_db),
    timesheet_in: schemas.TimesheetCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Create new timesheet.
    """
    # Check if user is creating timesheet for themselves or has permission
    if timesheet_in.user_id != current_user.id and not (
        current_user.is_superuser or current_user.role == UserRole.MANAGER
    ):
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions to create timesheet for other users"
        )
    
    timesheet = crud.timesheet.create_with_time_entries(db=db, obj_in=timesheet_in)
    return timesheet

@router.get("/", response_model=List[schemas.Timesheet])
def get_timesheets(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    start_date: datetime = None,
    end_date: datetime = None,
) -> Any:
    """
    Get timesheets.
    """
    if start_date and end_date:
        timesheets = crud.timesheet.get_by_date_range(
            db=db,
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date
        )
    else:
        timesheets = crud.timesheet.get_multi(db=db)
        if not (current_user.is_superuser or current_user.role == UserRole.MANAGER):
            timesheets = [ts for ts in timesheets if ts.user_id == current_user.id]
    
    return timesheets

@router.get("/pending", response_model=List[schemas.Timesheet])
def get_pending_timesheets(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get pending timesheets for approval.
    """
    if not (current_user.is_superuser or current_user.role == UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return crud.timesheet.get_pending_approval(db=db, manager_id=current_user.id)

@router.post("/{timesheet_id}/submit", response_model=schemas.Timesheet)
def submit_timesheet(
    *,
    db: Session = Depends(deps.get_db),
    timesheet_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Submit timesheet for approval.
    """
    timesheet = crud.timesheet.get(db=db, id=timesheet_id)
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    if timesheet.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return crud.timesheet.submit(db=db, timesheet_id=timesheet_id)

@router.post("/{timesheet_id}/approve", response_model=schemas.Timesheet)
def approve_timesheet(
    *,
    db: Session = Depends(deps.get_db),
    timesheet_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Approve timesheet.
    """
    if not (current_user.is_superuser or current_user.role == UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    timesheet = crud.timesheet.get(db=db, id=timesheet_id)
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    return crud.timesheet.approve(
        db=db,
        timesheet_id=timesheet_id,
        approved_by_id=current_user.id
    )

@router.post("/{timesheet_id}/reject", response_model=schemas.Timesheet)
def reject_timesheet(
    *,
    db: Session = Depends(deps.get_db),
    timesheet_id: int,
    rejection_reason: str,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Reject timesheet.
    """
    if not (current_user.is_superuser or current_user.role == UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    timesheet = crud.timesheet.get(db=db, id=timesheet_id)
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    return crud.timesheet.reject(
        db=db,
        timesheet_id=timesheet_id,
        rejection_reason=rejection_reason
    ) 
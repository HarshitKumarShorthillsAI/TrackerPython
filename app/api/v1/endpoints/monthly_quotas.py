from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud, models
from app.api import deps
from app.models.user import UserRole
from app.schemas.monthly_quota import MonthlyQuota, MonthlyQuotaCreate, MonthlyQuotaUpdate

router = APIRouter()

@router.get("/", response_model=List[MonthlyQuota])
def get_monthly_quotas(
    year: int = Query(..., description="Year to get quotas for"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve monthly quotas for a specific year.
    """
    quotas = crud.monthly_quota.get_multi_by_year(
        db, year=year, skip=skip, limit=limit
    )
    return quotas

@router.post("/", response_model=MonthlyQuota)
def create_monthly_quota(
    *,
    db: Session = Depends(deps.get_db),
    quota_in: MonthlyQuotaCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Create new monthly quota.
    """
    if not (current_user.is_superuser or current_user.role == UserRole.MANAGER):
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions to create monthly quotas"
        )
    
    # Check if quota for this month already exists
    existing_quota = crud.monthly_quota.get_by_month(db, month=quota_in.month)
    if existing_quota:
        raise HTTPException(
            status_code=400,
            detail=f"Monthly quota for {quota_in.month} already exists"
        )
    
    quota = crud.monthly_quota.create(db, obj_in=quota_in)
    return quota

@router.put("/{month}", response_model=MonthlyQuota)
def update_monthly_quota(
    *,
    db: Session = Depends(deps.get_db),
    month: str,
    quota_in: MonthlyQuotaUpdate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Update monthly quota.
    """
    if not (current_user.is_superuser or current_user.role == UserRole.MANAGER):
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions to update monthly quotas"
        )
    
    quota = crud.monthly_quota.get_by_month(db, month=month)
    if not quota:
        raise HTTPException(
            status_code=404,
            detail=f"Monthly quota for {month} not found"
        )
    
    quota = crud.monthly_quota.update(db, db_obj=quota, obj_in=quota_in)
    return quota

@router.get("/{month}", response_model=MonthlyQuota)
def get_monthly_quota(
    *,
    db: Session = Depends(deps.get_db),
    month: str,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get specific monthly quota.
    """
    quota = crud.monthly_quota.get_by_month(db, month=month)
    if not quota:
        raise HTTPException(
            status_code=404,
            detail=f"Monthly quota for {month} not found"
        )
    return quota

@router.delete("/{month}")
def delete_monthly_quota(
    *,
    db: Session = Depends(deps.get_db),
    month: str,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete monthly quota.
    """
    if not (current_user.is_superuser or current_user.role == UserRole.MANAGER):
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions to delete monthly quotas"
        )
    
    quota = crud.monthly_quota.get_by_month(db, month=month)
    if not quota:
        raise HTTPException(
            status_code=404,
            detail=f"Monthly quota for {month} not found"
        )
    
    crud.monthly_quota.remove(db, id=quota.id)
    return {"message": f"Monthly quota for {month} deleted"} 
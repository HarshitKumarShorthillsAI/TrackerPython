from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.project import Project
from app.schemas.project import Project as ProjectSchema, ProjectCreate, ProjectUpdate
from app.db.session import get_db
from app import crud, models, schemas
from app.models.project import ProjectStatus
from app.models.user import UserRole

router = APIRouter()

@router.get("/", response_model=List[schemas.Project])
def read_projects(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[ProjectStatus] = None,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve projects. Filter by status if provided.
    """
    if current_user.is_superuser:
        return crud.project.get_multi(db, skip=skip, limit=limit, status=status)
    elif current_user.role == UserRole.MANAGER:
        return crud.project.get_multi_by_manager(
            db=db, manager_id=current_user.id, skip=skip, limit=limit, status=status
        )
    else:
        return crud.project.get_multi_by_owner(
            db=db, owner_id=current_user.id, skip=skip, limit=limit, status=status
        )

@router.post("/", response_model=schemas.Project)
def create_project(
    *,
    db: Session = Depends(get_db),
    project_in: schemas.ProjectCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Create new project.
    """
    if not current_user.is_superuser and current_user.role != UserRole.MANAGER:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    project = crud.project.create_with_owner(
        db=db, obj_in=project_in, owner_id=current_user.id
    )
    return project

@router.put("/{project_id}", response_model=schemas.Project)
def update_project(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    project_in: schemas.ProjectUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update project.
    """
    project = crud.project.get(db=db, id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not crud.project.can_update(db, current_user, project):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    # Handle manager_id
    if project_in.manager_id == 0:
        project_in.manager_id = None
    elif project_in.manager_id is not None:
        manager = crud.user.get(db=db, id=project_in.manager_id)
        if not manager:
            raise HTTPException(status_code=404, detail="Manager not found")
    
    project = crud.project.update(db=db, db_obj=project, obj_in=project_in)
    return project

@router.get("/{project_id}", response_model=schemas.ProjectWithTeam)
def read_project(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get project by ID.
    """
    project = crud.project.get(db=db, id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not crud.project.can_read(db, current_user, project):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return project

@router.post("/{project_id}/team", response_model=schemas.ProjectWithTeam)
def add_team_member(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    user_id: int = Body(...),
    hourly_rate: Optional[float] = Body(None),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Add a team member to the project.
    """
    project = crud.project.get(db=db, id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not crud.project.can_manage_team(db, current_user, project):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    user = crud.user.get(db=db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    project = crud.project.add_team_member(
        db=db, project=project, user=user, hourly_rate=hourly_rate
    )
    return project

@router.delete("/{project_id}/team/{user_id}", response_model=schemas.ProjectWithTeam)
def remove_team_member(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Remove a team member from the project.
    """
    project = crud.project.get(db=db, id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not crud.project.can_manage_team(db, current_user, project):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    user = crud.user.get(db=db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    project = crud.project.remove_team_member(db=db, project=project, user=user)
    return project

@router.put("/{project_id}/status", response_model=schemas.Project)
def update_project_status(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    status: ProjectStatus,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update project status.
    """
    project = crud.project.get(db=db, id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not crud.project.can_update(db, current_user, project):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    project = crud.project.update_status(db=db, project=project, status=status)
    return project

@router.delete("/{project_id}")
def delete_project(
    *,
    db: Session = Depends(get_db),
    project_id: int,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Delete project.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not current_user.is_superuser and project.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    db.delete(project)
    db.commit()
    return {"status": "success"} 
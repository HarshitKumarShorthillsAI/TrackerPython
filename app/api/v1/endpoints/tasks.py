from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.project import Project
from app.schemas.task import Task as TaskSchema, TaskCreate, TaskUpdate
from app.db.session import get_db
from app import crud
from app.models.user import UserRole

router = APIRouter()

@router.get("/", response_model=List[TaskSchema])
def read_tasks(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve tasks. Can filter by status, priority, and project.
    """
    if current_user.is_superuser:
        return crud.task.get_multi(
            db, skip=skip, limit=limit, status=status, priority=priority, project_id=project_id
        )
    elif current_user.role == UserRole.MANAGER:
        return crud.task.get_multi_by_manager(
            db=db, manager_id=current_user.id, skip=skip, limit=limit,
            status=status, priority=priority, project_id=project_id
        )
    else:
        return crud.task.get_multi_by_user(
            db=db, user_id=current_user.id, skip=skip, limit=limit,
            status=status, priority=priority, project_id=project_id
        )

@router.post("/", response_model=TaskSchema)
def create_task(
    *,
    db: Session = Depends(get_db),
    task_in: TaskCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Create new task.
    """
    project = crud.project.get(db=db, id=task_in.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not crud.project.can_update(db, current_user, project):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    task = crud.task.create_with_owner(
        db=db,
        obj_in=task_in,
        created_by_id=current_user.id
    )
    return task

@router.put("/{task_id}", response_model=TaskSchema)
def update_task(
    *,
    db: Session = Depends(get_db),
    task_id: int,
    task_in: TaskUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update task.
    """
    task = crud.task.get(db=db, id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not crud.task.can_update(db, current_user, task):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    task = crud.task.update(db=db, db_obj=task, obj_in=task_in)
    return task

@router.get("/{task_id}", response_model=TaskSchema)
def read_task(
    *,
    db: Session = Depends(get_db),
    task_id: int,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get task by ID.
    """
    task = crud.task.get(db=db, id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not crud.task.can_read(db, current_user, task):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return task

@router.put("/{task_id}/assign", response_model=TaskSchema)
def assign_task(
    *,
    db: Session = Depends(get_db),
    task_id: int,
    user_id: int = Body(...),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Assign task to a user.
    """
    task = crud.task.get(db=db, id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not crud.task.can_assign(db, current_user, task):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    user = crud.user.get(db=db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    task = crud.task.assign_to(db=db, task=task, user=user)
    return task

@router.put("/{task_id}/status", response_model=TaskSchema)
def update_task_status(
    *,
    db: Session = Depends(get_db),
    task_id: int,
    status: TaskStatus,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update task status.
    """
    task = crud.task.get(db=db, id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not crud.task.can_update_status(db, current_user, task):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    task = crud.task.update_status(db=db, task=task, status=status)
    return task

@router.put("/{task_id}/priority", response_model=TaskSchema)
def update_task_priority(
    *,
    db: Session = Depends(get_db),
    task_id: int,
    priority: TaskPriority,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update task priority.
    """
    task = crud.task.get(db=db, id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not crud.task.can_update(db, current_user, task):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    
    task = crud.task.update_priority(db=db, task=task, priority=priority)
    return task

@router.delete("/{task_id}")
def delete_task(
    *,
    db: Session = Depends(get_db),
    task_id: int,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Delete task.
    """
    task = crud.task.get(db=db, id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    project = crud.project.get(db=db, id=task.project_id)
    if not crud.project.can_delete(db, current_user, project):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    crud.task.remove(db=db, id=task_id)
    return {"message": "Task deleted"}
 
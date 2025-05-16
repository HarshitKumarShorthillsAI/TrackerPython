from typing import Any, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, status, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from pydantic import EmailStr
from app.core import security
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate
from app.api.deps import get_current_active_user, get_current_active_superuser
from app import crud
from app.core.config import settings
from app.utils import send_new_account_email

router = APIRouter()

@router.post("/init", response_model=UserSchema)
def create_initial_superuser(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """
    Create initial superuser. This endpoint should only be used for the first user creation.
    """
    # Check if any user exists
    if db.query(User).first():
        raise HTTPException(
            status_code=400,
            detail="Users already exist. Cannot create initial superuser.",
        )
    
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    
    user = User(
        email=user_in.email,
        username=user_in.username,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=UserRole.ADMIN,  # Set role as ADMIN for initial user
        is_superuser=True,  # Force superuser for initial user
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/", response_model=List[UserSchema])
def read_users(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    role: Optional[UserRole] = None,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve users. Can filter by role.
    """
    if current_user.is_superuser or current_user.role == UserRole.MANAGER:
        users = crud.user.get_multi(db, skip=skip, limit=limit, role=role)
    else:
        # Regular users can only see active employees
        users = crud.user.get_by_role(db, role=UserRole.EMPLOYEE)
    return users

@router.post("/", response_model=UserSchema)
def create_user(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """
    Create new user.
    """
    user = crud.user.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists.",
        )
    user = crud.user.create(db, obj_in=user_in)
    if settings.EMAILS_ENABLED and user_in.email:
        send_new_account_email(
            email_to=user_in.email, username=user_in.email, password=user_in.password
        )
    return user

@router.put("/role/{user_id}", response_model=UserSchema)
def update_user_role(
    *,
    db: Session = Depends(get_db),
    user_id: int,
    role: UserRole,
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """
    Update user role. Only superusers can promote to admin.
    """
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if role == UserRole.ADMIN and not current_user.is_superuser:
        raise HTTPException(status_code=400, detail="Only superusers can promote to admin")
    user_data = jsonable_encoder(user)
    user_in = UserUpdate(**user_data)
    user_in.role = role
    user = crud.user.update(db, db_obj=user, obj_in=user_in)
    return user

@router.put("/me", response_model=UserSchema)
def update_user_me(
    *,
    db: Session = Depends(get_db),
    password: str = Body(None),
    full_name: str = Body(None),
    email: EmailStr = Body(None),
    hourly_rate: float = Body(None),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update own user.
    """
    current_user_data = jsonable_encoder(current_user)
    user_in = UserUpdate(**current_user_data)
    if password is not None:
        user_in.password = password
    if full_name is not None:
        user_in.full_name = full_name
    if email is not None:
        user_in.email = email
    if hourly_rate is not None and (current_user.role == UserRole.MANAGER or current_user.is_superuser):
        user_in.hourly_rate = hourly_rate
    user = crud.user.update(db, db_obj=current_user, obj_in=user_in)
    return user

@router.get("/me", response_model=UserSchema)
def read_user_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.get("/managers", response_model=List[UserSchema])
def read_managers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get all managers for assigning to projects.
    """
    return crud.user.get_by_role(db, role=UserRole.MANAGER)

@router.get("/employees", response_model=List[UserSchema])
def read_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve all active employees.
    """
    employees = crud.user.get_by_role(db, role=UserRole.EMPLOYEE)
    return [emp for emp in employees if emp.is_active]

@router.get("/{user_id}", response_model=UserSchema)
def read_user_by_id(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get a specific user by id.
    """
    user = crud.user.get(db, id=user_id)
    if user == current_user:
        return user
    if not current_user.is_superuser and not current_user.role == UserRole.MANAGER:
        raise HTTPException(
            status_code=400, detail="The user doesn't have enough privileges"
        )
    return user

@router.put("/{user_id}", response_model=UserSchema)
def update_user(
    *,
    db: Session = Depends(get_db),
    user_id: int,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """
    Update a user.
    """
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this ID does not exist in the system",
        )
    user = crud.user.update(db, db_obj=user, obj_in=user_in)
    return user

@router.delete("/{user_id}", response_model=UserSchema)
def delete_user(
    *,
    db: Session = Depends(get_db),
    user_id: int,
    current_user: User = Depends(get_current_active_superuser),
) -> Any:
    """
    Delete a user.
    Only superusers can delete users.
    """
    user = crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this ID does not exist in the system",
        )
    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Users cannot delete themselves",
        )
    user = crud.user.remove(db, id=user_id)
    return user 
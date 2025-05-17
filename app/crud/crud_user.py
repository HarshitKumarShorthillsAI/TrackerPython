from typing import Any, Dict, Optional, Union, List

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.security import get_password_hash, verify_password
from app.crud.base import CRUDBase
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate

class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    def get_by_email(self, db: Session, *, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    def get_by_role(self, db: Session, *, role: UserRole) -> List[User]:
        return db.query(User).filter(User.role == role).all()

    def create(self, db: Session, *, obj_in: UserCreate) -> User:
        db_obj = User(
            email=obj_in.email,
            hashed_password=get_password_hash(obj_in.password),
            full_name=obj_in.full_name,
            role=obj_in.role,
            hourly_rate=obj_in.hourly_rate,
            client_id=obj_in.client_id,
            is_superuser=obj_in.is_superuser,
            is_active=obj_in.is_active,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: User, obj_in: Union[UserUpdate, Dict[str, Any]]
    ) -> User:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        if update_data.get("password"):
            hashed_password = get_password_hash(update_data["password"])
            del update_data["password"]
            update_data["hashed_password"] = hashed_password
        return super().update(db, db_obj=db_obj, obj_in=update_data)

    def authenticate(self, db: Session, *, email: str, password: str) -> Optional[User]:
        user = self.get_by_email(db, email=email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def is_active(self, user: User) -> bool:
        return user.is_active

    def is_superuser(self, user: User) -> bool:
        return user.is_superuser

    def is_manager(self, user: User) -> bool:
        return user.role == UserRole.MANAGER

    def can_manage_users(self, user: User) -> bool:
        return user.is_superuser or user.role == UserRole.MANAGER

    def remove(self, db: Session, *, id: int) -> User:
        """Safely delete a user after checking and handling their relationships."""
        user = db.query(User).get(id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Check for active time entries
        if any(entry.status not in ['APPROVED', 'REJECTED', 'BILLED'] for entry in user.time_entries):
            raise HTTPException(
                status_code=400,
                detail="Cannot delete user with pending time entries. Please process all time entries first."
            )

        # Check for managed projects
        if user.managed_projects:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete user who is managing projects. Please reassign the projects first."
            )

        # Check for owned projects
        if user.owned_projects:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete user who owns projects. Please reassign project ownership first."
            )

        # Remove user from project teams
        user.project_teams = []

        # Unassign tasks
        for task in user.assigned_tasks:
            task.assigned_to_id = None

        # Mark tasks as system-created
        for task in user.created_tasks:
            task.created_by_id = None

        # Remove approver from time entries
        for entry in user.approved_time_entries:
            entry.approved_by_id = None

        db.delete(user)
        db.commit()
        return user

user = CRUDUser(User) 
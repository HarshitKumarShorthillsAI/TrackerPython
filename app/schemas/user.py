from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.user import UserRole

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False
    full_name: Optional[str] = None
    role: Optional[UserRole] = UserRole.EMPLOYEE
    hourly_rate: Optional[float] = 0.0
    quota_percent: Optional[float] = 100.0
    client_id: Optional[int] = None

class UserCreate(UserBase):
    email: EmailStr
    username: str
    password: str
    is_superuser: Optional[bool] = False

class UserUpdate(UserBase):
    password: Optional[str] = None

class UserInDBBase(UserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    hashed_password: str
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, validator
from app.models.time_entry import TimeEntryStatus

class TimeEntryBase(BaseModel):
    task_id: int
    project_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    description: Optional[str] = None
    billable: Optional[bool] = True
    status: Optional[TimeEntryStatus] = TimeEntryStatus.DRAFT
    hourly_rate: Optional[float] = None

    @validator('end_time')
    def validate_end_time(cls, v, values):
        if v and values.get('start_time') and v < values['start_time']:
            raise ValueError('End time must be after start time')
        return v

    @validator('hourly_rate')
    def validate_hourly_rate(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Hourly rate must be greater than 0')
        return v

class TimeEntryCreate(TimeEntryBase):
    pass

class TimeEntryUpdate(BaseModel):
    task_id: Optional[int] = None
    project_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    description: Optional[str] = None
    billable: Optional[bool] = None
    status: Optional[TimeEntryStatus] = None
    hourly_rate: Optional[float] = None
    rejection_reason: Optional[str] = None

    @validator('end_time')
    def validate_end_time(cls, v, values):
        if v and values.get('start_time') and v < values['start_time']:
            raise ValueError('End time must be after start time')
        return v

    @validator('hourly_rate')
    def validate_hourly_rate(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Hourly rate must be greater than 0')
        return v

class TimeEntry(TimeEntryBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    approved_by_id: Optional[int] = None
    rejection_reason: Optional[str] = None
    duration_hours: float
    cost: float

    class Config:
        from_attributes = True 
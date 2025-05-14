from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.time_entry import TimeEntryStatus

class TimeEntryBase(BaseModel):
    task_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    description: Optional[str] = None
    hourly_rate: Optional[float] = None
    billable: Optional[bool] = True
    status: Optional[TimeEntryStatus] = TimeEntryStatus.DRAFT

class TimeEntryCreate(TimeEntryBase):
    pass

class TimeEntryUpdate(TimeEntryBase):
    task_id: Optional[int] = None
    status: Optional[TimeEntryStatus] = None

class TimeEntry(TimeEntryBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    approved_by_id: Optional[int] = None

    class Config:
        from_attributes = True 
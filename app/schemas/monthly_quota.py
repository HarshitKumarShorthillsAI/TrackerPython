from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, validator
import re

class MonthlyQuotaBase(BaseModel):
    month: str = Field(..., description="Month in YYYY-MM format")
    working_days: int = Field(ge=0, default=22)
    daily_hours: float = Field(ge=0, default=8.0)
    monthly_hours: float = Field(ge=0, default=176.0)

    @validator('month')
    def validate_month_format(cls, v):
        if not re.match(r'^\d{4}-(?:0[1-9]|1[0-2])$', v):
            raise ValueError('Month must be in YYYY-MM format')
        return v

    @validator('monthly_hours', pre=True, always=True)
    def calculate_monthly_hours(cls, v, values):
        if 'working_days' in values and 'daily_hours' in values:
            return values['working_days'] * values['daily_hours']
        return v

class MonthlyQuotaCreate(MonthlyQuotaBase):
    pass

class MonthlyQuotaUpdate(BaseModel):
    working_days: Optional[int] = Field(None, ge=0)
    daily_hours: Optional[float] = Field(None, ge=0)
    monthly_hours: Optional[float] = Field(None, ge=0)

class MonthlyQuota(MonthlyQuotaBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True 
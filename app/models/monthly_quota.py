from sqlalchemy import Column, Integer, Float, DateTime, String
from sqlalchemy.sql import func

from app.db.base_class import Base

class MonthlyQuota(Base):
    __tablename__ = "monthly_quota"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String, nullable=False)  # Format: YYYY-MM
    working_days = Column(Integer, nullable=False, default=22)
    daily_hours = Column(Float, nullable=False, default=8.0)
    monthly_hours = Column(Float, nullable=False, default=176.0)  # Default: 22 days * 8 hours
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now()) 
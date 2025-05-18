from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import extract, and_

from app.crud.base import CRUDBase
from app.models.monthly_quota import MonthlyQuota
from app.schemas.monthly_quota import MonthlyQuotaCreate, MonthlyQuotaUpdate

class CRUDMonthlyQuota(CRUDBase[MonthlyQuota, MonthlyQuotaCreate, MonthlyQuotaUpdate]):
    def get_by_month(self, db: Session, *, month: str) -> Optional[MonthlyQuota]:
        """
        Get quota by month (YYYY-MM format)
        """
        return db.query(MonthlyQuota).filter(MonthlyQuota.month == month).first()

    def get_multi_by_year(
        self, db: Session, *, year: int, skip: int = 0, limit: int = 100
    ) -> List[MonthlyQuota]:
        """
        Get all quotas for a specific year
        """
        return (
            db.query(MonthlyQuota)
            .filter(MonthlyQuota.month.like(f"{year}-%"))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create_or_update(
        self, db: Session, *, month: str, obj_in: MonthlyQuotaCreate
    ) -> MonthlyQuota:
        """
        Create a new quota or update if exists
        """
        db_obj = self.get_by_month(db, month=month)
        if db_obj:
            return self.update(db, db_obj=db_obj, obj_in=obj_in)
        return self.create(db, obj_in=obj_in)

monthly_quota = CRUDMonthlyQuota(MonthlyQuota) 
# Import all the models, so that Base has them before being imported by Alembic
from app.db.base_class import Base
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.time_entry import TimeEntry 
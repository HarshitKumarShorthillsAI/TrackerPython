from fastapi import APIRouter
from app.api.v1.endpoints import login, users, projects, tasks, time_entries, reports, monthly_quotas, auth

api_router = APIRouter()
 
api_router.include_router(login.router, tags=["login"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(time_entries.router, prefix="/time-entries", tags=["time-entries"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(monthly_quotas.router, prefix="/monthly-quotas", tags=["monthly-quotas"]) 
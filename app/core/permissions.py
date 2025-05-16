from typing import Optional
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.time_entry import TimeEntry
from app.models.project import Project

class TimesheetPermissions:
    @staticmethod
    def can_view_timesheet(user: User, time_entry: TimeEntry) -> bool:
        """Check if user can view a timesheet."""
        if user.is_superuser:
            return True
            
        if time_entry.user_id == user.id:
            return True
            
        if user.role == UserRole.MANAGER:
            # Managers can see timesheets from their managed projects
            if time_entry.project and time_entry.project.manager_id == user.id:
                return True
            # Managers can also see timesheets from projects where they are team members
            if time_entry.project and user.id in [member.id for member in time_entry.project.team_members]:
                return True
                
        return False

    @staticmethod
    def can_edit_timesheet(user: User, time_entry: TimeEntry) -> bool:
        """Check if user can edit a timesheet."""
        # Can't edit if already approved or billed
        if time_entry.status in [TimeEntryStatus.APPROVED, TimeEntryStatus.BILLED]:
            return False
            
        if user.is_superuser:
            return True
            
        # Users can edit their own draft or rejected timesheets
        if time_entry.user_id == user.id:
            return time_entry.status in [TimeEntryStatus.DRAFT, TimeEntryStatus.REJECTED]
            
        if user.role == UserRole.MANAGER:
            # Managers can edit timesheets from their managed projects
            if time_entry.project and time_entry.project.manager_id == user.id:
                return True
                
        return False

    @staticmethod
    def can_approve_timesheet(user: User, time_entry: TimeEntry) -> bool:
        """Check if user can approve/reject a timesheet."""
        if not time_entry.status == TimeEntryStatus.SUBMITTED:
            return False
            
        if user.is_superuser:
            return True
            
        if user.role == UserRole.MANAGER:
            # Managers can approve timesheets from their managed projects
            if time_entry.project and time_entry.project.manager_id == user.id:
                return True
                
        return False

    @staticmethod
    def can_mark_billed(user: User, time_entry: TimeEntry) -> bool:
        """Check if user can mark a timesheet as billed."""
        if not time_entry.status == TimeEntryStatus.APPROVED:
            return False
            
        return user.is_superuser or user.role == UserRole.MANAGER

    @staticmethod
    def filter_viewable_timesheets(user: User, db: Session, query) -> query:
        """Filter timesheet query based on user permissions."""
        if user.is_superuser:
            return query
            
        if user.role == UserRole.MANAGER:
            # Get all projects managed by the user
            managed_project_ids = (
                db.query(Project.id)
                .filter(Project.manager_id == user.id)
                .all()
            )
            managed_project_ids = [p[0] for p in managed_project_ids]
            
            # Get all projects where user is a team member
            team_project_ids = (
                db.query(Project.id)
                .filter(Project.team_members.any(id=user.id))
                .all()
            )
            team_project_ids = [p[0] for p in team_project_ids]
            
            # Combine both sets of project IDs
            accessible_project_ids = list(set(managed_project_ids + team_project_ids))
            
            return query.filter(
                (TimeEntry.user_id == user.id) |
                (TimeEntry.project_id.in_(accessible_project_ids))
            )
            
        # Regular employees can only see their own timesheets
        return query.filter(TimeEntry.user_id == user.id) 
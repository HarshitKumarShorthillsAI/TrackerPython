from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, date
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from io import BytesIO

from app.api import deps
from app.crud.crud_time_entry import crud_time_entry
from app.crud.crud_project import project as crud_project
from app.crud.crud_task import task as crud_task
from app.models.user import User, UserRole
from app.models.time_entry import TimeEntry, TimeEntryStatus
from app.models.project import Project

router = APIRouter()

def create_pdf_report(
    time_entries: list[TimeEntry],
    user: User,
    start_date: date,
    end_date: date,
    project_id: Optional[int] = None,
    task_id: Optional[int] = None,
    status: Optional[TimeEntryStatus] = None,
    db: Session = None
) -> bytes:
    try:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []

        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30
        )
        elements.append(Paragraph("Time Entry Report", title_style))

        # Report Info
        info_style = ParagraphStyle(
            'Info',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=12
        )
        elements.append(Paragraph(f"User: {user.full_name}", info_style))
        elements.append(Paragraph(f"Period: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}", info_style))
        
        if project_id and db:
            project = crud_project.get(db=db, id=project_id)
            if project:
                elements.append(Paragraph(f"Project: {project.name}", info_style))
        
        if task_id and db:
            task = crud_task.get(db=db, id=task_id)
            if task:
                elements.append(Paragraph(f"Task: {task.title}", info_style))
        
        if status:
            elements.append(Paragraph(f"Status: {status.value}", info_style))
        
        elements.append(Spacer(1, 20))

        # Summary Statistics
        total_hours = 0
        for entry in time_entries:
            if entry.end_time and entry.start_time:
                try:
                    duration = (entry.end_time - entry.start_time).total_seconds() / 3600
                    total_hours += duration
                except (ValueError, TypeError):
                    continue

        unique_projects = len(set(entry.project_id for entry in time_entries))
        unique_tasks = len(set(entry.task_id for entry in time_entries))

        summary_data = [
            ["Total Hours", "Projects Worked On", "Total Tasks"],
            [f"{total_hours:.2f}", str(unique_projects), str(unique_tasks)]
        ]
        summary_table = Table(summary_data)
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 30))

        # Detailed Time Entries
        data = [["Date", "Project", "Task", "Description", "Hours", "Status"]]
        for entry in time_entries:
            project_name = "Unknown"
            task_title = "Unknown"
            
            if db:
                project = crud_project.get(db=db, id=entry.project_id)
                if project:
                    project_name = project.name
                
                task = crud_task.get(db=db, id=entry.task_id)
                if task:
                    task_title = task.title
            
            hours = 0
            if entry.end_time and entry.start_time:
                try:
                    duration = (entry.end_time - entry.start_time).total_seconds() / 3600
                    hours = duration
                except (ValueError, TypeError):
                    hours = 0

            data.append([
                entry.start_time.strftime('%Y-%m-%d'),
                project_name,
                task_title,
                entry.description or "-",
                f"{hours:.2f}",
                entry.status
            ])

        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(table)

        doc.build(elements)
        pdf = buffer.getvalue()
        buffer.close()
        return pdf
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to generate PDF: {str(e)}"
        )

@router.post("/generate")
async def generate_report(
    *,
    start_date: date,
    end_date: date,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    user_id: Optional[int] = None,
    project_id: Optional[int] = None,
    task_id: Optional[int] = None,
    status: Optional[TimeEntryStatus] = None,
):
    """Generate a PDF report of time entries."""
    try:
        # Check permissions
        if user_id and user_id != current_user.id:
            if not (current_user.is_superuser or current_user.role == UserRole.MANAGER):
                raise HTTPException(
                    status_code=403,
                    detail="Not enough permissions to generate report for other users"
                )

        # Get time entries
        query = db.query(TimeEntry).options(
            joinedload(TimeEntry.user),
            joinedload(TimeEntry.project),
            joinedload(TimeEntry.task)
        )

        # Apply date filters using func.date to compare only dates
        query = query.filter(
            func.date(TimeEntry.start_time) >= start_date,
            func.date(TimeEntry.start_time) <= end_date
        )

        # Apply user and project filters
        if user_id:
            query = query.filter(TimeEntry.user_id == user_id)
        else:
            if not current_user.is_superuser:
                query = query.filter(TimeEntry.user_id == current_user.id)

        if project_id:
            query = query.filter(TimeEntry.project_id == project_id)
            # If user is a manager, verify they manage this project
            if current_user.role == UserRole.MANAGER:
                project = db.query(Project).filter(
                    Project.id == project_id,
                    Project.manager_id == current_user.id
                ).first()
                if not project:
                    raise HTTPException(
                        status_code=403,
                        detail="Not authorized to access this project's time entries"
                    )

        # Apply task filter
        if task_id:
            query = query.filter(TimeEntry.task_id == task_id)

        # Apply status filter
        if status:
            query = query.filter(TimeEntry.status == status)

        # Get the time entries
        time_entries = query.order_by(TimeEntry.start_time.desc()).all()

        if not time_entries:
            raise HTTPException(
                status_code=404,
                detail="No time entries found for the selected criteria"
            )

        # Generate PDF
        try:
            pdf = create_pdf_report(
                time_entries=time_entries,
                user=current_user,
                start_date=start_date,
                end_date=end_date,
                project_id=project_id,
                task_id=task_id,
                status=status,
                db=db
            )
        except Exception as e:
            raise HTTPException(
                status_code=422,
                detail=f"Failed to generate PDF report: {str(e)}"
            )

        filename = f"timesheet-report-{datetime.now().strftime('%Y-%m-%d')}.pdf"
        
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/pdf",
                "Content-Length": str(len(pdf))
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate report: {str(e)}"
        ) 
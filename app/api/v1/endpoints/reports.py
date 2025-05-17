from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from datetime import datetime
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
from app.schemas.time_entry import TimeEntry

router = APIRouter()

def create_pdf_report(
    time_entries: list[TimeEntry],
    user: User,
    start_date: datetime,
    end_date: datetime,
    project_id: Optional[int] = None
) -> bytes:
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
    if project_id:
        project = crud_project.get(Session, id=project_id)
        if project:
            elements.append(Paragraph(f"Project: {project.name}", info_style))
    elements.append(Spacer(1, 20))

    # Summary Statistics
    total_hours = sum(
        (datetime.fromisoformat(entry.end_time.replace('Z', '+00:00')) - 
         datetime.fromisoformat(entry.start_time.replace('Z', '+00:00'))).total_seconds() / 3600
        for entry in time_entries if entry.end_time
    )
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
        project = crud_project.get(Session, id=entry.project_id)
        task = crud_task.get(Session, id=entry.task_id)
        start_time = datetime.fromisoformat(entry.start_time.replace('Z', '+00:00'))
        hours = 0
        if entry.end_time:
            end_time = datetime.fromisoformat(entry.end_time.replace('Z', '+00:00'))
            hours = (end_time - start_time).total_seconds() / 3600

        data.append([
            start_time.strftime('%Y-%m-%d'),
            project.name if project else 'Unknown',
            task.title if task else 'Unknown',
            entry.description,
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

@router.post("/generate")
async def generate_report(
    *,
    start_date: datetime,
    end_date: datetime,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    user_id: Optional[int] = None,
    project_id: Optional[int] = None,
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
        if current_user.is_superuser or current_user.role == UserRole.MANAGER:
            time_entries = crud_time_entry.get_multi_by_manager(
                db,
                manager_id=current_user.id,
                skip=0,
                limit=1000,
                project_id=project_id
            )
            if user_id:
                time_entries = [entry for entry in time_entries if entry.user_id == user_id]
        else:
            time_entries = crud_time_entry.get_multi_by_user(
                db,
                user_id=current_user.id,
                skip=0,
                limit=1000,
                project_id=project_id
            )

        # Filter by date range
        time_entries = [
            entry for entry in time_entries
            if start_date <= datetime.fromisoformat(entry.start_time.replace('Z', '+00:00')) <= end_date
        ]

        if not time_entries:
            raise HTTPException(
                status_code=404,
                detail="No time entries found for the selected criteria"
            )

        # Generate PDF
        pdf = create_pdf_report(
            time_entries=time_entries,
            user=current_user,
            start_date=start_date,
            end_date=end_date,
            project_id=project_id
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
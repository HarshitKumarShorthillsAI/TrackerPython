from typing import Any, Dict
import emails
from emails.template import JinjaTemplate
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

def send_email(
    email_to: str,
    subject_template: str = "",
    html_template: str = "",
    environment: Dict[str, Any] = {},
) -> None:
    """
    Send email using the emails library with the configured SMTP settings.
    """
    message = emails.Message(
        subject=JinjaTemplate(subject_template),
        html=JinjaTemplate(html_template),
        mail_from=(os.getenv("EMAILS_FROM_NAME", "Time Tracker"),
                  os.getenv("EMAILS_FROM_EMAIL", "kumarharshit8225@gmail.com"))
    )

    smtp_options = {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", 587)),
        "user": os.getenv("SMTP_USER", "kumarharshit8225@gmail.com"),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "tls": os.getenv("SMTP_TLS", "True").lower() == "true"
    }

    response = message.send(
        to=email_to,
        render=environment,
        smtp=smtp_options
    )
    
    if not response.status_code // 100 == 2:
        raise ValueError(f"Error sending email: {response}")

def send_password_reset_email(email_to: str, token: str) -> None:
    """
    Send a password reset email to a user.
    """
    project_name = "Time Tracker"
    subject = f"{project_name} - Password Recovery"
    
    with open(Path(__file__).parent.parent / "email-templates" / "password_reset.html") as f:
        template_str = f.read()
    
    server_host = "http://localhost:5173"  # Frontend URL
    link = f"{server_host}/reset-password?token={token}"
    
    send_email(
        email_to=email_to,
        subject_template=subject,
        html_template=template_str,
        environment={
            "project_name": project_name,
            "username": email_to,
            "email": email_to,
            "valid_hours": 24,
            "link": link,
        },
    ) 
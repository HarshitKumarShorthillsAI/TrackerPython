import logging
from typing import Any, Dict, Optional
from pathlib import Path

import emails
from emails.template import JinjaTemplate
from fastapi.encoders import jsonable_encoder

from app.core.config import settings

def send_email(
    email_to: str,
    subject_template: str = "",
    html_template: str = "",
    environment: Dict[str, Any] = {},
) -> None:
    assert settings.EMAILS_ENABLED, "no provided configuration for email variables"
    
    # Configure logging
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger(__name__)
    
    # Log email settings
    logger.debug(f"SMTP Settings: Host={settings.SMTP_HOST}, Port={settings.SMTP_PORT}, User={settings.SMTP_USER}")
    logger.debug(f"Sending email to: {email_to}")
    
    message = emails.Message(
        subject=JinjaTemplate(subject_template),
        html=JinjaTemplate(html_template),
        mail_from=(settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL),
    )
    
    smtp_options = {
        "host": settings.SMTP_HOST,
        "port": settings.SMTP_PORT,
        "timeout": 30,  # Increased timeout
        "debug": 1  # Enable SMTP debug
    }
    
    if settings.SMTP_TLS:
        smtp_options["tls"] = True
    if settings.SMTP_USER:
        smtp_options["user"] = settings.SMTP_USER
    if settings.SMTP_PASSWORD:
        smtp_options["password"] = settings.SMTP_PASSWORD
    
    logger.debug(f"SMTP Options: {smtp_options}")
    
    try:
        response = message.send(to=email_to, render=environment, smtp=smtp_options)
        logger.debug(f"Email send response: {response}")
        if response.status_code not in (250, 200, 201, 202):
            logger.error(f"Failed to send email: Status code {response.status_code}")
            raise Exception(f"Failed to send email: {response.error}")
        return response
    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        raise

def send_new_account_email(email_to: str, username: str, password: str) -> None:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - New account for user {username}"
    with open(Path(settings.EMAIL_TEMPLATES_DIR) / "new_account.html") as f:
        template_str = f.read()
    send_email(
        email_to=email_to,
        subject_template=subject,
        html_template=template_str,
        environment={
            "project_name": settings.PROJECT_NAME,
            "username": username,
            "password": password,
            "email": email_to,
        },
    ) 
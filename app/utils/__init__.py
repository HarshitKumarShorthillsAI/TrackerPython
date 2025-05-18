from pathlib import Path
from .email import send_email, send_password_reset_email

def send_new_account_email(email_to: str, username: str, password: str) -> None:
    """
    Send a new account email to a user.
    """
    project_name = "Time Tracker"
    subject = f"{project_name} - New Account"
    
    with open(Path(__file__).parent.parent / "email-templates" / "new_account.html") as f:
        template_str = f.read()
    
    send_email(
        email_to=email_to,
        subject_template=subject,
        html_template=template_str,
        environment={
            "project_name": project_name,
            "username": username,
            "password": password,
        },
    )
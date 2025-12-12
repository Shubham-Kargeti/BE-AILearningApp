"""Email service using aiosmtplib."""
from typing import Optional, List
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import get_settings

settings = get_settings()


async def send_email(
    to_email: str | List[str],
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None
) -> None:
    """
    Send email asynchronously.
    
    Args:
        to_email: Recipient email address(es)
        subject: Email subject
        html_body: HTML email body
        text_body: Plain text email body (optional)
        from_email: Sender email (defaults to config)
        from_name: Sender name (defaults to config)
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        # For development, just log the email
        print(f"📧 Email (dev mode):")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body: {html_body[:200]}...")
        return
    
    from_email = from_email or settings.SMTP_FROM_EMAIL
    from_name = from_name or settings.SMTP_FROM_NAME
    
    message = MIMEMultipart('alternative')
    message['Subject'] = subject
    message['From'] = f"{from_name} <{from_email}>"
    
    if isinstance(to_email, list):
        message['To'] = ', '.join(to_email)
    else:
        message['To'] = to_email
    
    # Add text and HTML parts
    if text_body:
        text_part = MIMEText(text_body, 'plain')
        message.attach(text_part)
    
    html_part = MIMEText(html_body, 'html')
    message.attach(html_part)
    
    # Send email
    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
    except Exception as e:
        print(f"Error sending email: {e}")
        raise

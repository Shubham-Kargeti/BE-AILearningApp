"""Celery tasks for email operations."""
import asyncio
import random
import string
from typing import Dict
from app.core.celery_app import celery_app
from config import get_settings

settings = get_settings()


@celery_app.task(
    name='app.core.tasks.email_tasks.send_otp_email',
    max_retries=3,
    default_retry_delay=60
)
def send_otp_email(email: str, otp: str) -> Dict:
    """
    Send OTP email to user.
    
    Args:
        email: User email address
        otp: One-time password
    
    Returns:
        Task result dict
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        result = loop.run_until_complete(_send_otp_email(email, otp))
        return result
    finally:
        loop.close()


async def _send_otp_email(email: str, otp: str) -> Dict:
    """Send OTP email asynchronously."""
    from app.core.email import send_email
    
    subject = f"Your OTP for {settings.APP_NAME}"
    body = f"""
    <html>
        <body>
            <h2>Welcome to {settings.APP_NAME}</h2>
            <p>Your One-Time Password (OTP) is:</p>
            <h1 style="color: #4CAF50; letter-spacing: 5px;">{otp}</h1>
            <p>This OTP will expire in {settings.OTP_EXPIRY_SECONDS // 60} minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <br>
            <p>Best regards,<br>{settings.APP_NAME} Team</p>
        </body>
    </html>
    """
    
    await send_email(
        to_email=email,
        subject=subject,
        html_body=body
    )
    
    return {
        'email': email,
        'status': 'sent',
        'message': 'OTP email sent successfully'
    }


@celery_app.task(
    name='app.core.tasks.email_tasks.send_score_notification',
    max_retries=3
)
def send_score_notification(
    email: str,
    session_id: str,
    score_percentage: float
) -> Dict:
    """
    Send score notification email.
    
    Args:
        email: User email address
        session_id: Test session ID
        score_percentage: Score percentage
    
    Returns:
        Task result dict
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        result = loop.run_until_complete(
            _send_score_notification(email, session_id, score_percentage)
        )
        return result
    finally:
        loop.close()


async def _send_score_notification(
    email: str,
    session_id: str,
    score_percentage: float
) -> Dict:
    """Send score notification email asynchronously."""
    from app.core.email import send_email
    
    subject = f"Your Test Results - {settings.APP_NAME}"
    
    # Determine performance level
    if score_percentage >= 80:
        performance = "Excellent"
        color = "#4CAF50"
    elif score_percentage >= 60:
        performance = "Good"
        color = "#2196F3"
    else:
        performance = "Needs Improvement"
        color = "#FF9800"
    
    body = f"""
    <html>
        <body>
            <h2>{settings.APP_NAME} - Test Results</h2>
            <p>Your test has been evaluated. Here are your results:</p>
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
                <h3 style="color: {color};">Performance: {performance}</h3>
                <h1 style="color: {color}; font-size: 48px;">{score_percentage:.1f}%</h1>
                <p>Session ID: {session_id}</p>
            </div>
            <p>Thank you for taking the test!</p>
            <br>
            <p>Best regards,<br>{settings.APP_NAME} Team</p>
        </body>
    </html>
    """
    
    await send_email(
        to_email=email,
        subject=subject,
        html_body=body
    )
    
    return {
        'email': email,
        'session_id': session_id,
        'score_percentage': score_percentage,
        'status': 'sent'
    }


def generate_otp(length: int = 6) -> str:
    """Generate random OTP."""
    return ''.join(random.choices(string.digits, k=length))

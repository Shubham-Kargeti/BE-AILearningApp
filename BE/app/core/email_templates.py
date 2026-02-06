"""
Email template helpers for sending professional assessment emails.
"""
from typing import Optional
from datetime import datetime


def assessment_invitation_email(
    candidate_name: str,
    assessment_title: str,
    role: str,
    assessment_link: str,
    duration_minutes: int,
    expires_at: Optional[datetime] = None,
    admin_name: Optional[str] = None,
    admin_email: Optional[str] = None,
    additional_instructions: Optional[str] = None
) -> str:
    """
    Generate HTML email for assessment invitation.
    
    Args:
        candidate_name: Candidate's name
        assessment_title: Title of the assessment
        role: Job role/position
        assessment_link: Unique assessment URL
        duration_minutes: Test duration in minutes
        expires_at: Expiration datetime
        admin_name: Name of admin/recruiter
        admin_email: Admin contact email
        additional_instructions: Extra instructions for candidate
    
    Returns:
        HTML email body
    """
    expiry_text = ""
    if expires_at:
        expiry_text = f"""
        <div style="background-color: #fff3cd; padding: 12px; border-radius: 5px; margin: 15px 0;">
            <strong>⏰ Important:</strong> This assessment expires on {expires_at.strftime('%B %d, %Y at %I:%M %p')}
        </div>
        """
    
    additional_text = ""
    if additional_instructions:
        additional_text = f"""
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">📋 Additional Instructions:</h3>
            <p style="margin-bottom: 0;">{additional_instructions}</p>
        </div>
        """
    
    contact_text = ""
    if admin_name or admin_email:
        contact_info = admin_name or admin_email
        if admin_email and admin_name:
            contact_info = f'{admin_name} (<a href="mailto:{admin_email}">{admin_email}</a>)'
        contact_text = f"""
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Questions? Contact {contact_info}
        </p>
        """
    
    return f"""
    <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
            <div style="max-width: 600px; margin: 20px auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">Assessment Invitation</h1>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <p style="font-size: 16px;">Dear <strong>{candidate_name}</strong>,</p>
                    
                    <p>You've been invited to complete an assessment for the position of <strong>{role}</strong>.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h2 style="margin-top: 0; color: #667eea;">📝 {assessment_title}</h2>
                        <p style="margin: 10px 0;"><strong>Position:</strong> {role}</p>
                        <p style="margin: 10px 0;"><strong>Duration:</strong> {duration_minutes} minutes</p>
                        <p style="margin: 10px 0;"><strong>Format:</strong> Online Assessment</p>
                    </div>
                    
                    {expiry_text}
                    
                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{assessment_link}" 
                           style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                            Start Assessment →
                        </a>
                    </div>
                    
                    <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #2e7d32;">✓ Before You Begin:</h3>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            <li>Find a quiet place with stable internet connection</li>
                            <li>Ensure you have {duration_minutes} minutes of uninterrupted time</li>
                            <li>Use a desktop or laptop for the best experience</li>
                            <li>Close other browser tabs and applications</li>
                        </ul>
                    </div>
                    
                    {additional_text}
                    
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        <strong>Note:</strong> This is a unique assessment link. Please do not share it with others.
                    </p>
                    
                    {contact_text}
                    
                    <p style="margin-top: 30px;">Good luck!</p>
                    <p style="margin: 5px 0;"><strong>AI Learning App Team</strong></p>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="color: #999; font-size: 12px; margin: 5px 0;">
                        This is an automated email from AI Learning App.
                    </p>
                    <p style="color: #999; font-size: 12px; margin: 5px 0;">
                        © {datetime.now().year} AI Learning App. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
    </html>
    """


def assessment_completion_email(
    candidate_name: str,
    assessment_title: str,
    score_percentage: Optional[float] = None,
    total_questions: int = 0,
    correct_answers: int = 0,
    time_taken_minutes: Optional[int] = None,
    next_steps: Optional[str] = None
) -> str:
    """
    Generate HTML email for assessment completion notification.
    
    Args:
        candidate_name: Candidate's name
        assessment_title: Title of the assessment
        score_percentage: Score percentage (if scores are released)
        total_questions: Total number of questions
        correct_answers: Number of correct answers
        time_taken_minutes: Time taken to complete
        next_steps: Information about next steps
    
    Returns:
        HTML email body
    """
    score_section = ""
    if score_percentage is not None:
        score_color = "#4CAF50" if score_percentage >= 70 else "#FF9800" if score_percentage >= 50 else "#f44336"
        performance = "Excellent" if score_percentage >= 70 else "Good" if score_percentage >= 50 else "Needs Improvement"
        
        score_section = f"""
        <div style="background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%); padding: 25px; border-radius: 10px; text-align: center; margin: 25px 0;">
            <h2 style="color: {score_color}; margin: 0 0 10px 0; font-size: 36px;">{score_percentage:.1f}%</h2>
            <p style="color: {score_color}; font-weight: bold; font-size: 18px; margin: 0;">Performance: {performance}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; color: #2e7d32; font-weight: bold; font-size: 24px;">{correct_answers}</p>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Correct Answers</p>
            </div>
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; color: #1976d2; font-weight: bold; font-size: 24px;">{total_questions}</p>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Total Questions</p>
            </div>
        </div>
        """
    else:
        score_section = """
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
                <strong>⏳ Results Pending:</strong> Your assessment has been submitted successfully. 
                Results will be shared with you soon.
            </p>
        </div>
        """
    
    time_section = ""
    if time_taken_minutes:
        time_section = f"""
        <p style="color: #666; font-size: 14px;">
            <strong>Time Taken:</strong> {time_taken_minutes} minutes
        </p>
        """
    
    next_steps_section = ""
    if next_steps:
        next_steps_section = f"""
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #1976d2;">🎯 Next Steps:</h3>
            <p style="margin-bottom: 0;">{next_steps}</p>
        </div>
        """
    
    return f"""
    <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
            <div style="max-width: 600px; margin: 20px auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">✅ Assessment Completed!</h1>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <p style="font-size: 16px;">Dear <strong>{candidate_name}</strong>,</p>
                    
                    <p>Thank you for completing the <strong>{assessment_title}</strong> assessment!</p>
                    
                    {score_section}
                    {time_section}
                    {next_steps_section}
                    
                    <p style="margin-top: 30px;">We appreciate the time and effort you invested in this assessment.</p>
                    
                    <p style="margin-top: 30px;">Best regards,</p>
                    <p style="margin: 5px 0;"><strong>AI Learning App Team</strong></p>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="color: #999; font-size: 12px; margin: 5px 0;">
                        This is an automated email from AI Learning App.
                    </p>
                    <p style="color: #999; font-size: 12px; margin: 5px 0;">
                        © {datetime.now().year} AI Learning App. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
    </html>
    """

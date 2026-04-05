# accounts/utils.py

import random
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

def generate_6_digit_code():
    """Generates a random 6-digit code."""
    return str(random.randint(100000, 999999))

def send_deletion_code_email(user, code):
    """Sends the account deletion confirmation code to the user."""
    subject = "Your Account Deletion Code"
    context = {
        'user': user,
        'code': code,
        'brandName': 'Publisha',  # Or pull from settings
    }
    html_content = render_to_string('emails/account_deletion_code.html', context)
    
    message = Mail(
        from_email=settings.DEFAULT_FROM_EMAIL,
        to_emails=[user.email],
        subject=subject,
        html_content=html_content
    )
    try:
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(message)
        # Returns True if email was sent successfully
        return response.status_code == 202
    except Exception as e:
        # You might want to log this error
        print(f"Error sending deletion code email: {e}")
        return False
# accounts/forms.py
from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.db import transaction
from django.contrib.auth import get_user_model
from .models import Organization, OrganizationMember
from django.contrib.auth.forms import PasswordResetForm
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from django.template.loader import render_to_string
from django.conf import settings
from django.urls import reverse
from django.core.exceptions import ValidationError

class LoginForm(AuthenticationForm):
    # The field name MUST be 'username' because that is what Django's LoginView
    # passes to the authenticate function. We just change how it LOOKS.
    username = forms.EmailField(
        label='Email',
        widget=forms.EmailInput(
            attrs={'placeholder': 'Your Email', 'autofocus': True})
    )
    password = forms.CharField(
        label='Password',
        strip=False,
        widget=forms.PasswordInput(attrs={'placeholder': 'Your Password'}),
    )


class SignUpForm(UserCreationForm):
    first_name = forms.CharField(
        max_length=30, required=True, help_text='Required.')
    last_name = forms.CharField(
        max_length=30, required=True, help_text='Required.')
    email = forms.EmailField(max_length=254, required=True,
                             help_text='Required. Enter a valid email address.')

    class Meta(UserCreationForm.Meta):
        model = get_user_model()
        fields = ('username', 'first_name', 'last_name', 'email')

    def __init__(self, *args, **kwargs):
        super(SignUpForm, self).__init__(*args, **kwargs)
        self.fields['username'].widget.attrs['placeholder'] = 'Choose a Username'
        self.fields['first_name'].widget.attrs['placeholder'] = 'First Name'
        self.fields['last_name'].widget.attrs['placeholder'] = 'Last Name'
        self.fields['email'].widget.attrs['placeholder'] = 'Your Email'
        self.fields['password1'].widget.attrs['placeholder'] = 'Enter Password'
        self.fields['password2'].widget.attrs['placeholder'] = 'Confirm Password'
        for fieldname in self.fields:
            self.fields[fieldname].help_text = ''

    def clean_email(self):
        """
        Custom validation to prevent creating a duplicate account
        if an *active* user with the same email already exists.
        The `save` method will handle reactivating inactive accounts.
        """
        email = self.cleaned_data.get('email').lower()
        User = get_user_model()

        # Check only for ACTIVE users.
        if User.objects.filter(email__iexact=email, is_active=True).exists():
            raise ValidationError("A user with this email already exists.")
            
        return email

    @transaction.atomic
    def save(self, commit=True):
        """
        This method handles both creating a new user and reactivating
        an existing, inactive user.
        """
        User = get_user_model()
        email = self.cleaned_data.get('email').lower()
        
        # Use the manager that can find all users, including inactive ones.
        manager = getattr(User, 'all_objects', User.objects)

        try:
            # Check if any user (active or inactive) exists with this email.
            user = manager.get(email__iexact=email)
            
            # If we found a user, it must be inactive, because clean_email()
            # would have raised an error for an active user.
            # We will reactivate and update this user's details.
            user.username = self.cleaned_data['username']
            user.first_name = self.cleaned_data['first_name']
            user.last_name = self.cleaned_data['last_name']
            user.set_password(self.cleaned_data['password2']) # Set the new password
            user.is_active = True
            
            if commit:
                user.save()
            
            return user

        except User.DoesNotExist:
            # If no user was found, proceed with the default behavior:
            # create a new user instance.
            user = super().save(commit=False)
            user.first_name = self.cleaned_data['first_name']
            user.last_name = self.cleaned_data['last_name']
            user.email = email

            if commit:
                user.save()
            
            return user

class CustomPasswordResetForm(PasswordResetForm):
    def send_mail(self, subject_template_name, email_template_name,
                  context, from_email, to_email, html_email_template_name=None):
        """
        Send a password reset email using SendGrid with a custom template context.
        """
        # 1. Build the full password reset URL from the context provided by Django
        protocol = context['protocol']
        domain = context['domain']
        uid = context['uid']
        token = context['token']
        reset_path = reverse('password_reset_confirm', kwargs={'uidb64': uid, 'token': token})
        reset_link = f"{protocol}://{domain}{reset_path}"

        # 2. Create a new context for your beautiful HTML template
        email_context = {
            'user': context['user'],
            'reset_link': reset_link,
            'brandName': 'Publisha',  # Or pull from settings: settings.BRAND_NAME
            'support_email': 'info@publisha.io' # Or pull from settings: settings.SUPPORT_EMAIL
        }

        # 3. Render the subject and HTML content with the new context
        subject = render_to_string(subject_template_name, email_context)
        subject = ''.join(subject.splitlines())
        html_content = render_to_string(html_email_template_name, email_context)

        # 4. Send the email using SendGrid
        message = Mail(
            from_email=settings.DEFAULT_FROM_EMAIL,
            to_emails=[to_email],
            subject=subject,
            html_content=html_content
        )
        try:
            sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
            response = sg.send(message)
            if response.status_code != 202:
                print(f"Error from SendGrid: {response.body}")
        except Exception as e:
            print(f"Error sending password reset email with SendGrid: {e}")
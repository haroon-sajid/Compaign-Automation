# profilesettings/views.py
from django.shortcuts import render, redirect
from django.views import View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from .forms import ProfileUpdateForm, AvatarUpdateForm, ApiSettingsForm, CustomPasswordChangeForm
from accounts.models import Profile
import uuid
from django.contrib.auth import update_session_auth_hash, logout
from django.core.mail import send_mail
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from django.conf import settings
import random
from django.utils import timezone
from datetime import timedelta
from accounts.utils import generate_6_digit_code, send_deletion_code_email


class SecuritySettingsView(LoginRequiredMixin, View):
    template_name = 'profilesettings/security_settings.html'

    def get(self, request, *args, **kwargs):
        profile, created = Profile.objects.get_or_create(user=request.user)

        # We only need these three forms for this page
        profile_form = ProfileUpdateForm(instance=request.user)
        avatar_form = AvatarUpdateForm(instance=profile)
        password_form = CustomPasswordChangeForm(user=request.user)

        context = {
            'profile_form': profile_form,
            'avatar_form': avatar_form,
            'password_form': password_form,
        }
        return render(request, self.template_name, context)

    def post(self, request, *args, **kwargs):
        action = request.POST.get('action')
        profile, created = Profile.objects.get_or_create(user=request.user)

        # Initialize forms to pass back to the template
        profile_form = ProfileUpdateForm(instance=request.user)
        avatar_form = AvatarUpdateForm(instance=request.user.profile)
        password_form = CustomPasswordChangeForm(
            user=request.user, data=request.POST if action == 'save_security' else None)

        if action == 'save_profile':
            form = ProfileUpdateForm(request.POST, instance=request.user)
            if form.is_valid():
                form.save()
                messages.success(
                    request, 'Your profile details have been updated!', extra_tags='profile')
                # Redirect to the new page
                return redirect('security_settings')
            else:
                profile_form = form
                messages.error(
                    request, 'Please correct the errors in the profile form.')

        elif action == 'save_avatar':
            # Note: This logic is now handled by JavaScript/Fetch, but we keep it
            # as a fallback or for non-JS scenarios if ever needed.
            # The fetch call will trigger a page reload on success.
            form = AvatarUpdateForm(
                request.POST, instance=request.user.profile)
            if form.is_valid():
                form.save()
                messages.success(request, 'Your avatar has been updated!', extra_tags='profile')
                # Redirect to the new page
                return redirect('security_settings')
            else:
                avatar_form = form
                messages.error(
                    request, 'There was an error updating your avatar.')

        elif action == 'save_security':
            form = CustomPasswordChangeForm(
                user=request.user, data=request.POST)
            if form.is_valid():
                user = form.save()
                update_session_auth_hash(request, user)
                messages.success(
                    request, 'Your password was successfully updated!', extra_tags='profile')
                # Redirect to the new page
                return redirect('security_settings')
            else:
                password_form = form
                messages.error(
                    request, 'Please correct the password errors below.')

        elif action == 'start_2fa_setup':
            # Generate a 6-digit code
            code = str(random.randint(100000, 999999))

            # Save the code and its expiration time (e.g., 10 minutes from now)
            profile.two_factor_code = code
            profile.two_factor_code_expires = timezone.now() + timedelta(minutes=10)
            profile.save()

            # Send the code to the user's email
            subject = 'Your Two-Factor Authentication Code'
            message = f'Your verification code is: {code}\n\nThis code will expire in 10 minutes.'

            try:
                mail = Mail(
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to_emails=request.user.email,
                    subject=subject,
                    html_content=message.replace('\n', '<br>'),
                )
                sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
                sg.send(mail)
            except Exception as e:
                messages.error(
                    request, f"Failed to send verification email via SendGrid: {e}", extra_tags='profile')

            # Set a session flag to indicate that we're waiting for code verification
            request.session['2fa_setup_in_progress'] = True
            messages.success(
                request, 'A verification code has been sent to your email.')
            return redirect('security_settings')

        elif action == 'verify_2fa_code':
            submitted_code = request.POST.get('verification_code')

            # Check if the code is correct and not expired
            if (submitted_code == profile.two_factor_code and
                    profile.two_factor_code_expires and
                    timezone.now() < profile.two_factor_code_expires):

                # Success! Enable 2FA and clear temporary fields
                profile.two_factor_enabled = True
                profile.two_factor_code = None
                profile.two_factor_code_expires = None
                profile.save()

                # Clear the session flag
                if '2fa_setup_in_progress' in request.session:
                    del request.session['2fa_setup_in_progress']

                messages.success(
                    request, 'Two-Factor Authentication has been successfully enabled!')
            else:
                messages.error(
                    request, 'Invalid or expired code. Please try again.')

            return redirect('security_settings')

        elif action == 'disable_2fa':
            profile.two_factor_enabled = False
            profile.save()

            subject = 'Two-Factor Authentication Disabled'
            message = 'Hello, this is a notification that 2FA has been disabled on your account.'

            try:
                mail = Mail(
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to_emails=request.user.email,
                    subject=subject,
                    html_content=message,
                )
                sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
                sg.send(mail)
            except Exception as e:
                messages.error(
                    request, f"Failed to send disable notification via SendGrid: {e}")

            messages.warning(
                request, 'Two-Factor Authentication has been disabled.')
            return redirect('security_settings')
        elif action == 'initiate_account_deletion':
            code = generate_6_digit_code()
            print("Generated deletion code:", code)
            profile.delete_confirmation_code = code
            profile.delete_confirmation_code_expires = timezone.now() + timedelta(minutes=10)
            profile.save()

            if send_deletion_code_email(request.user, code):
                request.session['deletion_in_progress'] = True
                messages.info(request, 'A confirmation code has been sent to your email to verify deletion.')
            else:
                messages.error(request, 'We failed to send the confirmation email. Please try again later.')
            return redirect('security_settings')

        elif action == 'confirm_account_deletion':
            submitted_code = request.POST.get('deletion_code', '').strip()
            
            # Security check: ensure the user is in the deletion flow
            if not request.session.get('deletion_in_progress'):
                return redirect('security_settings')
            
            # Check if code is expired
            if timezone.now() > profile.delete_confirmation_code_expires:
                messages.error(request, 'The confirmation code has expired. Please start over.')
            # Check if code is correct
            elif submitted_code == profile.delete_confirmation_code:
                user = request.user
                user.soft_delete()  # Assumes CustomUser has a soft_delete() method
                logout(request)
                messages.success(request, 'Your account has been successfully deleted.')
                return redirect('public:home') # Redirect to the homepage after deletion
            else:
                messages.error(request, 'The confirmation code you entered is incorrect.')

            # On failure or expiration, reset the process
            profile.delete_confirmation_code = None
            profile.delete_confirmation_code_expires = None
            profile.save()
            if 'deletion_in_progress' in request.session:
                del request.session['deletion_in_progress']
            return redirect('security_settings')

        elif action == 'cancel_account_deletion':
            profile.delete_confirmation_code = None
            profile.delete_confirmation_code_expires = None
            profile.save()
            if 'deletion_in_progress' in request.session:
                del request.session['deletion_in_progress']
            messages.info(request, 'Account deletion has been cancelled.')
            return redirect('security_settings')

        # Always return all forms, even if one has errors
        context = {
            'profile_form': profile_form,
            'avatar_form': avatar_form,
            'password_form': password_form,
        }
        return render(request, self.template_name, context)

# organizations/views.py

from venv import logger
from django.conf import settings as django_settings
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.conf import settings
from django.template.loader import render_to_string
from django.core.mail import send_mail
import uuid
from integrations.models import Integration
from integrations.forms import WordPressConnectionForm
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from dateutil.relativedelta import relativedelta 
# Model and Form imports

from accounts.models import Organization, OrganizationMember, OrganizationSettings, Plan
from .forms import MemberInviteForm, RoleChangeForm, OrganizationSettingsForm

from .models import Invitation
from campaignhub.models import Post
# Decorator import
from accounts.decorators import role_required

import datetime
from django.utils import timezone
from django.views.decorators.http import require_POST
import json
from django.http import JsonResponse


PLAN_USER_LIMITS = {
    'free': 2,
    'starter': 3,
    'pro': 6,
    'business': 11,
    'enterprise': None,  # None means unlimited

}


@login_required
def accept_invitation(request, invitation_id):
    try:
        # Find the specific invitation, ensuring it belongs to the logged-in user
        invitation = Invitation.objects.get(
            id=invitation_id, email__iexact=request.user.email
        )
    except Invitation.DoesNotExist:
        # The invitation does not exist or is not for this user.
        messages.error(
            request,
            "This invitation link is invalid or has expired. "
            "It may have already been accepted or was intended for a different user."
        )
        return redirect('dashboard:dashboard') # Redirect to a safe page

    organization = invitation.organization
    current_plan = organization.settings.subscription_plan
    user_limit = PLAN_USER_LIMITS.get(current_plan)

    if user_limit is not None:
        current_member_count = OrganizationMember.objects.filter(
            organization=organization).count()
        if current_member_count >= user_limit:
            messages.error(
                request,
                f'Could not join "{organization.name}". The organization has reached its member limit for the \'{current_plan}\' plan.'
            )
            return redirect('dashboard:dashboard')

    # Add the user as a member to the organization
    OrganizationMember.objects.get_or_create(
        organization=invitation.organization,
        user=request.user,
        defaults={'role': invitation.role}
    )

    # Delete the invitation so it can't be used again
    invitation.delete()
    messages.success(
        request, f'You have successfully joined the "{invitation.organization.name}" organization!')
    request.session['active_organization_id'] = invitation.organization.id
    return redirect('dashboard:dashboard')

@login_required
@require_POST  
def decline_invitation(request, invitation_id):
    """
    Allows a logged-in user to decline and delete a pending invitation
    sent to their email.
    """
    try:
        # Find the invitation, ensuring it belongs to the logged-in user
        invitation = Invitation.objects.get(
            id=invitation_id, 
            email__iexact=request.user.email
        )
        
        # Store the organization name for the message before deleting
        org_name = invitation.organization.name
        invitation.status = Invitation.Status.DECLINED
        # invitation.delete()
        invitation.save() 
        
        messages.success(
            request, 
            f'You have successfully declined the invitation to join "{org_name}".'
        )

    except Invitation.DoesNotExist:
        # This handles the case where the invitation was already cancelled by an admin
        messages.warning(
            request, 
            "This invitation is no longer valid or has been withdrawn."
        )
    
    return redirect('dashboard:dashboard')

@login_required
@role_required('ADMIN')
def manage_members(request):
    organization = request.active_organization
    members = OrganizationMember.objects.filter(
        organization=organization).select_related('user')
    pending_invitations = Invitation.objects.filter(organization=organization)
    print('the pending invitation for this user is:', pending_invitations.__dict__)

    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'invite_member':
            form = MemberInviteForm(request.POST)

            # --- LOGIC FOR INVITING ---
            current_plan = organization.settings.subscription_plan
            user_limit = PLAN_USER_LIMITS.get(
                current_plan)  # Will be None for enterprise

            # Check limit only if the plan is not unlimited
            if user_limit is not None:
                # Check against current members + pending invitations for better UX
                total_potential_members = members.count() + pending_invitations.count()
                if total_potential_members >= user_limit:
                    messages.error(
                        request,
                        f"Your '{current_plan}' plan allows up to {user_limit -1} members. "
                        f"You cannot send more invitations. Please upgrade your plan or cancel a pending invitation.",
                        extra_tags="manage_members"
                    )
                    return redirect('organizations:manage_members')
            if form.is_valid():
                email = form.cleaned_data['email'].lower()
                # Security checks
                if email == request.user.email:
                    messages.error(request, "You cannot invite yourself.", extra_tags='manage_members')
                    return redirect('organizations:manage_members')
                if members.filter(user__email__iexact=email).exists():
                    messages.warning(request, f'{email} is already a member.', extra_tags='manage_members')
                    return redirect('organizations:manage_members')
                if pending_invitations.filter(email__iexact=email).exists():
                    messages.warning(
                        request, f'An invitation has already been sent to {email}.', extra_tags='manage_members')
                    return redirect('organizations:manage_members')

                # Create invitation and send email
                invitation = Invitation.objects.create(
                    email=email,
                    organization=organization,
                    role=OrganizationMember.Role.VIEWER,
                    invited_by=request.user
                )

                subject = f"You're invited to join {organization.name}!"
                message = render_to_string('organizations/email/invitation_email.html', {
                    'invitation': invitation,
                    'organization': organization,
                    'inviter': request.user
                })

                try:
                    mail = Mail(
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        to_emails=email,
                        subject=subject,
                        html_content=message,
                    )
                    sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
                    response = sg.send(mail)
                    
                    print('The email api response:',response.status_code)

                    if response.status_code == 202:
                        messages.success(
                            request, f'An invitation has been sent to {email}.', extra_tags='manage_members')
                    else:
                        messages.error(
                            request,
                            f"SendGrid responded with status {response.status_code}: {response.body.decode()}", extra_tags='manage_members'
                        )
                        invitation.delete()

                except Exception as e:
                    messages.error(
                        request, f"Failed to send email via SendGrid: {e}")
                    invitation.delete()

            return redirect('organizations:manage_members')

        elif action == 'change_role':
            member_id = request.POST.get('member_id')
            member = get_object_or_404(
                OrganizationMember, id=member_id, organization=organization)
            if member.user == organization.owner:
                messages.error(
                    request, "The organization owner's role cannot be changed.", extra_tags='manage_members')
                return redirect('organizations:manage_members')
            form = RoleChangeForm(request.POST)
            if form.is_valid():
                member.role = form.cleaned_data['role']
                member.save()
                messages.success(
                    request, f"Updated {member.user.email}'s role.", extra_tags='manage_members')
            return redirect('organizations:manage_members')

        elif action == 'remove_member':
            member_id = request.POST.get('member_id')
            member = get_object_or_404(
                OrganizationMember, id=member_id, organization=organization)
            if member.user == organization.owner:
                messages.error(
                    request, "The organization owner cannot be removed.", extra_tags='manage_members')
                return redirect('organizations:manage_members')
            member.delete()
            messages.success(
                request, f'Removed {member.user.email} from the organization.', extra_tags='manage_members')
            return redirect('organizations:manage_members')

        elif action == 'cancel_invitation':
            invitation_id = request.POST.get('invitation_id')
            try:
                invitation = Invitation.objects.get(
                    id=invitation_id,
                    organization=organization
                )
                
                # If the invitation is found, get the email before deleting
                email = invitation.email
                invitation.delete()
                messages.success(
                    request, f"The invitation for {email} has been cancelled.", extra_tags='manage_members')

            except Invitation.DoesNotExist:
                # This block will run if the invitation was already accepted/deleted
                messages.warning(
                    request, 
                    "Could not cancel the invitation. It may have already been accepted by the user.", 
                    extra_tags='manage_members'
                )
            
            return redirect('organizations:manage_members')
        
    role_form = RoleChangeForm()

    # 2. Filter the choices for the 'role' field on that instance
    # This creates a new list of choices that EXCLUDES 'CUSTOMADMIN'
    role_form.fields['role'].choices = [
        (value, label) for value, label in OrganizationMember.Role.choices
        if value != OrganizationMember.Role.CUSTOMADMIN
    ]
    
    print('the pending invitation going to frontned is this:', pending_invitations.values())

    context = {
        'members': members,
        'pending_invitations': pending_invitations,
        'invite_form': MemberInviteForm(),
        'role_change_form': role_form,
    }
    return render(request, 'organizations/manage_members.html', context)


@login_required
@role_required('ADMIN', 'EDITOR')
def organization_settings(request):
    organization = request.active_organization
    print(f"\n--- ORGANIZATION_SETTINGS VIEW ---")
    print(f"Loading settings for Organization (ID: {organization.id}, Name: {organization.name})")

    if not organization:
        messages.error(request, "No active organization found.")
        return redirect('dashboard:dashboard')

    # # Get or create organization-specific settings
    org_settings = OrganizationSettings.objects.get(
        organization=organization
    )
    wp_integration = Integration.objects.filter(
        organization=organization, provider=Integration.Provider.WORDPRESS
    ).first()
    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'save_settings':
            form = OrganizationSettingsForm(request.POST, instance=org_settings)
            if form.is_valid():
                form.save()
                messages.success(request, 'Organization settings have been updated.')
                return redirect('organizations:organization_settings')
        elif action == 'regenerate_api_key':
            org_settings.api_key = uuid.uuid4()
            org_settings.save()
            messages.success(request, 'A new API key has been generated.', extra_tags='integrations')
            return redirect('organizations:organization_settings')

    # --- USAGE LOGIC ---

    plan = org_settings.subscription_plan

    # --- 1. Post Credit Usage Calculation ---
    if plan:
        plan_name = plan.get_name_display()
        # The total credits for the period is the plan's grant
        credit_limit_for_period = plan.credit_grant
    else:
        plan_name = "Free"
        # Fallback to the default free grant if no plan is set
        try:
            credit_limit_for_period = Plan.objects.get(name='free').credit_grant
        except Plan.DoesNotExist:
            credit_limit_for_period = 1

    credits_left = org_settings.output_credits_remaining
    logger.info(f"Credit limit for period: {credit_limit_for_period}, Credits left: {credits_left}")
    credits_used = max(credit_limit_for_period - credits_left, 0)

    # Calculate usage percentage
    usage_percentage = 0
    if credit_limit_for_period and credit_limit_for_period > 0:
        usage_percentage = min((credits_used / credit_limit_for_period) * 100, 100)

    # Calculate the "resets on" date for display purposes
    resets_on_text = "This is a one-time free trial allowance."
    if plan and plan.name != 'free':
        now = timezone.now()
        anchor_date = org_settings.subscription_start_date or organization.created_at
        months_diff = (now.year - anchor_date.year) * 12 + now.month - anchor_date.month
        period_start = anchor_date + relativedelta(months=months_diff)
        if period_start > now and months_diff > 0:
            period_start -= relativedelta(months=1)
        period_end = period_start + relativedelta(months=1)
        resets_on_text = f"Resets on {period_end.strftime('%b %d, %Y')}"

    # This is the data for your JavaScript-powered usage card
    usage_data = {
        "planName": plan_name.capitalize(),
        "currentUsage": credits_used,
        "outputLimit": credit_limit_for_period,
        "outputsLeft": credits_left,
        "usagePercentage": round(usage_percentage, 2),
        "resetsOn": resets_on_text
    }

    # --- 2. Campaign Usage Calculation ---
    campaigns_used = org_settings.campaigns_created_this_period
    campaign_limit = plan.campaign_limit if plan else 1 # Get limit from plan

    if campaign_limit is None:
        campaigns_remaining = "Unlimited"
    else:
        campaigns_remaining = max(campaign_limit - campaigns_used, 0)

    print(f"Usage Data: {usage_data}")
    settings_form = OrganizationSettingsForm(instance=org_settings)
    wp_form = WordPressConnectionForm(instance=wp_integration)

    context = {
        'settings_form': settings_form,
        'organization': organization,
        'settings': org_settings,
        'STRIPE_PUBLISHABLE_KEY': django_settings.STRIPE_PUBLISHABLE_KEY,
        'wp_form': wp_form,
        'wp_integration': wp_integration,
        'usage_data': usage_data,
        'campaigns_used': campaigns_used,
        'campaign_limit': campaign_limit,
        'campaigns_remaining': campaigns_remaining,
    }
    return render(request, 'organizations/organization_settings.html', context)

@login_required
@require_POST 
def request_access(request):
    """
    Handles a user's request for elevated access to a specific organization.
    It identifies the organization owner or inviter and sends them an email notification.
    """
    try:
        print("the request access is this")
        # 1. Parse the incoming JSON data from the frontend
        data = json.loads(request.body)
        org_name = data.get('team')
        requested_role = data.get('requestedRole')
        page_path = data.get('path')

        # 2. Basic validation
        if not all([org_name, requested_role, page_path]):
            return JsonResponse({'status': 'error', 'message': 'Missing data.'}, status=400)

        # 3. Identify the organization and the user making the request
        organization = get_object_or_404(Organization, name=org_name)
        requester = request.user

        # 4. Find who to notify. 
        # The best person is the organization owner. This is the most reliable approach.
        # Notifying the "inviter" can be complex if they are no longer an admin.
        # The owner always has the authority to manage roles.
        recipient = organization.owner
        
        if not recipient:
            # Fallback in case there's no owner set, though this is unlikely
            return JsonResponse({'status': 'error', 'message': 'Organization has no owner to notify.'}, status=500)

        # 5. Prepare and send the email
        subject = f"Access Request for {organization.name}"
        
        # We will create this new email template in the next step
        message = render_to_string('organizations/email/access_request_email.html', {
            'requester': requester,
            'organization': organization,
            'recipient': recipient,
            'requested_role': requested_role,
            'page_path': page_path,
        })
        
        # Use the same SendGrid logic you have elsewhere
        mail = Mail(
            from_email=settings.DEFAULT_FROM_EMAIL,
            to_emails=recipient.email,
            subject=subject,
            html_content=message,
        )
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(mail)

        if response.status_code != 202:
            # If SendGrid fails, return an error
            return JsonResponse({'status': 'error', 'message': 'Failed to send notification email.'}, status=500)

        return JsonResponse({'status': 'success', 'message': 'Request sent successfully.'})

    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON.'}, status=400)
    except Organization.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Organization not found.'}, status=404)
    except Exception as e:
        # Catch any other unexpected errors
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
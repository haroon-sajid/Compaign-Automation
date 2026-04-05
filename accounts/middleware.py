# accounts/middleware.py

from .models import Organization, OrganizationMember
from django.middleware.csrf import CsrfViewMiddleware
from django.http import HttpResponseForbidden
from django.contrib.auth import logout
from django.shortcuts import redirect
from django.conf import settings


class ActiveOrganizationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            active_org = None
            active_member_role = None

            # First, try to get the org from the session (This part is correct)
            active_org_id = request.session.get('active_organization_id')
            if active_org_id:
                try:
                    active_org = request.user.organizations.get(
                        id=active_org_id)
                except Organization.DoesNotExist:
                    request.session.pop('active_organization_id', None)

            # If no org is active yet, set a default.
            # We will now PRIORITIZE the organization the user owns.
            if not active_org and request.user.organizations.exists():

                # 1. Try to find the user's own organization first.
                #    The (Default) tag in your template uses this logic, so we'll use it here.
                owned_org = request.user.organizations.filter(
                    owner=request.user).first()

                if owned_org:
                    # If they own an organization, that is the default.
                    active_org = owned_org
                else:
                    # 2. If they don't own any, fall back to the first one they are a member of.
                    active_org = request.user.organizations.first()

                # Set this default in the session for subsequent requests
                if active_org:
                    request.session['active_organization_id'] = active_org.id

            # If we found an active organization, get the user's role in it
            if active_org:
                try:
                    member_info = OrganizationMember.objects.get(
                        user=request.user, organization=active_org)
                    active_member_role = member_info.role
                except OrganizationMember.DoesNotExist:
                    active_member_role = None

            # Attach the found data to the request object
            request.active_organization = active_org
            request.active_member_role = active_member_role
        else:
            # For anonymous users, set these to None
            request.active_organization = None
            request.active_member_role = None

        response = self.get_response(request)
        return response




class CustomCsrfMiddleware(CsrfViewMiddleware):
    def process_exception(self, request, exception):
        # If CSRF token expires, log out the user and redirect to login
        if isinstance(exception, HttpResponseForbidden):
            if request.user.is_authenticated:
                logout(request)
                return redirect(settings.LOGIN_URL)  # Redirect to login page
        return None
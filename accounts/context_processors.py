from .models import CustomUser 

def active_organization(request):
    """
    Makes organization data available to templates, ensuring the user, the
    list of organizations, AND the currently active organization are all valid.
    """
    if not request.user.is_authenticated:
        return {}

    # Step 1: Check if the logged-in user is active.
    active_user_from_db = CustomUser.objects.filter(pk=request.user.pk).first()

    if not active_user_from_db:
        # The current user is inactive, show nothing.
        return {
            'active_organization': None,
            'active_member_role': None,
            'my_organizations': [],
        }
    
    # Step 2: Get the list of ALL valid organizations for the dropdown.
    # An organization is valid if its owner is active.
    organizations_with_active_owners = active_user_from_db.organizations.filter(owner__is_active=True)

    # Step 3: Validate the *currently selected* active organization.
    
    # Get the active organization that was set on the request by the middleware.
    current_active_org_from_request = getattr(request, 'active_organization', None)
    
    # Default the final value to None.
    validated_active_org = None
    
    # Check if the organization from the request exists and if its owner is active.
    if current_active_org_from_request and current_active_org_from_request.owner.is_active:
        # If it's valid, we use it.
        validated_active_org = current_active_org_from_request
    else:
        # If it's NOT valid (e.g., owner was deactivated), we try to fall back
        # to the first available valid organization from the user's list.
        validated_active_org = organizations_with_active_owners.first()

    # Also invalidate the role if the organization is no longer valid
    active_role = getattr(request, 'active_member_role', None)
    if not validated_active_org or validated_active_org != current_active_org_from_request:
        active_role = None

    # Step 4: Return the final, fully validated context.
    return {
        # Use the validated variable here
        'active_organization': validated_active_org,
        'active_member_role': active_role,
        'my_organizations': organizations_with_active_owners,
    }
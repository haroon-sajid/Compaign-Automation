# accounts/decorators.py (With Debug Prints)

from functools import wraps
from django.core.exceptions import PermissionDenied
from .models import OrganizationMember


def role_required(*roles):
    """
    Decorator to check if a user has one of the specified roles 
    in the active organization.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            # --- START OF DEBUG BLOCK ---
            print("\n--- Running @role_required check ---")

            if not request.user.is_authenticated:
                print("[DEBUG] User is NOT authenticated. Denying access.")
                raise PermissionDenied

            active_org = getattr(request, 'active_organization', None)

            print(f"[DEBUG] User: {request.user.email}")
            print(
                f"[DEBUG] Active Organization: {active_org.name if active_org else 'None'}")
            print(f"[DEBUG] Required Roles: {roles}")

            if not active_org:
                print("[DEBUG] No active organization found. Denying access.")
                raise PermissionDenied("No active organization found.")

            try:
                member = OrganizationMember.objects.get(
                    user=request.user,
                    organization=active_org
                )
                print(
                    f"[DEBUG] User's actual role in this org: '{member.role}'")

                if member.role not in roles:
                    print(
                        "[DEBUG] ROLE MISMATCH. User's role is not in the required list. Denying access.")
                    raise PermissionDenied(
                        "You do not have the required role.")

                print("[DEBUG] SUCCESS: User has the required role. Granting access.")
                # --- END OF DEBUG BLOCK ---

            except OrganizationMember.DoesNotExist:
                print(
                    "[DEBUG] User is NOT a member of this organization. Denying access.")
                raise PermissionDenied(
                    "You are not a member of this organization.")

            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator

# dashboard/views.py

from django.shortcuts import redirect, render
from django.contrib.auth.decorators import login_required
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from accounts.models import Organization
from organizations.models import Invitation
from django.shortcuts import get_object_or_404
from django.core.serializers.json import DjangoJSONEncoder
import json
from campaignhub.models import Campaign, Post
from accounts.models import OrganizationMember
from django.urls import reverse
from django.contrib.auth import logout
from django.contrib import messages

class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = 'dashboard/dashboard.html'

    def dispatch(self, request, *args, **kwargs):
        """
        This method runs BEFORE get_context_data. It's the perfect place
        for security checks.
        """
        try:
            # Check the user's role in their active organization
            membership = OrganizationMember.objects.get(
                user=request.user,
                organization=request.active_organization
            )
            # If the user is a CUSTOMADMIN, block access.
            if membership.role == OrganizationMember.Role.CUSTOMADMIN:
                logout(request) # Log the user out
                messages.error(request, "Access denied. Your account does not have permission to view that page.")
                return redirect('login') # Redirect to the login page

        except OrganizationMember.DoesNotExist:
            # If for some reason they have no role, log them out for safety.
            logout(request)
            messages.error(request, "Configuration error. Please contact support.")
            return redirect('login')

        # If the check passes (they are NOT a custom admin), proceed as normal.
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        active_organization = self.request.active_organization

        # --- 1. Fetch Pending Invitations ---
        pending_invitations = Invitation.objects.filter(
            email__iexact=self.request.user.email,
            status=Invitation.Status.PENDING  
        )
        print('the pending invitation are these', pending_invitations)
        context['pending_invitations'] = pending_invitations

        # --- 2. Fetch all Posts for the active organization ---
        posts_queryset = Post.objects.filter(
            campaign__organization=active_organization
        ).select_related('campaign', 'campaign__created_by').order_by('-publish_at')
        
        print(f"[*] Fetched {posts_queryset.count()} posts for organization '{active_organization.name}'")

        # --- 3. Format Post data into a structure the JavaScript expects ---
        all_posts_data = []
        for post in posts_queryset:
            all_posts_data.append({
                'id': post.id,
                'title': post.title,
                'campaign': post.campaign.name if post.campaign else '—',
                'channel': post.campaign.get_campaign_type_display() if post.campaign else 'Blog',
                'status': post.status.lower(),
                'publishAt': post.publish_at.isoformat() if post.publish_at else None,
                'createdAt': post.campaign.created_at.isoformat(),
                'owner': post.campaign.created_by.username if post.campaign and post.campaign.created_by else '—'
            })

        # --- 4. Serialize the data to JSON to be used in the template ---
        context['all_posts_json'] = json.dumps(
            all_posts_data, cls=DjangoJSONEncoder)

        return context


@login_required
def switch_organization(request, org_id):
    organization = get_object_or_404(
        request.user.organizations.all(), id=org_id)
    request.session['active_organization_id'] = organization.id
    return redirect('dashboard:dashboard')

# # 2. Keep your corrected login_redirect_view here

@login_required
def login_redirect_view(request):
    """
    Redirects user upon login. If the user has no organization,
    it creates one for them automatically before redirecting to the dashboard.
    """
    # --- Priority 1: Superuser  ---
    print(f"[*] User '{request.user.username}' is_superuser: {request.user.is_superuser}")
    if request.user.is_superuser:
        return redirect(reverse('admin:index'))

    # --- Check for Organizations ---
    user_organizations = request.user.organizations.all()
    print(f"[*] User '{request.user.username}' is in {user_organizations.count()} organizations.")

    # --- If user has no organization, create one now ---
    if not user_organizations.exists():
        # This handles users created before the signal was in place.
        print(f"[*] No organization found for '{request.user.username}'. Creating a default one.")
        
        # 1. Create the organization for the user.
        new_organization = Organization.objects.create(
            name=f"{request.user.username}'s Team",
            owner=request.user
        )
        
        # 2. Make the user an ADMIN member of their new organization.
        OrganizationMember.objects.create(
            organization=new_organization,
            user=request.user,
            role=OrganizationMember.Role.ADMIN
        )
        
        # 3. Redirect back to this same view. On the next run, the user
        # will have an organization and be sent to the correct dashboard.
        # Make sure this view has a name in your urls.py, e.g., 'login_redirect'
        return redirect(reverse('dashboard:login_redirect'))

    # --- Determine Active Organization ---
    owned_org = user_organizations.filter(owner=request.user).first()
    active_organization = owned_org if owned_org else user_organizations.first()
    request.session['active_organization_id'] = active_organization.id

    # --- Priority 2: Check for CUSTOMADMIN role in the active organization ---
    try:
        member_profile = OrganizationMember.objects.get(
            user=request.user,
            organization=active_organization
        )
        print(f"[*] User Role in '{active_organization.name}': {member_profile.role}")
        
        if member_profile.role == OrganizationMember.Role.CUSTOMADMIN:
            return redirect(reverse('dashboard:custom_admin_home'))

    except OrganizationMember.DoesNotExist:
        # This is an edge case, redirect to the standard dashboard as a safe default.
        return redirect(reverse('dashboard:dashboard'))

    # --- Priority 3: All Other Regular Users ---
    return redirect(reverse('dashboard:dashboard'))


# --- ADD VIEW FOR CUSTOM ADMIN ---
@login_required
def custom_admin_dashboard_view(request):
    return render(request, 'dashboard/custom_admin_dashboard.html')

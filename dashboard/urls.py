# dashboard/urls.py

from django.urls import path
from .views import DashboardView, switch_organization, login_redirect_view, custom_admin_dashboard_view

app_name = 'dashboard'

urlpatterns = [
    # The name='dashboard' part is what 'dashboard:dashboard' refers to
    path('', DashboardView.as_view(), name='dashboard'),
    path('org/switch/<int:org_id>/', switch_organization,
         name='switch_organization'),
    path('redirect/', login_redirect_view, name='login_redirect'),
    path('admin-dashboard/', custom_admin_dashboard_view, name='custom_admin_home'),
]

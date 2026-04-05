# organizations/urls.py
from django.urls import path
from . import views

app_name = 'organizations'

urlpatterns = [
    path('manage/', views.manage_members, name='manage_members'),
    path('invitations/<uuid:invitation_id>/accept/',
         views.accept_invitation, name='accept_invitation'),
    path('settings/', views.organization_settings, name='organization_settings'),
    path('invitations/<uuid:invitation_id>/decline/', 
         views.decline_invitation, name='decline_invitation'),
     path('api/request-access/', views.request_access, name='api_request_access'),
]

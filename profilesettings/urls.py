# profilesettings/urls.py
from django.urls import path
from .views import SecuritySettingsView

urlpatterns = [
    path('security/', SecuritySettingsView.as_view(), name='security_settings'),
]

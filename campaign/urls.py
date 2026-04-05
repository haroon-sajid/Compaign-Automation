from django.contrib import admin
from django.urls import path, include
from .views import permission_denied_view
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [

    path('admin/', admin.site.urls),

    # The rest can stay the same
    path('accounts/', include('accounts.urls')),
    path('accounts/', include('allauth.urls')),
    path('settings/', include('profilesettings.urls')),
    path('billing/', include('billing.urls')),
    path('organization/', include('organizations.urls')),
    path('dashboard/', include('dashboard.urls')),
    path('integrations/', include('integrations.urls')),
    path('campaigns/', include('campaignhub.urls', namespace='campaignhub')),
    path('', include('public.urls', namespace='public')),  # Public app at root
]

handler403 = permission_denied_view
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)

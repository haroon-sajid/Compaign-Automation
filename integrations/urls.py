# integrations/urls.py

from django.urls import path
from . import views

app_name = 'integrations'

urlpatterns = [
    path('wordpress/connect/', views.connect_wordpress, name='connect_wordpress'),
    path('wordpress/disconnect/', views.disconnect_wordpress,
         name='disconnect_wordpress'),
    path('wordpress/test/', views.test_wordpress_connection,
         name='test_wordpress_connection'),
    path('connect/x/', views.connect_x, name='connect_x'),
    path('x/callback/', views.x_callback, name='x_callback'),
]

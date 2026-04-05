
from django.urls import path
from . import views

app_name = 'billing'

urlpatterns = [
    # URL for the new organization checkout view
    path('org/create-checkout-session/', views.create_org_checkout_session,
         name='create_org_checkout_session'),

    # URLs for the Stripe redirects
    path('success/', views.success, name='success'),
    path('cancel/', views.cancel, name='cancel'),

    # URL for the webhook
    path('webhook/', views.stripe_webhook, name='stripe_webhook'),
    path('org/cancel-subscription/', views.cancel_subscription,
         name='cancel_subscription'),

]

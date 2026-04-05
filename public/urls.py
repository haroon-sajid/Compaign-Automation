# public/urls.py
from django.urls import path
from .views import HomePageView, AboutPageView, ServicesPageView, PricingPageView, ContactPageView, FAQPageView, \
    TERMSERMSPageView, PrivacyPolicyPageView, SubscriptionView, BlogPageView, BlogDetailsPageView

app_name = 'public'

urlpatterns = [
    path('', HomePageView.as_view(), name='home'),
    path('about/', AboutPageView.as_view(), name='about'),
    path('services/', ServicesPageView.as_view(), name='services'),
    path('pricing/', PricingPageView.as_view(), name='pricing'),
    path('contact/', ContactPageView.as_view(), name='contact'),
    path('faq/', FAQPageView.as_view(), name='faq'),
    path('terms/', TERMSERMSPageView.as_view(), name='terms'),
    path('privacy-policy/', PrivacyPolicyPageView.as_view(), name='privacy_policy'),
    path('subscribe/', SubscriptionView.as_view(), name='subscribe'),
    path('blog/', BlogPageView.as_view(), name='blog'),
    path('blog-details/', BlogDetailsPageView.as_view(), name='blog-details'),
]

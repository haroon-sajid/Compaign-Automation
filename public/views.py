# public/views.py
import json
from django.http import JsonResponse
from django.shortcuts import redirect
from .models import Subscription  # Import the model we created
from django.contrib import messages
from django.views.generic import TemplateView
from django.views.generic import View


class HomePageView(TemplateView):
    template_name = "pages/index.html"


class AboutPageView(TemplateView):
    template_name = "pages/about.html"


class ServicesPageView(TemplateView):
    template_name = "pages/services.html"


class PricingPageView(TemplateView):
    template_name = "pages/pricing.html"


class ContactPageView(TemplateView):
    template_name = "pages/contact.html"


class FAQPageView(TemplateView):
    template_name = "pages/faq.html"


class TERMSERMSPageView(TemplateView):
    template_name = "pages/terms.html"


class PrivacyPolicyPageView(TemplateView):
    template_name = "pages/privacy_policy.html"


class BlogPageView(TemplateView):
    template_name = "pages/blog.html"


class BlogDetailsPageView(TemplateView):
    template_name = "pages/blog-details.html"


class SubscriptionView(View):
    def post(self, request, *args, **kwargs):
        # When using AJAX with JSON, the data is in request.body
        try:
            data = json.loads(request.body)
            email = data.get('email', None)
        except json.JSONDecodeError:
            return JsonResponse({'status': 'error', 'message': 'Invalid data format.'}, status=400)

        if email:
            if Subscription.objects.filter(email=email).exists():
                # Return a JSON error response
                return JsonResponse({
                    'status': 'error',
                    'message': 'This email is already subscribed.'
                }, status=400)  # status=400 indicates a bad request
            else:
                Subscription.objects.create(email=email)
                # Return a JSON success response
                return JsonResponse({
                    'status': 'success',
                    'message': 'Subscription successful!'
                })
        else:
            return JsonResponse({
                'status': 'error',
                'message': 'Please provide a valid email address.'
            }, status=400)

# your_project/middleware.py

class ContentSecurityPolicyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # This is the new, more permissive policy for your complex dashboard.
        csp_policy = (
            "default-src 'self';"

            # Allow scripts from your site, Stripe, and all the CDNs you use.
            # 'unsafe-inline' is required for the script block in your template.
            "script-src 'self' 'unsafe-inline' https://js.stripe.com https://m.stripe.network "
            "https://cdn.jsdelivr.net https://code.jquery.com https://cdnjs.cloudflare.com;"

            # Allow stylesheets from your site and the CDNs you use.
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com "
            "https://cdn.datatables.net https://cdn.jsdelivr.net;"

            # Allow fonts from Google Fonts' CDN.
            "font-src 'self' https://fonts.gstatic.com;"

            # Standard Stripe requirements
            "connect-src 'self' https://api.stripe.com;"
            "frame-src 'self' https://js.stripe.com https://hooks.stripe.com;"
            "img-src 'self' data:;"

            # for the Stripe worker error.
            "worker-src 'self' blob:;"
        )

        response['Content-Security-Policy'] = csp_policy
        return response

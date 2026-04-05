# accounts/views.py
from django.urls import reverse_lazy
from django.views.generic import CreateView
from .forms import SignUpForm
from django.contrib.auth import logout
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponseNotAllowed

class SignUpView(CreateView):
    form_class = SignUpForm
    success_url = reverse_lazy('login')
    template_name = 'accounts/signup.html'

@csrf_exempt
def custom_logout_view(request):
    # Ensure the view only responds to POST requests for security
    if request.method == 'POST':
        logout(request)
        return redirect('public:home')  # Redirect to your homepage or login page
    else:
        # If it's a GET request, explicitly deny it
        return HttpResponseNotAllowed(['POST'])
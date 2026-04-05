# campaign/views.py

from django.shortcuts import render


def permission_denied_view(request, exception):
    """
    Custom view to handle 403 Permission Denied errors.
    """
    # This will find and render your G:/.../templates/403.html file
    return render(request, '403.html', status=403)

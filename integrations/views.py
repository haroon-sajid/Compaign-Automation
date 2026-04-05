# integrations/views.py

from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.contrib import messages
from django.contrib.auth.decorators import login_required

from accounts.decorators import role_required
from .models import Integration
from .forms import WordPressConnectionForm
import requests
from django.conf import settings
import os
import base64
import hashlib
from requests.auth import HTTPBasicAuth


@login_required
@role_required('ADMIN', 'EDITOR')
def connect_wordpress(request):
    """
    Handles both creating a new WordPress connection and updating an existing one.
    """
    organization = request.active_organization
    if not organization:
        messages.error(request, "No active organization found.", extra_tags='integrations')
        return redirect("dashboard:dashboard")

    # Check if an integration already exists for this organization
    try:
        instance = Integration.objects.get(
            organization=organization,
            provider=Integration.Provider.WORDPRESS
        )
        print("Existing integration found:", instance)

    except Integration.DoesNotExist:
        instance = None

    if request.method == 'POST':
        form = WordPressConnectionForm(request.POST, instance=instance)
        print("Form data:", request.POST)

        # The form's clean() method performs the connection test.
        # It will only be valid if the credentials are correct.

        if form.is_valid():
            integration = form.save(commit=False)
            integration.organization = organization
            integration.provider = Integration.Provider.WORDPRESS
            integration.is_active = True
            integration.save()

            if instance:
                messages.success(
                    request, 'Your WordPress connection has been updated successfully!', extra_tags='integrations')
            else:
                messages.success(
                    request, 'Successfully connected to your WordPress site!', extra_tags='integrations')
        else:
            messages.error(
                request, f'{form.errors.as_text()} Please correct the errors.', extra_tags='integrations')

            return redirect('organizations:organization_settings')
        # If the form is not valid, the view will fall through and render the settings
        # page again, with the form containing the validation errors.
        # We need to handle this in the organizations settings view.

    # This view doesn't render its own template. It redirects back to the main
    # settings page on success, and the main settings page will render the form
    # on GET requests or on POST failures.
    return redirect('organizations:organization_settings')


@login_required
# Only admins and editors should be able to disconnect
@role_required('ADMIN', 'EDITOR')
def disconnect_wordpress(request):
    """
    Deletes the WordPress integration for the active organization.
    """
    organization = request.active_organization
    if not organization:
        messages.error(request, "No active organization found.", extra_tags='integrations')
        return redirect("dashboard:dashboard")

    if request.method == 'POST':
        integration = get_object_or_404(
            Integration,
            organization=organization,
            provider=Integration.Provider.WORDPRESS
        )
        integration.delete()
        messages.success(
            request, 'Your WordPress connection has been disconnected.', extra_tags='integrations')

    return redirect('organizations:organization_settings')


@login_required
@role_required('ADMIN', 'EDITOR')
def test_wordpress_connection(request):
    """
    Finds the organization's WordPress integration and sends a test
    post to it as a draft to confirm the connection works.
    """
    organization = request.active_organization
    if not organization:
        messages.error(request, "No active organization found.", extra_tags='integrations')
        return redirect("dashboard:dashboard")

    try:
        integration = Integration.objects.get(
            organization=organization,
            provider=Integration.Provider.WORDPRESS,
            is_active=True
        )
    except Integration.DoesNotExist:
        messages.error(
            request, "No active WordPress connection found to test.", extra_tags='integrations')
        return redirect('organizations:organization_settings')

    # The WordPress REST API endpoint for creating posts is /wp-json/wp/v2/posts
    posts_url = f"{integration.api_url.rstrip('/')}/wp-json/wp/v2/posts"

    # The data for our new post. 'status': 'draft' is the key part.
    post_data = {
        'title': 'Test Post from PublishaApp',
        'content': 'This is a test post to confirm your WordPress connection is working correctly. You can safely delete this post.',
        'status': 'draft'  # This ensures the post is not visible to the public
    }

    try:
        response = requests.post(
            posts_url,
            auth=(integration.username, integration.api_key),
            json=post_data,  # Use json= for sending JSON data
            timeout=15,
            headers={'User-Agent': 'PublishaApp/1.0'}
        )

        # Check if the post was created successfully (HTTP 201 Created)
        if response.status_code == 201:
            messages.success(
                request, "Connection test successful! A draft post named 'Test Post from PublishaApp' has been created in your WordPress site.", extra_tags='integrations')
        else:
            try:
                error_data = response.json()
                error_message = error_data.get(
                    'message', 'An unknown error occurred.')
            except ValueError:  # If the response is not JSON
                error_message = response.text

            messages.error(
                request, f"Connection test failed. WordPress returned an error: {error_message} (Status: {response.status_code})", extra_tags='integrations')

    except requests.exceptions.RequestException as e:
        messages.error(
            request, f"Could not connect to the WordPress site for the test. Error: {e}", extra_tags='integrations')

    return redirect('organizations:organization_settings')


@login_required
@role_required('ADMIN', 'EDITOR')
def connect_x(request):
    """
    STEP 1 of OAuth for X: Redirects the user to X to authorize the app.
    """
    redirect_uri = request.build_absolute_uri(
        reverse('integrations:x_callback'))

    # These are the permissions (scopes) we ask for.
    # offline.access is crucial for getting a refresh token so the user
    # doesn't have to re-connect constantly.
    scope = 'tweet.read tweet.write users.read offline.access'

    # X requires a "state" parameter for security (prevents CSRF attacks)
    state = base64.urlsafe_b64encode(
        os.urandom(32)).decode('utf-8').rstrip('=')
    request.session['oauth_state'] = state

    # X also requires a "code challenge" (PKCE security)
    code_verifier = base64.urlsafe_b64encode(
        os.urandom(32)).decode('utf-8').rstrip('=')
    request.session['oauth_code_verifier'] = code_verifier

    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode('utf-8')).digest()
    ).decode('utf-8').rstrip('=')

    # Construct the authorization URL
    auth_url = (
        f"https://twitter.com/i/oauth2/authorize?"
        f"response_type=code"
        f"&client_id={settings.X_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope}"
        f"&state={state}"
        f"&code_challenge={code_challenge}"
        f"&code_challenge_method=S256"
    )

    return redirect(auth_url)


@login_required
@role_required('ADMIN', 'EDITOR')
def x_callback(request):
    """
    STEP 2 of OAuth for X: X redirects the user back to this view.
    """
    code = request.GET.get('code')
    state = request.GET.get('state')

    # Security check: Ensure the 'state' matches what we sent
    if not state or state != request.session.get('oauth_state'):
        messages.error(request, "Connection failed: Invalid state parameter.", extra_tags='integrations')
        return redirect('organizations:organization_settings')

    if not code:
        messages.error(request, "The connection to X was cancelled or failed.", extra_tags='integrations')
        return redirect('organizations:organization_settings')

    redirect_uri = request.build_absolute_uri(
        reverse('integrations:x_callback'))
    code_verifier = request.session.get('oauth_code_verifier')

    # Exchange the code for an access token
    token_url = 'https://api.twitter.com/2/oauth2/token'
    token_data = {
        'code': code,
        'grant_type': 'authorization_code',
        'client_id': settings.X_CLIENT_ID,
        'redirect_uri': redirect_uri,
        'code_verifier': code_verifier,
    }

    # X requires the client_id and client_secret to be sent as Basic Auth headers
    auth = HTTPBasicAuth(settings.X_CLIENT_ID, settings.X_CLIENT_SECRET)

    try:
        response = requests.post(token_url, data=token_data, auth=auth)
        response.raise_for_status()
        token_data = response.json()
    except requests.exceptions.RequestException as e:
        messages.error(
            request, f"Could not connect to X to verify the token. Error: {e}", extra_tags='integrations')
        return redirect('organizations:organization_settings')

    access_token = token_data.get('access_token')
    # The refresh token is also important for long-term access!
    # For now, we'll just save the access token.
    # refresh_token = token_data.get('refresh_token')

    if not access_token:
        error_msg = token_data.get(
            'error_description', 'An unknown error occurred.')
        messages.error(
            request, f"Failed to retrieve access token from X: {error_msg}", extra_tags='integrations')
        return redirect('organizations:organization_settings')

    # Save the integration to the database
    Integration.objects.update_or_create(
        organization=request.active_organization,
        provider=Integration.Provider.X,
        defaults={'api_key': access_token, 'is_active': True}
    )

    messages.success(
        request, "Your X account has been connected successfully!", extra_tags='integrations')
    return redirect('organizations:organization_settings')

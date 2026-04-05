# integrations/forms.py

from django import forms
import requests
from .models import Integration


class WordPressConnectionForm(forms.ModelForm):
    class Meta:
        model = Integration
        fields = ['api_url', 'username', 'api_key']
        labels = {
            'api_url': 'WordPress Site URL',
            'username': 'WordPress Username',
            'api_key': 'Application Password'
        }
        help_texts = {
            'api_url': 'Enter the full public URL of your WordPress site (e.g., https://myblog.com).',
            'username': 'The username you use to log in to your WordPress admin dashboard.',
            'api_key': 'Log in to your WordPress site, go to your User Profile, find the "Application Passwords" section, and create a new password. Copy and paste it here.'
        }
        # This makes the api_key field render as a password input for better security
        widgets = {
            'username': forms.TextInput(attrs={
                'autocomplete': 'off' # Or a random string like 'nope'
            }),
            'api_key': forms.PasswordInput(attrs={
                'placeholder': 'xxxx xxxx xxxx xxxx',
                'autocomplete': 'new-password' # This is the key change
            }),
        }

    def clean(self):
        """
        This method is called during form validation.
        We use it to test the connection to the WordPress site before saving.
        """
        cleaned_data = super().clean()
        api_url = cleaned_data.get('api_url')
        username = cleaned_data.get('username')
        api_key = cleaned_data.get('api_key')

        # If any of the required fields are missing, let the default validation handle it.
        if not all([api_url, username, api_key]):
            return cleaned_data

        test_url = f"{api_url.rstrip('/')}/wp-json/wp/v2/users/me"

        try:
            response = requests.get(
                test_url,
                auth=(username, api_key),
                # A timeout is crucial to prevent your server from hanging on a slow connection
                timeout=10,
                # This helps identify your app in the WordPress site's logs
                headers={'User-Agent': 'PublishaApp/1.0'}
            )

            # Check for a successful response (HTTP 200 OK)
            if response.status_code == 200:
                # The connection is successful!
                print(
                    f"WordPress connection successful for user '{username}' at {api_url}")
                return cleaned_data

            # Handle common error codes with user-friendly messages
            elif response.status_code == 401:
                raise forms.ValidationError(
                    "Authentication failed. Please check your username and Application Password.")
            elif response.status_code == 404:
                raise forms.ValidationError(
                    "Could not find the WordPress REST API at that URL. Please ensure the URL is correct and the REST API is enabled.")
            else:
                raise forms.ValidationError(
                    f"The site returned an unexpected error (Status Code: {response.status_code}). Please try again.")

        except requests.exceptions.Timeout:
            raise forms.ValidationError(
                "The connection to the WordPress site timed out. Please check the URL and that the site is online.")
        except requests.exceptions.RequestException:
            # This catches DNS errors, connection errors, etc.
            raise forms.ValidationError(
                "Could not connect to the WordPress site. Please check the URL and your internet connection.")

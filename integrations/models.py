# integrations/models.py

from django.db import models
from accounts.models import Organization
from encrypted_model_fields.fields import EncryptedCharField


class Integration(models.Model):
    """
    Stores the credentials for a single third-party integration
    belonging to an organization.
    """
    class Provider(models.TextChoices):
        WORDPRESS = 'WORDPRESS', 'WordPress'
        MEDIUM = 'MEDIUM', 'Medium'
        GHOST = 'GHOST', 'Ghost'
        NOTION = 'NOTION', 'Notion'
        FACEBOOK = 'FACEBOOK', 'Facebook'
        INSTAGRAM = 'INSTAGRAM', 'Instagram'
        X = 'X', 'X (Formerly Twitter)'
        LINKEDIN = 'LINKEDIN', 'LinkedIn'
        THREADS = 'THREADS', 'Threads'

    # Link to the organization that owns this connection
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='integrations')

    # Which CMS is this connection for?
    provider = models.CharField(max_length=20, choices=Provider.choices)

    # Connection details
    api_url = models.URLField(
        max_length=255, help_text="The base URL of the WordPress site (e.g., https://example.com)")
    username = models.CharField(max_length=150, blank=True, null=True)

    # This will store the Application Password for WordPress, or an API key for others
    api_key = EncryptedCharField(max_length=512)

    # Status fields
    is_active = models.BooleanField(default=False)
    last_tested = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # An organization can only have one connection per provider type
        unique_together = ('organization', 'provider')

    def __str__(self):
        return f"{self.organization.name} - {self.get_provider_display()}"

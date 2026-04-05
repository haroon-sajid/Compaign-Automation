# organizations/models.py

from django.db import models
from django.conf import settings
import uuid
from accounts.models import Organization, OrganizationMember


class Invitation(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        DECLINED = 'DECLINED', 'Declined'
    # A unique ID for the invitation link
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    email = models.EmailField()

    # The organization they are being invited to join
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)

    # The role they will have if they accept
    role = models.CharField(
        max_length=20, choices=OrganizationMember.Role.choices, default=OrganizationMember.Role.VIEWER)

    # The user who sent the invitation
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_invitations'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING
    )

    def __str__(self):
        return f"Invitation for {self.email} to join {self.organization.name}"

    class Meta:
        # Prevent sending multiple invitations for the same email to the same organization
        unique_together = ('organization', 'email')

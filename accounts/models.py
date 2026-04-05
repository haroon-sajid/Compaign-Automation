# accounts/models.py (Corrected Version)

from django.db import models
from django.contrib.auth.models import AbstractUser, Group, Permission
from django.contrib.auth.base_user import BaseUserManager
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.utils import timezone
import uuid

class CustomUserManager(BaseUserManager):
    """
    Custom user model manager where email is the unique identifier
    for authentication instead of username.
    """
    def create_user(self, email, password, username, **extra_fields):
        """
        Create and save a User with the given email, username, and password.
        """
        if not email:
            raise ValueError('The Email must be set')
        if not username:
            raise ValueError('The Username must be set')
            
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password, username, **extra_fields):
        """
        Create and save a SuperUser with the given email, username, and password.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self.create_user(email, password, username, **extra_fields)

    def get_queryset(self):
        # Default manager returns only active users
        return super().get_queryset().filter(is_active=True)

    def all_users(self):
        # Method to get all users, including inactive ones for checks
        # Corrected typo from get__queryset to get_queryset
        return super().get_queryset()

class CustomUser(AbstractUser):
    # The 'username', 'first_name', 'last_name', etc. fields are already
    # inherited from AbstractUser. We just need to add our custom fields.
    email = models.EmailField(('email address'), unique=True)
    # The problematic OneToOneField has been removed.

    # You MUST set the USERNAME_FIELD and REQUIRED_FIELDS if you want
    # to log in with email instead of username.
    USERNAME_FIELD = 'email'
    # 'email' and 'password' are required by default.
    REQUIRED_FIELDS = ['username']
    
    deleted_at = models.DateTimeField(null=True, blank=True)
    # This manager will be used by default (e.g., in the admin)
    objects = CustomUserManager() 
    # This manager can be used to query ALL users, including inactive ones
    all_objects = BaseUserManager()

    def __str__(self):
        return self.email
    
    def soft_delete(self):
        self.is_active = False
        self.deleted_at = timezone.now()
        self.save()

    def restore(self):
        self.is_active = True
        self.deleted_at = None
        self.save()


class Profile(models.Model):
    # This correctly links to whatever model you define as your user model.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    avatar_base64 = models.TextField(blank=True, null=True)
    two_factor_enabled = models.BooleanField(default=False)
    two_factor_code = models.CharField(max_length=6, null=True, blank=True)
    two_factor_code_expires = models.DateTimeField(null=True, blank=True)
    delete_confirmation_code = models.CharField(max_length=6, null=True, blank=True)
    delete_confirmation_code_expires = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        # Using self.user.email is better now that email is the primary identifier
        return f'{self.user.email} Profile'


class Organization(models.Model):
    """
    Represents a team, company, or any group that owns data.
    """
    name = models.CharField(max_length=100)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='owned_organizations',
        on_delete=models.CASCADE
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='OrganizationMember',  # We use a custom through model for roles
        related_name='organizations'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class OrganizationMember(models.Model):
    """
    Links a User to an Organization and defines their role.
    """
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        EDITOR = 'EDITOR', 'Editor'
        VIEWER = 'VIEWER', 'Viewer'
        CUSTOMADMIN = 'CUSTOMADMIN', 'Custom Admin'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE)
    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.VIEWER)

    class Meta:
        # A user can only have one role per organization
        unique_together = ('organization', 'user')

    def __str__(self):
        return f'{self.user.username} in {self.organization.name} ({self.get_role_display()})'

class Plan(models.Model):
    PLAN_CHOICES = [
        ('free', 'Free'),
        ('starter', 'Starter'),
        ('pro', 'Pro'),
        ('business', 'Business'),
        ('enterprise', 'Enterprise'),
    ]

    name = models.CharField(max_length=20, choices=PLAN_CHOICES, unique=True)
    campaign_limit = models.PositiveIntegerField(null=True, blank=True, help_text="Maximum number of campaigns allowed. Null means unlimited.")
    credit_grant = models.PositiveIntegerField(
        default=1,  
        help_text="The number of output credits granted when subscribing to this plan."
    )


    def __str__(self):
        return self.get_name_display()

class OrganizationSettings(models.Model):
    organization = models.OneToOneField(
        Organization,
        on_delete=models.CASCADE,
        related_name='settings'
    )
    api_key = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    webhook_url = models.URLField(max_length=200, blank=True, null=True)
    subscription_plan = models.ForeignKey(
        Plan,
        on_delete=models.SET_NULL,
        null=True,
        related_name='organizations'
    )
    billing_is_yearly = models.BooleanField(default=False)
    stripe_customer_id = models.CharField(
        max_length=255, blank=True, null=True)
    stripe_subscription_id = models.CharField(
        max_length=255, blank=True, null=True)
    stripe_subscription_cancel_at_period_end = models.BooleanField(
        default=False)
    subscription_start_date = models.DateTimeField(null=True, blank=True)
    output_credits_remaining = models.PositiveIntegerField(
        default=1,
        help_text="The number of post/output credits the organization has left."
    )
    campaigns_created_this_period = models.PositiveIntegerField(
        default=0,
        help_text="Tracks how many active campaigns have been created in the current billing cycle."
    )
    def __str__(self):
        return f"{self.organization.name} Settings"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)


@receiver(post_save, sender=Organization)
def create_organization_settings(sender, instance, created, **kwargs):
    if created:
        try:
            free_plan = Plan.objects.get(name='free')
            OrganizationSettings.objects.create(
                organization=instance,
                subscription_plan=free_plan, # Corrected field name
                output_credits_remaining=free_plan.credit_grant
            )
        except Plan.DoesNotExist:
            OrganizationSettings.objects.create(organization=instance)
            
@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_dependencies(sender, instance, created, **kwargs):
    """
    Handles the creation of all dependent objects for a new user.
    This signal is idempotent, using get_or_create to prevent race conditions.
    """
    if created:
        # 1. Get or create the associated Profile.
        # This will not fail if the profile somehow already exists.
        Profile.objects.get_or_create(user=instance)

        # 2. Get or create the user's personal organization.
        org_name = f"{instance.username}'s Team"
        organization, org_created = Organization.objects.get_or_create(
            owner=instance,
            defaults={'name': org_name} # 'defaults' are only used if creating
        )

        # 3. If the organization was newly created, add the owner as a member.
        if org_created:
            OrganizationMember.objects.create(
                organization=organization,
                user=instance,
                role=OrganizationMember.Role.ADMIN
            )

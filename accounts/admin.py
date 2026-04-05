from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    CustomUser, Profile, Organization, OrganizationMember,
    OrganizationSettings, Plan
)

# --- Inline Admins ---

class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    extra = 0


class OrganizationMemberInline(admin.TabularInline):
    model = OrganizationMember
    extra = 1


class OrganizationSettingsInline(admin.StackedInline):
    model = OrganizationSettings
    can_delete = False
    extra = 0


# --- Custom User Admin ---

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ("email", "username", "is_staff", "is_active")
    list_filter = ("is_staff", "is_active", "groups")
    ordering = ("email",)
    search_fields = ("email", "username")

    fieldsets = (
        (None, {"fields": ("email", "password", "username")}),
        ("Permissions", {"fields": ("is_staff", "is_active", "groups", "user_permissions")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "username", "password1", "password2", "is_staff", "is_active"),
        }),
    )

    inlines = [ProfileInline]


# --- Organization Admins ---

@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "created_at")
    search_fields = ("name", "owner__email")
    list_filter = ("created_at",)
    inlines = [OrganizationMemberInline, OrganizationSettingsInline]


@admin.register(OrganizationMember)
class OrganizationMemberAdmin(admin.ModelAdmin):
    list_display = ("organization", "user", "role")
    list_filter = ("role", "organization")
    search_fields = ("organization__name", "user__email", "user__username")


@admin.register(OrganizationSettings)
class OrganizationSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "organization",
        "subscription_plan",
        "billing_is_yearly",
        "output_credits_remaining", 
        "campaigns_created_this_period"
    )
    list_editable = ("output_credits_remaining","campaigns_created_this_period")  
    search_fields = ("organization__name", "plan__name")
    list_filter = ("subscription_plan", "billing_is_yearly")


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("name", "campaign_limit", "credit_grant")
    search_fields = ("name",)

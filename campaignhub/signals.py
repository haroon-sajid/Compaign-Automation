# campaignhub/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from accounts.models import Organization
from .models import PromptTemplate
from .defaults import DEFAULT_PROMPT_TEMPLATES


@receiver(post_save, sender=Organization)
def create_default_prompts_for_new_organization(sender, instance, created, **kwargs):
    """
    When a new Organization is created, this function is called.
    It populates the new organization with the default PromptTemplate objects.
    """
    # The 'created' flag is True only on the first save (i.e., creation).
    if created:
        print(
            f"New organization '{instance.name}' created. Seeding default prompts...")

        # We loop through our default prompts and create them for the new organization.
        # Using get_or_create is a safeguard to prevent duplicates.
        for template_data in DEFAULT_PROMPT_TEMPLATES:
            PromptTemplate.objects.get_or_create(
                organization=instance,
                name=template_data["name"],
                campaign_type=template_data["campaign_type"],
                defaults={
                    'system_prompt': template_data["system_prompt"],
                    'user_prompt': template_data["user_prompt"],
                    # 'created_by' can be null, so we don't set it for defaults.
                }
            )
        print(
            f"Default prompts seeded successfully for '{instance.name}'.")

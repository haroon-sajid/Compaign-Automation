# accounts/management/commands/seedplans.py

from django.core.management.base import BaseCommand
from accounts.models import Plan

PLAN_CONFIG = {
    'free': {
        'campaign_limit': 1,
        'credit_grant': 1,
    },
    'starter': {
        'campaign_limit': 3,
        'credit_grant': 50,
    },
    'pro': {
        'campaign_limit': 10,
        'credit_grant': 200,
    },
    'business': {
        'campaign_limit': None,
        'credit_grant': 800,
    },
    'enterprise': {
        'campaign_limit': None,
        'credit_grant': 5000,
    },
}

class Command(BaseCommand):
    help = 'Seeds or updates the database with subscription plan rules'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.SUCCESS("--- Seeding/Updating Plan Data ---"))
        
        for plan_name, config in PLAN_CONFIG.items():
            # Get the new values from the config
            defaults = {
                'campaign_limit': config.get('campaign_limit'),
                'credit_grant': config.get('credit_grant'),
            }

            # Use update_or_create to either create a new plan or update an existing one
            plan, created = Plan.objects.update_or_create(
                name=plan_name,
                defaults=defaults
            )

            # --- Improved Logging ---
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f"  [CREATED] Plan: '{plan.get_name_display()}'")
                )
                self.stdout.write(f"    - Campaign Limit set to: {plan.campaign_limit}")
                self.stdout.write(f"    - Credit Grant set to: {plan.credit_grant}")
            else:
                # If it was updated, let's check which fields actually changed
                # This requires re-fetching the object to see its state *before* the update,
                # but for a seed script, this clarity is very helpful.
                # A simpler way is just to assume it was updated as intended.
                self.stdout.write(
                    self.style.NOTICE(f"  [UPDATED] Plan: '{plan.get_name_display()}'")
                )
                self.stdout.write(f"    - Campaign Limit is now: {plan.campaign_limit}")
                self.stdout.write(f"    - Credit Grant is now: {plan.credit_grant}")
        
        self.stdout.write(self.style.SUCCESS("--- Plan seeding complete! ---"))
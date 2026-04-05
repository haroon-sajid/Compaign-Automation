# accounts/management/commands/sync_usage_data.py

from django.core.management.base import BaseCommand
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from accounts.models import OrganizationSettings
from campaignhub.models import Campaign, Post

class Command(BaseCommand):
    help = 'Recalculates and syncs campaign usage data. ONLY corrects credit balance for lifetime (free) plans.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate the command without making any changes to the database.',
        )

    def handle(self, *args, **kwargs):
        is_dry_run = kwargs['dry_run']
        
        if is_dry_run:
            self.stdout.write(self.style.WARNING("--- RUNNING IN DRY-RUN MODE: No changes will be saved. ---"))

        self.stdout.write(self.style.SUCCESS("Starting usage data synchronization..."))

        org_settings_list = OrganizationSettings.objects.select_related('organization', 'subscription_plan').all()

        for org_settings in org_settings_list:
            organization = org_settings.organization
            plan = org_settings.subscription_plan
            
            self.stdout.write(f"\nProcessing Organization: '{organization.name}'...")

            if not plan:
                self.stdout.write(self.style.WARNING("  - No subscription plan found. Skipping."))
                continue

            # --- LOGIC FOR THE 'FREE' PLAN (LIFETIME LIMITS) ---
            # This logic is correct because free plans do not have rollover credits.
            if plan.name == 'free':
                # Correct Campaign Count (total)
                actual_campaigns = Campaign.objects.filter(organization=organization).count()
                if org_settings.campaigns_created_this_period != actual_campaigns:
                    self.stdout.write(self.style.NOTICE(f"  - Campaign Count Mismatch: Found {actual_campaigns}, DB has {org_settings.campaigns_created_this_period}. Updating..."))
                    if not is_dry_run:
                        org_settings.campaigns_created_this_period = actual_campaigns
                        org_settings.save(update_fields=['campaigns_created_this_period'])
                else:
                    self.stdout.write(f"  - Campaign Count Correct: {actual_campaigns}")

                # Correct Post/Credit Count (total)
                posts_used = Post.objects.filter(campaign__organization=organization).exclude(status=Post.Status.GENERATION_FAILED).count()
                correct_credits = max(plan.credit_grant - posts_used, 0)
                if org_settings.output_credits_remaining != correct_credits:
                    self.stdout.write(self.style.NOTICE(f"  - Credit Balance Mismatch: Calculated {correct_credits}, DB has {org_settings.output_credits_remaining}. Updating..."))
                    if not is_dry_run:
                        org_settings.output_credits_remaining = correct_credits
                        org_settings.save(update_fields=['output_credits_remaining'])
                else:
                    self.stdout.write(f"  - Credit Balance Correct: {correct_credits}")

            # --- LOGIC FOR PAID PLANS (ROLLING MONTHLY LIMITS) ---
            else:
                now = timezone.now()
                anchor_date = org_settings.subscription_start_date or organization.created_at
                
                months_diff = (now.year - anchor_date.year) * 12 + now.month - anchor_date.month
                current_period_start = anchor_date + relativedelta(months=months_diff)
                if current_period_start > now and months_diff > 0:
                    current_period_start -= relativedelta(months=1)
                
                self.stdout.write(f"  - Current Billing Period Start: {current_period_start.strftime('%Y-%m-%d')}")

                actual_campaigns_this_period = Campaign.objects.filter(
                    organization=organization,
                    created_at__gte=current_period_start
                ).count()
                
                if org_settings.campaigns_created_this_period != actual_campaigns_this_period:
                    self.stdout.write(self.style.NOTICE(f"  - Campaign Count Mismatch: Found {actual_campaigns_this_period} this period, DB has {org_settings.campaigns_created_this_period}. Updating..."))
                    if not is_dry_run:
                        org_settings.campaigns_created_this_period = actual_campaigns_this_period
                        org_settings.save(update_fields=['campaigns_created_this_period'])
                else:
                    self.stdout.write(f"  - Campaign Count Correct: {actual_campaigns_this_period}")

                # We now trust that the credit balance is managed correctly by the other parts of the system.
                self.stdout.write(f"  - Credit Balance Check Skipped for Paid Plan (Managed as a running balance). Current balance: {org_settings.output_credits_remaining}")

        self.stdout.write(self.style.SUCCESS("\nSynchronization complete!"))
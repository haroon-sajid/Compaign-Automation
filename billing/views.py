# billing/views.py

import stripe
from django.conf import settings
from django.http import JsonResponse, HttpResponse
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.contrib import messages
import logging
import datetime # Make sure this is imported
from django.utils import timezone # Make sure this is imported
from accounts.models import Profile, OrganizationSettings, Plan
from datetime import datetime, timezone as dt_timezone

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_SECRET_KEY

PRICE_IDS = {
    'free': 'price_1SDk28DMwdVlmFs6zmyJgSdN',
    'starter_monthly': 'price_1SDk2fDMwdVlmFs6NhCG679C',
    'pro_monthly': 'price_1SDk33DMwdVlmFs6fXnN7NeH',
    'business_monthly': 'price_1SDk3QDMwdVlmFs65NxjPwyL',
    'enterprise_monthly': 'price_1SDk49DMwdVlmFs6iA8v3lg8',
    'starter_yearly': 'price_1SGaLCDMwdVlmFs6FyZXzLWF',
    'pro_yearly': 'price_1SGaMtDMwdVlmFs6yHkNJRkh',
    'business_yearly': 'price_1SGaOXDMwdVlmFs6jg46Ty4v',
    'enterprise_yearly': 'price_1SGaRPDMwdVlmFs6CgBTccja',
    'testing_monthly': 'price_1SLGt2DMwdVlmFs6RHQ9TDGs'
}


def get_stripe_price_id(plan, is_yearly):
    billing_cycle = 'yearly' if is_yearly else 'monthly'
    key = f"{plan.lower()}_{billing_cycle}"
    price_id = PRICE_IDS.get(key)
    if not price_id:
        raise ValueError(f"Price ID for '{plan}' ({billing_cycle}) not found.")
    return price_id


@login_required
def create_org_checkout_session(request):
    # This function is correct and does not need changes.
    if request.method == 'POST':
        plan = request.POST.get('plan')
        is_yearly = request.POST.get('billing_cycle') == 'yearly'
        organization = request.active_organization
        if not organization:
            return JsonResponse({'error': 'No active organization found'}, status=400)
        org_settings = organization.settings
        try:
            price_id = get_stripe_price_id(plan, is_yearly)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=400)
        try:
            customer_id = org_settings.stripe_customer_id
            if not customer_id:
                customer = stripe.Customer.create(
                    email=organization.owner.email,
                    name=organization.name,
                    metadata={'organization_id': str(organization.id)}
                )
                customer_id = customer.id
                org_settings.stripe_customer_id = customer_id
                org_settings.save()
            checkout_session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=['card'],
                line_items=[{'price': price_id, 'quantity': 1}],
                mode='subscription',
                success_url=request.build_absolute_uri(
                    reverse('billing:success')),
                cancel_url=request.build_absolute_uri(
                    reverse('billing:cancel')),
                subscription_data={'metadata': {
                    'organization_id': str(organization.id)}},
                metadata={'organization_id': str(organization.id)}
            )
            return JsonResponse({'sessionId': checkout_session.id})
        except Exception as e:
            logger.error(f"Stripe session creation failed: {e}")
            return JsonResponse({'error': str(e)}, status=500)
    return JsonResponse({'error': 'POST request required.'}, status=405)


@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    event = None

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.SignatureVerificationError) as e:
        logger.warning(f"Webhook signature verification failed: {e}")
        return HttpResponse(status=400)

    data_object = event['data']['object']
    event_type = event['type']

    organization_id = None
    metadata = data_object.get('metadata', {})
    if metadata:
        organization_id = metadata.get('organization_id')

    if not organization_id:
        customer_id = data_object.get('customer')
        if customer_id:
            try:
                org_settings = OrganizationSettings.objects.get(
                    stripe_customer_id=customer_id)
                organization_id = org_settings.organization.id
            except OrganizationSettings.DoesNotExist:
                pass
    print('organization_id:', organization_id)

    if organization_id:
        print("event_type:", event_type)
        if event_type.startswith('customer.subscription') or event_type == 'invoice.payment_succeeded':
            handle_organization_subscription_event(
                event_type, data_object, organization_id)
    else:
        handle_profile_subscription_event(event_type, data_object)

    return HttpResponse(status=200)


def handle_organization_subscription_event(event_type, data_object, organization_id):
    """
    Webhook helper for processing organization-based subscriptions.
    Now handles multiple event types to reliably capture subscription data.
    """
    try:
        org_settings = OrganizationSettings.objects.get(
            organization_id=organization_id)
    except OrganizationSettings.DoesNotExist:
        logger.error(
            f"Webhook for org {organization_id} failed: No matching OrganizationSettings found.")
        return

    # --- HANDLES SUBSCRIPTION CHANGES (UPGRADES, DOWNGRADES, CANCELLATIONS) ---
    if event_type in ('customer.subscription.created', 'customer.subscription.updated'):
        subscription = data_object
        org_settings.stripe_subscription_cancel_at_period_end = subscription.get('cancel_at_period_end', False)

        # We still try to get the start date here, as 'updated' events will have it.
        if 'current_period_start' in subscription:
            start_timestamp = subscription['current_period_start']
            org_settings.subscription_start_date = datetime.fromtimestamp(start_timestamp, tz=dt_timezone.utc)
            logger.info(f"Updated subscription_start_date via '{event_type}' for Org ID {organization_id}.")
        
        # This part remains the same, to sync the plan name and billing cycle
        try:
            price_id = subscription['items']['data'][0]['price']['id']
            for key, saved_price_id in PRICE_IDS.items():
                if saved_price_id == price_id:
                    plan_name, billing_cycle = key.split('_')
                    try:
                        subscribed_plan = Plan.objects.get(name=plan_name)
                        org_settings.subscription_plan = subscribed_plan
                        credits_to_grant = subscribed_plan.credit_grant
                        org_settings.output_credits_remaining = credits_to_grant
                        org_settings.campaigns_created_this_period = 0
                        
                        logger.info(
                            f"SUCCESS: Granted {credits_to_grant} credits and reset campaign counter for Org ID {organization_id} for new '{subscribed_plan.get_name_display()}' plan."
                        )
                    except Plan.DoesNotExist:
                        logger.error(f"FATAL: Stripe plan '{plan_name}' does not exist in the database for Org ID {organization_id}.")
                        # Stop processing if the plan doesn't exist to avoid bad data
                        return
                    org_settings.billing_is_yearly = (billing_cycle == 'yearly')
                    org_settings.stripe_subscription_id = subscription['id']
                    org_settings.stripe_customer_id = subscription['customer']
                    logger.info(f"SUCCESS: Synced plan for Org ID {organization_id} to '{plan_name}'.")
                    break
        except (KeyError, IndexError):
            logger.warning(f"Could not extract price_id from '{event_type}' event.")

        org_settings.save()

    # --- LOGIC FOR THE *START* OF A SUBSCRIPTION ---
    elif event_type == 'invoice.payment_succeeded':
        invoice = data_object
        # We only want to set the start date on the VERY FIRST invoice for a new subscription.
        if invoice.get('billing_reason') == 'subscription_create':
            if 'period_start' in invoice:
                start_timestamp = invoice['period_start']
                org_settings.subscription_start_date = datetime.fromtimestamp(start_timestamp, tz=dt_timezone.utc)
                org_settings.save()
                logger.info(f"SUCCESS: Set initial subscription_start_date from 'invoice.payment_succeeded' for Org ID {organization_id}.")
            else:
                logger.warning(f"'invoice.payment_succeeded' event for Org ID {organization_id} was missing 'period_start'.")

    # --- HANDLES THE END OF A SUBSCRIPTION ---
    elif event_type == 'customer.subscription.deleted':
        try:
            # 1. Fetch the 'free' Plan object from the database
            free_plan = Plan.objects.get(name='free')
            # 2. Assign the full object
            org_settings.subscription_plan = free_plan
        except Plan.DoesNotExist:
            logger.error(f"FATAL: Could not find the default 'free' plan when cancelling subscription for Org ID {organization_id}.")
        # If the free plan is gone, set the plan to nothing (null)
        org_settings.subscription_plan = None
        org_settings.stripe_subscription_id = None
        org_settings.billing_is_yearly = False
        org_settings.stripe_subscription_cancel_at_period_end = False
        org_settings.subscription_start_date = None # Reset the date
        org_settings.save()
        logger.info(f"SUCCESS: Canceled subscription for Org ID {organization_id}.")

def handle_profile_subscription_event(event_type, data_object):
    """This function is the safe fallback for non-organization events."""
    customer_id = data_object.get('customer')
    if not customer_id:
        return

    try:
        profile = Profile.objects.get(stripe_customer_id=customer_id)
        logger.info(
            f"Webhook (unhandled) for user profile: {profile.user.email}")
    except Profile.DoesNotExist:
        logger.warning(
            f"Webhook for a non-organization customer ({customer_id}) received, but no matching user profile found. Ignoring.")
    except Profile.MultipleObjectsReturned:
        logger.critical(
            f"DATABASE ERROR: Found multiple profiles for customer {customer_id}.")


def success(request):
    messages.success(
        request, "Your payment was successful and your plan has been updated!", extra_tags='integrations')
    return redirect("organizations:organization_settings")


def cancel(request):
    messages.warning(
        request, "Your payment was canceled. Your plan has not been changed.", extra_tags='integrations')
    return redirect("organizations:organization_settings")


@login_required
def cancel_subscription(request):
    """
    Cancels the user's active subscription at the end of the current billing period.
    """
    if request.method == 'POST':
        organization = request.active_organization
        if not organization:
            messages.error(request, "No active organization found.", extra_tags='integrations')
            return redirect("organizations:organization_settings")

        org_settings = organization.settings
        subscription_id = org_settings.stripe_subscription_id

        if not subscription_id:
            messages.error(request, "No active subscription to cancel.", extra_tags='integrations')
            return redirect("organizations:organization_settings")

        try:
            stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True
            )
            messages.success(
                request, "Your subscription has been scheduled for cancellation at the end of your current billing period.", extra_tags='integrations')
        except stripe.error.StripeError as e:
            logger.error(
                f"Stripe API error while cancelling subscription: {e}")
            messages.error(
                request, "There was an error canceling your subscription. Please try again or contact support.", extra_tags='integrations')

        return redirect("organizations:organization_settings")
    else:
        return redirect("organizations:organization_settings")

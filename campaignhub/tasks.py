# campaignhub/tasks.py

from celery import shared_task
import logging
from django.utils import timezone
from datetime import timedelta

# Import your agent and models
from .agent import app as blog_generation_agent, BlogGenerationState
from .models import Campaign, Post
from integrations.models import Integration
from .utils import publish_post_to_wordpress
logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# MASTER SCHEDULER TASK (RUN BY CELERY BEAT)
# -----------------------------------------------------------------------------


@shared_task(name="campaign_scheduler_tick")
def campaign_scheduler_tick():
    """
    This is the master task run by Celery Beat. It finds campaigns that are
    due for a post and triggers the agent for them.

    MODIFIED LOGIC:
    - It will immediately trigger any QUEUED campaign for its first post.
    - It will trigger subsequent posts for ACTIVE campaigns based on frequency.
    - Handles campaigns without schedule_settings gracefully.
    """
    now = timezone.now()
    logger.info(f"--- SCHEDULER TICK AT {now} ---")

    # Find all campaigns that are in a runnable state
    # Use select_related to efficiently get schedule_settings, but handle missing ones
    runnable_campaigns = Campaign.objects.select_related('schedule_settings').filter(
        status__in=[Campaign.Status.QUEUED, Campaign.Status.ACTIVE]
    )

    logger.info("The runnable campaigns are: %s", runnable_campaigns)

    for campaign in runnable_campaigns:
        try:
            last_post = Post.objects.filter(
                campaign=campaign).order_by('-publish_at').first()
            is_due = False

            if not last_post:
                # If it's QUEUED and has no posts, it's immediately due for its first one.
                if campaign.status == Campaign.Status.QUEUED:
                    is_due = True
                    logger.info(f"SCHEDULER: Campaign '{campaign.name}' is QUEUED with no posts. Triggering first post.")
            else:
                # If it's ACTIVE, check frequency against the last post's publish time for the next post.
                # Check if schedule_settings exists
                if hasattr(campaign, 'schedule_settings') and campaign.schedule_settings:
                    schedule_settings = campaign.schedule_settings
                    delta = timedelta(
                        **{schedule_settings.frequency_unit.lower(): schedule_settings.frequency_value})
                    next_due_time = last_post.publish_at + delta
                    if now >= next_due_time:
                        is_due = True
                        logger.info(f"SCHEDULER: Campaign '{campaign.name}' is due based on schedule.")
                else:
                    # Campaign doesn't have schedule_settings - this shouldn't happen but handle gracefully
                    logger.warning(f"SCHEDULER: Campaign '{campaign.name}' has no schedule_settings. Skipping.")
                    continue

            if is_due:
                logger.info(
                    f"SCHEDULER: Campaign '{campaign.name}' ({campaign.status}) is due. Triggering agent.")
                # Trigger the LangGraph agent asynchronously
                generate_blog_post_for_campaign.delay(str(campaign.id))
                
        except Exception as e:
            logger.error(f"SCHEDULER: Error processing campaign '{campaign.name}': {e}")
            continue  # Continue with next campaign instead of failing completely

    return "Scheduler tick completed."

    
# -----------------------------------------------------------------------------
# WORKER TASK (RUNS THE LANGGRAPH AGENT) -
# -----------------------------------------------------------------------------
@shared_task(bind=True)
def generate_blog_post_for_campaign(self, campaign_id: str):
    """
    This Celery task invokes the LangGraph agent to generate a single blog post.
    """
    logger.info(
        f"CELERY TASK: Starting blog generation agent for campaign ID: {campaign_id}")

    initial_state = BlogGenerationState(
        campaign_id=campaign_id,
        campaign=None,
        is_first_run=False,
        stop_reason=None,
        error_message=None,
        posts_created_count=0,
        selected_keyword_obj=None,
        generated_title=None,
        generated_content_html=None,
        generated_tags=None,
        featured_image_url=None,
        next_publish_at=None,
    )

    try:
        # This single line runs the entire multi-step agent process
        final_state = blog_generation_agent.invoke(initial_state)

        logger.info(
            f"CELERY TASK: Agent run completed for campaign ID: {campaign_id}.")
        logger.info(f"Final State Details: {final_state}")

        return f"Agent run successful. Final state: {final_state.get('stop_reason') or 'Post created'}"

    except Exception as e:
        logger.error(
            f"CELERY TASK: A critical error occurred while invoking the agent for campaign {campaign_id}: {e}", exc_info=True)
        # For transient errors, Celery can retry the task
        self.retry(exc=e, countdown=60)  # Retry in 60 seconds


@shared_task(name="publish_scheduled_posts")
def publish_scheduled_posts():
    """
    This task finds all posts that are scheduled to be published,
    checks for valid WordPress credentials, and then attempts to publish them.
    """
    now = timezone.now()
    logger.info(f"--- PUBLISH SCHEDULER TICK AT {now} ---")

    # Find all posts that are scheduled and ready to be published
    posts_to_publish = Post.objects.filter(
        status=Post.Status.SCHEDULED,
        publish_at__lte=now
    ).select_related('campaign__organization')

    logger.info(f"Found {posts_to_publish.count()} posts to publish.")

    for post in posts_to_publish:
        organization = post.campaign.organization

        # Get the active WordPress integration for the organization
        try:
            integration = Integration.objects.get(
                organization=organization,
                provider=Integration.Provider.WORDPRESS,
                is_active=True
            )
        except Integration.DoesNotExist:
            logger.warning(
                f"No active WordPress integration found for organization '{organization.name}'. "
                f"Failing post '{post.title}'."
            )
            post.status = Post.Status.PUBLISH_FAILED
            post.error_message = "No active WordPress integration was found for this campaign's organization."
            post.save()
            continue

        # Check for complete credentials
        if not all([integration.api_url, integration.username, integration.api_key]):
            logger.warning(
                f"Incomplete WordPress integration details for organization '{organization.name}'. "
                f"Failing post '{post.title}'."
            )
            post.status = Post.Status.PUBLISH_FAILED
            post.error_message = "The WordPress integration details for this organization are incomplete."
            post.save()
            continue

        # Attempt to publish the post
        success, message = publish_post_to_wordpress(post, integration)

        if not success:
            logger.error(f"Failed to publish post '{post.title}': {message}")
            post.status = Post.Status.PUBLISH_FAILED
            post.error_message = message
            post.save()

    return "Publish scheduler tick completed."
# campaignhub/views.py

from venv import logger
from django.shortcuts import render, redirect
from django.views.generic import ListView, TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.contrib import messages
from django.db import transaction, IntegrityError, models
from django.views import View
from accounts.decorators import role_required
from .models import (Campaign, PromptSettings, Keyword, KeywordSettings,
                     ContentSettings, MediaSettings, ScheduleSettings, PromptTemplate, Post)
from integrations.models import Integration
from django.shortcuts import get_object_or_404
from datetime import datetime, timedelta
import csv
import io
import pprint
from django.http import JsonResponse, HttpResponseBadRequest
from django.urls import reverse
import json
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
from .utils import search_pexels, serach_unsplash, serach_pixabay, publish_post_to_wordpress, process_tags_payload
from . import utils
import pytz
import base64
import uuid
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.conf import settings
from urllib.parse import urljoin, urlparse
import requests
import os
from dateutil.relativedelta import relativedelta 
from django.db.models import Q, F
import time
import threading
from dateutil.relativedelta import relativedelta  # Make sure this import exists
from .ai_image_utils import AIImageGenerator

ALLOWED_VIDEO_FORMATS = {'mp4', 'mov', 'webm'}
MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB limit for uploaded videos

def process_image_string(image_string):
    """
    Processes a string that is either a URL or a Base64 data URI.
    - If it's a valid URL, returns it directly.
    - If it's a Base64 string, decodes it, saves it as a file, and returns its public URL.
    - Returns None if the string is invalid or processing fails.
    """
    if not isinstance(image_string, str):
        return None

    # Case 1: The string is a standard URL
    if image_string.startswith(('http://', 'https://')):
        return image_string

    # Case 2: The string is a Base64 data URI
    if image_string.startswith('data:'):
        try:
            # Split the header from the actual image data
            # e.g., "data:image/jpeg;base64,"
            header, encoded_data = image_string.split(';base64,', 1)
            media_family = header.split(':', 1)[1].split('/')[0]
            # Get the file extension from the header (e.g., 'jpeg')
            file_ext = header.split('/')[-1].lower()

            if media_family not in ('image', 'video'):
                print(f"Unsupported media family '{media_family}' in data URI.")
                return None

            # Decode the Base64 data
            decoded_file = base64.b64decode(encoded_data)

            if media_family == 'video':
                if file_ext not in ALLOWED_VIDEO_FORMATS:
                    print(f"Unsupported video format '{file_ext}'.")
                    return None
                if len(decoded_file) > MAX_VIDEO_SIZE_BYTES:
                    print("Uploaded video exceeds the 50 MB limit.")
                    return None

            # Create a Django ContentFile with a unique name
            file_name = f"uploads/{uuid.uuid4()}.{file_ext}"
            content_file = ContentFile(decoded_file, name=file_name)

            # Save the file using the default storage
            saved_file_name = default_storage.save(file_name, content_file)

            # Get the public URL for the saved file
            file_url = default_storage.url(saved_file_name)

            relative_url = default_storage.url(saved_file_name)

            # Build a full absolute URL (using SITE URL or fallback)
            base_url = getattr(settings, "BASE_URL", "http://127.0.0.1:8000")
            full_url = urljoin(base_url, relative_url.lstrip("/"))
            return full_url

        except (ValueError, TypeError, base64.binascii.Error) as e:
            # Handle potential errors during splitting or decoding
            print(f"Error processing Base64 string: {e}")
            return None

    # Case 3: Invalid format
    return None


def detect_media_type_from_url(media_url: str) -> str:
    """
    Inspect the media URL's extension to infer whether it's an image or video.
    Defaults to 'image' when uncertain to preserve backward compatibility.
    """
    if not media_url or not isinstance(media_url, str):
        return MediaSettings.MediaType.IMAGE

    parsed = urlparse(media_url)
    path = parsed.path or media_url
    _, ext = os.path.splitext(path)
    ext = ext.lower().lstrip('.')

    if ext in ALLOWED_VIDEO_FORMATS:
        return MediaSettings.MediaType.VIDEO
    return MediaSettings.MediaType.IMAGE


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class PexelsSearchView(View):
    """
    API view to search for images on Pexels.
    Accepts a 'query' GET parameter.
    """

    def get(self, request, *args, **kwargs):
        search_query = request.GET.get('query', '').strip()

        if not search_query:
            return JsonResponse({'error': 'A search query is required.'}, status=400)

        try:
            # You can also get 'per_page' from the request if you want
            per_page = int(request.GET.get('per_page', 15))
        except (ValueError, TypeError):
            per_page = 15

        # Call our utility function to get the images
        results = search_pexels(query=search_query, per_page=per_page)
        print("Pexels Search Results:", results)  # Debugging log

        # If the function returned None, it means there was an error
        if results is None:
            return JsonResponse({
                'error': 'Failed to fetch images from the provider. Please check the server logs or API key.'
            }, status=503)  # 503 Service Unavailable is a good code for external API failure

        # On success, return the list of images as JSON
        # safe=False is required to send a list as a top-level JSON response
        return JsonResponse(results, safe=False)


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class UNSPLASHSearchView(View):
    """
    API view to search for images on Unsplash.
    Accepts a 'query' GET parameter.
    """

    def get(self, request, *args, **kwargs):
        search_query = request.GET.get('query', '').strip()

        if not search_query:
            return JsonResponse({'error': 'A search query is required.'}, status=400)

        # Call our utility function to get the images
        results = serach_unsplash(query=search_query)
        print("Unsplash Search Results:", results)  # Debugging log

        # If the function returned None, it means there was an error
        if results is None:
            return JsonResponse({
                'error': 'Failed to fetch images from the provider. Please check the server logs or API key.'
            }, status=503)  # 503 Service Unavailable is a good code for external API failure

        # On success, return the list of images as JSON
        # safe=False is required to send a list as a top-level JSON response
        return JsonResponse(results, safe=False)


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class PixabaySearchView(View):
    """
    API view to search for images on Pixabay.
    Accepts a 'query' GET parameter.
    """

    def get(self, request, *args, **kwargs):
        search_query = request.GET.get('query', '').strip()

        if not search_query:
            return JsonResponse({'error': 'A search query is required.'}, status=400)

        # Call our utility function to get the images
        results = serach_pixabay(query=search_query)
        print("Pixabay Search Results:", results)  # Debugging log

        # If the function returned None, it means there was an error
        if results is None:
            return JsonResponse({
                'error': 'Failed to fetch images from the provider. Please check the server logs or API key.'
            }, status=503)  # 503 Service Unavailable is a good code for external API failure

        # On success, return the list of images as JSON
        # safe=False is required to send a list as a top-level JSON response
        return JsonResponse(results, safe=False)

@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class CampaignListView(ListView):
    model = Campaign
    template_name = 'campaignhub/campaign_list.html'
    context_object_name = 'campaignhub'
    paginate_by = 10  # Show 10 campaigns per page

    def get_queryset(self):
        # Start with the base queryset for the active organization
        queryset = Campaign.objects.filter(
            organization=self.request.active_organization
        )

        # --- 1. FILTERING by campaign type ---
        campaign_type_filter = self.request.GET.get('type')
        if campaign_type_filter and campaign_type_filter.upper() in Campaign.CampaignType.values:
            queryset = queryset.filter(campaign_type=campaign_type_filter.upper())

        # --- 2. SEARCHING by query parameter 'q' ---
        search_query = self.request.GET.get('q', '')
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(created_by__username__icontains=search_query) |
                Q(status__icontains=search_query)
            )

        # --- 3. SORTING by query parameters 'sort' and 'dir' ---
        sort_by = self.request.GET.get('sort', 'created_at')
        sort_dir = self.request.GET.get('dir', 'desc')
        
        # Whitelist valid sortable columns to prevent security issues
        valid_sort_fields = ['name', 'created_by__username', 'status', 'created_at']
        if sort_by in valid_sort_fields:
            if sort_dir == 'desc':
                sort_by = f"-{sort_by}"
            queryset = queryset.order_by(sort_by)
        else:
            # Default sort
            queryset = queryset.order_by('-created_at')

        # --- OPTIMIZATION: Use select_related for efficiency ---
        final_queryset = queryset.select_related('created_by')

        return final_queryset

    def get_context_data(self, **kwargs):
        # Call the base implementation first to get a context
        context = super().get_context_data(**kwargs)
        
        # --- 4. PRESERVING QUERY PARAMETERS for pagination/sorting links ---
        # Get a mutable copy of the GET parameters
        query_params = self.request.GET.copy()
        
        # We store the current search query to pre-fill the search box
        context['search_query'] = query_params.get('q', '')
        context['current_sort_by'] = query_params.get('sort', 'created_at')
        context['current_sort_dir'] = query_params.get('dir', 'desc')
        
        # If 'page' is in the query params, remove it
        if 'page' in query_params:
            del query_params['page']
        
        # Encode the remaining parameters to be used in template links
        context['query_params'] = query_params.urlencode()
        
        return context

PLAN_OUTPUT_LIMITS = {
    'free': 1,
    'starter': 50,
    'pro': 200,
    'business': 800,
    'enterprise': None,  
}

PLAN_CAMPAIGN_LIMITS = {
    'free': 1,
    'starter': 3,
    'pro': 10,
    'business': None, 
    'enterprise': None,
}

@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class CampaignCreateView(TemplateView):
    template_name = 'campaignhub/create_campaign.html'

    def get_context_data(self, **kwargs):
        logger.info("\n--- CampaignCreateView: Preparing Context Data ---")
        context = super().get_context_data(**kwargs)
        context['page_title'] = 'Create Blog Campaign'
        context['campaign_type'] = Campaign.CampaignType.BLOG

        prompt_queryset = PromptTemplate.objects.filter(
            organization=self.request.active_organization,
            campaign_type=Campaign.CampaignType.BLOG
        )

        # 2. Loop through the queryset of PromptTemplate objects.
        formatted_prompt_list = [
            {
                'id': template.id,
                'name': template.name,
                'system': (template.system_prompt or '').replace('{', '[').replace('}', ']'),
                'user': (template.user_prompt or '').replace('{', '[').replace('}', ']'),
                'last': template.updated_at.strftime('%d.%m.%y %H:%M')
            }
            for template in prompt_queryset
        ]

        # 3. Serialize the NEW formatted list to a JSON string.
        context['prompt_templates_json'] = json.dumps(
            formatted_prompt_list, cls=DjangoJSONEncoder)

        # We still pass the original queryset for any Django-template-based loops
        context['prompt_templates'] = prompt_queryset

        context['active_tab'] = 'blog'

        # Check for an active WordPress integration
        wordpress_integration = Integration.objects.filter(
            organization=self.request.active_organization,
            provider=Integration.Provider.WORDPRESS,
            is_active=True
        ).first()
        context['wordpress_connected'] = wordpress_integration is not None
        # >>> AI plan-gate flag <<<
        org = self.request.active_organization
        plan = org.settings.subscription_plan
        context['user_plan'] = plan.name.lower() if plan else 'free'

        return context
    
    @transaction.atomic
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON format.'}, status=400)

        organization = request.active_organization
        org_settings = organization.settings
        plan_obj = org_settings.subscription_plan

        # 1. Calculate how many posts are being requested
        keyword_texts = {text.strip() for text in data.get('keywords', []) if text.strip()}
        new_posts_count = len(keyword_texts)
        if new_posts_count == 0:
            return JsonResponse({'error': 'At least one keyword is required.'}, status=400)
        
        target_status = data.get('campaign', {}).get('status', 'DRAFT').upper()
        is_creating_active_campaign = target_status in [Campaign.Status.ACTIVE, Campaign.Status.QUEUED]

        # 2. Get the limits from the Plan model
        if plan_obj:
            campaign_limit = plan_obj.campaign_limit
            plan_name = plan_obj.get_name_display()
        else:
            campaign_limit = 1 
            plan_name = "Free"

        # 3. CHECK #1: CAMPAIGN LIMIT (Using the new counter field)
        if campaign_limit is not None and is_creating_active_campaign:
            now = timezone.now()
            anchor_date = org_settings.subscription_start_date or organization.created_at

            # Determine the start of the *current* billing period
            months_diff = (now.year - anchor_date.year) * 12 + now.month - anchor_date.month
            current_period_start = anchor_date + relativedelta(months=months_diff)
            if current_period_start > now and months_diff > 0:
                current_period_start -= relativedelta(months=1)

            # If the last campaign was created *before* this period started,
            # it's time to reset the counter.
            last_campaign_date = Campaign.objects.filter(organization=organization).aggregate(latest=models.Max('created_at'))['latest']
            if last_campaign_date and last_campaign_date < current_period_start:
                 # Check if the last time a campaign was updated is before the start of the current period
                if org_settings.campaigns_created_this_period > 0:
                    logger.info(f"Billing period for Org ID {organization.id} has reset. Resetting campaign counter.")
                    org_settings.campaigns_created_this_period = 0
                    org_settings.save(update_fields=['campaigns_created_this_period'])
                    # We need to refresh the object from the DB to get the new value
                    org_settings.refresh_from_db()

            # Now, perform the check against the counter. This is immune to deletions!
            if org_settings.campaigns_created_this_period >= campaign_limit:
                return JsonResponse({
                    'error': f"Your '{plan_name}' plan is limited to {campaign_limit} new campaigns per billing period. You have already created {org_settings.campaigns_created_this_period}."
                }, status=403)

        # 4. CHECK #2: POST CREDITS (This logic remains the same)
        if new_posts_count > org_settings.output_credits_remaining:
            return JsonResponse({
                'error': f"You are trying to create {new_posts_count} posts, but you only have {org_settings.output_credits_remaining} credits left."
            }, status=403)

        try:
            print("\n" + "="*50)
            print("RECEIVED JSON PAYLOAD (All Validations Passed):")
            pprint.pprint(data)
            print("="*50 + "\n")
            # --- 1. Create the Main Campaign ---
            org_settings.output_credits_remaining -= new_posts_count
            org_settings.save(update_fields=['output_credits_remaining'])
            campaign_data = data.get('campaign', {})
            campaign_name = campaign_data.get('name')
            if not campaign_name:
                return JsonResponse({'error': 'Campaign Name is required.'}, status=400)

            # --- Get the campaign_type from the frontend JSON payload ---
            # We default to BLOG if it's not provided or invalid.
            campaign_type = campaign_data.get(
                'type', Campaign.CampaignType.BLOG).upper()
            if campaign_type not in Campaign.CampaignType.values:
                campaign_type = Campaign.CampaignType.BLOG  # Safety default

            # Get the desired status from the payload, defaulting to 'DRAFT'.
            target_status = campaign_data.get(
                'status', Campaign.Status.DRAFT).upper()

            # Ensure the provided status is a valid choice.
            if target_status not in Campaign.Status.values:
                target_status = Campaign.Status.DRAFT  # Safety default
            
            target_post_status = campaign_data.get(
                'post_creation_status', 'SCHEDULED').upper()

            new_campaign = Campaign.objects.create(
                organization=request.active_organization,
                created_by=request.user,
                name=campaign_name,
                campaign_type=campaign_type,
                status=target_status,
                post_creation_status=target_post_status
            )
            if is_creating_active_campaign:
                org_settings.campaigns_created_this_period = F('campaigns_created_this_period') + 1
                org_settings.save(update_fields=['campaigns_created_this_period'])
                logger.info(f"Incremented campaign counter for Org ID {organization.id}. New count: {org_settings.campaigns_created_this_period + 1}")

            # --- 2. Create Prompt Settings ---
            prompt_data = data.get('prompt', {})
            PromptSettings.objects.create(
                campaign=new_campaign,
                prompt_name=prompt_data.get('name') or campaign_name,
                # Convert `[` back to `{` and `]` back to `}` before saving
                system_prompt=(prompt_data.get('system') or '').replace(
                    '[', '{').replace(']', '}'),
                user_prompt=(prompt_data.get('user') or '').replace(
                    '[', '{').replace(']', '}')
            )

            # --- 3. Create Keyword Settings ---
            settings_data = data.get('settings', {})
            keyword_settings = KeywordSettings.objects.create(
                campaign=new_campaign,
                use_clustering=settings_data.get('useClustering', False)
            )

            keyword_texts = set(data.get('keywords', []))
            keyword_objects = []
            for text in keyword_texts:
                if stripped_text := text.strip():
                    keyword_obj, _ = Keyword.objects.get_or_create(
                        organization=request.active_organization,
                        text=stripped_text
                    )
                    keyword_objects.append(keyword_obj)

            if keyword_objects:
                keyword_settings.keywords.set(keyword_objects)

            # --- 4. Create Content Settings ---
               # --- 4. Create Content Settings (with AI Image settings) ---
            tone = settings_data.get('tone', ContentSettings.Tone.PROFESSIONAL)
            if tone not in ContentSettings.Tone.values:
                tone = ContentSettings.Tone.PROFESSIONAL

            raw_tags_payload = settings_data.get('tags', [])
            tags_payload = process_tags_payload(raw_tags_payload)
            
            # Extract AI Image settings
            ai_image_settings = settings_data.get('aiImage', {})
            ai_image_enabled = ai_image_settings.get('enabled', False)
            ai_image_style = ai_image_settings.get('style', 'realistic')
            ai_image_instructions = ai_image_settings.get('instructions', '')

            ContentSettings.objects.create(
                campaign=new_campaign,
                word_count=int(settings_data.get('wordCount') or 1000),
                tone_of_voice=tone,
                temperature=float(settings_data.get('temperature') or 1.0),
                tags=tags_payload,
                categories=settings_data.get('category', ''),
                seo_plugin=settings_data.get('seoPlugin', ''),
                # AI Image settings
                ai_image_enabled=ai_image_enabled,
                ai_image_style=ai_image_style,
                ai_image_instructions=ai_image_instructions
            )
            # --- 5. Create Media Settings ---
            media_data = data.get('media', {})
            processed_cover_images = {}
            processed_content_images = {}
            detected_media_types = set()

            # --- Process Cover Images (handles both list and dict) ---
            cover_images_payload = media_data.get('coverImg')

            # Case 1: Payload is a LIST of objects, e.g., [{'keyword': 'k', 'url': 'u'}]
            if isinstance(cover_images_payload, list):
                for item in cover_images_payload:
                    keyword = item.get('keyword')
                    image_string = item.get('url')
                    if keyword and image_string:
                        processed_url = process_image_string(image_string)
                        if processed_url:
                            processed_cover_images[keyword] = processed_url
                            detected_media_types.add(
                                detect_media_type_from_url(processed_url)
                            )

            # Case 2: Payload is a DICTIONARY, e.g., {'keyword': 'data:image/...'}
            elif isinstance(cover_images_payload, dict):
                for keyword, image_string in cover_images_payload.items():
                    if keyword and image_string:
                        processed_url = process_image_string(image_string)
                        if processed_url:
                            processed_cover_images[keyword] = processed_url
                            detected_media_types.add(
                                detect_media_type_from_url(processed_url)
                            )

            # --- Process Content Images (handles both list and dict) ---
            content_images_payload = media_data.get('content')

            # Case 1: Payload is a LIST of objects, e.g., [{'keyword': 'k', 'urls': ['u1', 'u2']}]
            if isinstance(content_images_payload, list):
                for item in content_images_payload:
                    keyword = item.get('keyword')
                    urls_list = item.get('urls', [])
                    if keyword and isinstance(urls_list, list):
                        processed_urls = [process_image_string(u) for u in urls_list if u]
                        valid_urls = [u for u in processed_urls if u]
                        if valid_urls:
                            processed_content_images[keyword] = valid_urls
                            for url in valid_urls:
                                detected_media_types.add(
                                    detect_media_type_from_url(url)
                                )

            # Case 2: Payload is a DICTIONARY, e.g., {'keyword': ['u1', 'u2']}
            elif isinstance(content_images_payload, dict):
                for keyword, urls_list in content_images_payload.items():
                    if keyword and isinstance(urls_list, list):
                        processed_urls = [process_image_string(u) for u in urls_list if u]
                        valid_urls = [u for u in processed_urls if u]
                        if valid_urls:
                            processed_content_images[keyword] = valid_urls
                            for url in valid_urls:
                                detected_media_types.add(
                                    detect_media_type_from_url(url)
                                )

            media_source = media_data.get('mode', 'auto').upper()
            if media_source not in MediaSettings.Source.values:
                media_source = MediaSettings.Source.AUTO

            media_type_choice = MediaSettings.MediaType.IMAGE
            if MediaSettings.MediaType.VIDEO in detected_media_types:
                media_type_choice = MediaSettings.MediaType.VIDEO

            MediaSettings.objects.create(
                campaign=new_campaign,
                media_type=media_type_choice,
                source_type=media_source,
                image_source_platform=media_data.get('imageSourcePlatform'),
                search_prompt=media_data.get('imageSearchPrompt'),
                cover_images=processed_cover_images,
                content_images=processed_content_images
            )

            # --- 6. Create Schedule Settings ---
            schedule_data = data.get('schedule', {})
            # Get randomness settings (support both camelCase and snake_case keys)
            raw_rp = schedule_data.get('randomnessPercent', schedule_data.get('randomness_percent'))
            raw_rl = schedule_data.get('randomnessLock', schedule_data.get('randomness_lock'))

            # Defensive parsing: handle None, strings, and numbers gracefully
            try:
                if raw_rp is None:
                    randomness_percent = 0
                else:
                    # Accept numeric types or numeric strings; fall back to 0 on failure
                    randomness_percent = int(raw_rp)
                    if randomness_percent < 0:
                        randomness_percent = 0
                    if randomness_percent > 100:
                        randomness_percent = 100
            except (ValueError, TypeError):
                randomness_percent = 0

            # Normalize lock value: accept 'yes'/'no', booleans, or truthy strings
            try:
                if raw_rl is None:
                    randomness_lock = False
                else:
                    randomness_lock = str(raw_rl).strip().lower() == 'yes'
            except Exception:
                randomness_lock = False

            # If locked, set randomness to 0
            if randomness_lock:
                randomness_percent = 0
                logger.info(f"🎲 RANDOMNESS LOCKED - Setting to 0%")
            else:
                logger.info(f"🎲 RANDOMNESS UNLOCKED - Using {randomness_percent}%")

            # Add debug logging showing raw and normalized values
            logger.info(f"🎲 Raw randomnessPercent: {raw_rp}")
            logger.info(f"🎲 Raw randomnessLock: {raw_rl}")
            logger.info(f"🎲 Converted randomness_lock: {randomness_lock}")
            logger.info(f"🎲 Final randomness_percent: {randomness_percent}")

            start_datetime_str = schedule_data.get('start')
            if not start_datetime_str:
                return JsonResponse({'error': 'First Publish Date & Time is required.'}, status=400)

            # Get the timezone string from the payload, defaulting to UTC
            user_timezone_str = schedule_data.get('timezone', 'UTC')

            # Create a naive datetime object from the string
            naive_start_datetime = datetime.strptime(start_datetime_str, '%Y-%m-%d %H:%M')

            try:
                # Get the correct timezone object
                user_timezone = pytz.timezone(user_timezone_str)
                # Make the datetime object "aware" of its timezone
                aware_start_datetime = user_timezone.localize(naive_start_datetime)
            except pytz.UnknownTimeZoneError:
                # Fallback to UTC if the timezone is invalid
                aware_start_datetime = timezone.make_aware(naive_start_datetime, timezone.utc)


            freq_unit = schedule_data.get('every', 'days').upper()
            if freq_unit not in ScheduleSettings.Frequency.values:
                freq_unit = ScheduleSettings.Frequency.DAYS

            ScheduleSettings.objects.create(
                campaign=new_campaign,
                start_datetime=aware_start_datetime,  # Save the timezone-aware datetime
                frequency_unit=freq_unit,
                frequency_value=int(schedule_data.get('interval') or 1),
                timezone=user_timezone_str, # Continue to save the timezone string for reference
                # Add these new fields
                randomness_percent=randomness_percent,
                randomness_lock=randomness_lock
            )
            # --- SUCCESS RESPONSE ---
            success_message = f"Campaign '{new_campaign.name}' has been created and queued."
            if target_status == Campaign.Status.DRAFT:
                success_message = f"Campaign '{new_campaign.name}' has been created as a draft."
            messages.success(request, success_message)
            return JsonResponse({
                'message': success_message,
                'redirect_url': reverse('campaignhub:campaign_list')
            })

        except (ValueError, TypeError) as e:
            # This will trigger the transaction rollback, refunding the credits automatically.
            logger.error(f"Data conversion error during campaign creation: {e}", exc_info=True)
            return JsonResponse({'error': f'Invalid data format: {e}'}, status=400)
        except Exception as e:
            # This will also trigger the transaction rollback.
            logger.error(f"Unexpected server error during campaign creation: {e}", exc_info=True)
            return JsonResponse({'error': 'An unexpected server error occurred.'}, status=500)


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class CampaignDeleteView(View):
    """
    Handles the deletion of a Campaign instance via a POST request.
    """

    def post(self, request, *args, **kwargs):
        campaign_id = kwargs.get('pk')
        try:
            # Ensure the campaign exists and belongs to the user's active organization for security
            campaign = get_object_or_404(
                Campaign,
                id=campaign_id,
                organization=request.active_organization
            )

            campaign_name = campaign.name
            campaign.delete()

            messages.success(
                request, f"Campaign '{campaign_name}' has been deleted successfully.")

        except Campaign.DoesNotExist:
            messages.error(
                request, "The campaign you tried to delete does not exist.")
        except Exception as e:
            # Log the error for debugging purposes
            print(f"Error deleting campaign ID {campaign_id}: {e}")
            messages.error(
                request, "An unexpected error occurred while deleting the campaign.")

        return redirect('campaignhub:campaign_list')


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class SavePromptTemplateView(View):
    def post(self, request, *args, **kwargs):
        try:
            data = json.loads(request.body)
            name = data.get('name')
            system_prompt = data.get('system_prompt')
            user_prompt = data.get('user_prompt')
            campaign_type = data.get('campaign_type')

            if not name:
                return JsonResponse({'error': 'Template name is required.'}, status=400)

            if not campaign_type or campaign_type not in Campaign.CampaignType.values:
                return JsonResponse({'error': 'Invalid campaign type.'}, status=400)

            template = PromptTemplate.objects.create(
                organization=request.active_organization,
                created_by=request.user,
                name=name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                campaign_type=campaign_type
            )

            # Return the created template's data so the frontend can add it to the list
            return JsonResponse({
                'message': 'Prompt template saved successfully!',
                'template': {
                    'id': str(template.id),
                    'name': template.name,
                    'system': template.system_prompt or '',
                    'user': template.user_prompt or '',
                    'last': template.updated_at.strftime('%d.%m.%y %H:%M')
                }
            }, status=201)

        except IntegrityError:
            return JsonResponse({'error': 'A prompt with this name already exists for this campaign type.'}, status=400)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON.'}, status=400)
        except Exception as e:
            # Log the error e for debugging
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class UpdatePromptTemplateView(View):
    def post(self, request, *args, **kwargs):
        prompt_id = kwargs.get('pk')

        try:
            data = json.loads(request.body)
            # --- GET THE NAME FROM THE PAYLOAD ---
            name = data.get('name')
            system_prompt = data.get('system_prompt')
            user_prompt = data.get('user_prompt')

            if not name:
                return JsonResponse({'error': 'Template name cannot be empty.'}, status=400)

            prompt_template = get_object_or_404(
                PromptTemplate,
                id=prompt_id,
                organization=request.active_organization
            )

            # --- ADD NAME TO THE UPDATE ---
            prompt_template.name = name
            prompt_template.system_prompt = system_prompt
            prompt_template.user_prompt = user_prompt
            prompt_template.save()  # This also updates the `updated_at` field

            # --- RETURN THE UPDATED DATA ---
            return JsonResponse({
                'message': f"Prompt '{prompt_template.name}' updated successfully.",
                'template': {
                    'id': str(prompt_template.id),
                    'name': prompt_template.name,
                    'system': prompt_template.system_prompt or '',
                    'user': prompt_template.user_prompt or '',
                    'last': prompt_template.updated_at.strftime('%d.%m.%y %H:%M')
                }
            })

        except IntegrityError:
            return JsonResponse({'error': 'A prompt with this name already exists.'}, status=400)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': f'An unexpected error occurred: {str(e)}'}, status=500)


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class ListPromptTemplatesView(View):
    """
    Provides a JSON list of prompt templates for the active organization.
    This is used by the AJAX call in the create-campaign form.
    """

    def get(self, request, *args, **kwargs):
        print("Fetching prompt templates for organization:",
              request.active_organization)
        print("requesting data:", request)
        print("requesting data type", request.GET.get('type'))
        type = request.GET.get('type', Campaign.CampaignType.BLOG).upper()
        if type not in Campaign.CampaignType.values:
            type = Campaign.CampaignType.BLOG
        # This logic is identical to the one in CampaignCreateView
        prompt_queryset = PromptTemplate.objects.filter(
            organization=request.active_organization,
            campaign_type=type
        ).order_by('-updated_at')

        formatted_prompt_list = []
        for template in prompt_queryset:
            formatted_prompt_list.append({
                'id': str(template.id),  # Convert UUID to string for JSON
                'name': template.name,
                'system': template.system_prompt or '',
                'user': template.user_prompt or '',
                'last': template.updated_at.strftime('%d.%m.%y %H:%M')
            })

        # Return the list as a JSON response
        return JsonResponse(formatted_prompt_list, safe=False)


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class DeletePromptTemplateView(View):
    """
    Handles the deletion of a PromptTemplate instance.
    Accepts POST requests to ensure the action is intentional.
    """

    def post(self, request, *args, **kwargs):
        prompt_id = kwargs.get('pk')
        try:
            # Ensure the template exists and belongs to the user's organization
            prompt_template = get_object_or_404(
                PromptTemplate,
                id=prompt_id,
                organization=request.active_organization
            )

            template_name = prompt_template.name
            prompt_template.delete()

            return JsonResponse({
                'message': f"Prompt template '{template_name}' has been deleted."
            }, status=200)

        except Exception as e:
            # Log the full error for debugging purposes
            print(f"Error deleting prompt template ID {prompt_id}: {e}")
            return JsonResponse({'error': 'An unexpected error occurred while deleting the template.'}, status=500)


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class PostListView(ListView):
    model = Post
    template_name = 'campaignhub/post_list.html'
    context_object_name = 'posts'

    def get_queryset(self):
        """
        Ensures users only see posts from their active organization and pre-fetches
        related data to improve performance.
        """
        return Post.objects.filter(
            campaign__organization=self.request.active_organization
        ).select_related('campaign', 'campaign__created_by', 'integration_target').order_by('-publish_at')

    def get_context_data(self, **kwargs):
        """
        Serializes the post data to JSON and adds it to the context
        for the frontend to use.
        """
        context = super().get_context_data(**kwargs)
        posts_qs = self.object_list  # Use self.object_list from ListView

        posts_data = []
        for post in posts_qs:
            channel = '—'
            if post.integration_target:
                channel = post.integration_target.get_provider_display()
            elif post.campaign:
                channel = post.campaign.get_campaign_type_display()

            current_status = post.status.lower()
            if post.is_failed:  # Use the new property from the model
                display_status = 'failed'
            else:
                display_status = current_status

            posts_data.append({
                "id": post.pk,
                "title": post.title,
                "campaign": post.campaign.name if post.campaign else '—',
                "channel": channel,
                "status": display_status,
                "publishAt": post.publish_at,
                "createdAt": post.created_at,
                "owner": post.campaign.created_by.username if post.campaign and post.campaign.created_by else '—',
            })

        context['posts_json'] = json.dumps(posts_data, cls=DjangoJSONEncoder)

        # Check for active WordPress integration
        wordpress_integration = Integration.objects.filter(
            organization=self.request.active_organization,
            provider=Integration.Provider.WORDPRESS,
            is_active=True
        ).first()
        context['wordpress_integration_active'] = wordpress_integration is not None

        return context

# --- VIEW 2: TO HANDLE THE "SEND TO WORDPRESS" ACTION ---


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class SendPostToWordPressView(View):

    def post(self, request, *args, **kwargs):
        post_id = kwargs.get('pk')
        try:
            post = get_object_or_404(
                Post, pk=post_id, campaign__organization=request.active_organization)

            integration = get_object_or_404(
                Integration,
                organization=request.active_organization,
                provider=Integration.Provider.WORDPRESS,
                is_active=True
            )

            # --- Use the new helper function ---
            success, message = publish_post_to_wordpress(
                post, integration)

            if success:
                return JsonResponse({
                    'status': 'success',
                    'message': message,
                    'published_url': post.published_url
                })
            else:
                # The helper function provides the detailed error message
                return JsonResponse({'status': 'error', 'message': message}, status=400)

        except Integration.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Active WordPress integration not found.'}, status=404)
        except Post.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Post not found.'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': f'An unexpected error occurred: {str(e)}'}, status=500)


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class PostStatusUpdateView(View):
    def post(self, request, *args, **kwargs):
        post_id = kwargs.get('pk')
        try:
            data = json.loads(request.body)
            new_status = data.get('status', '').upper()

            if new_status not in Post.Status.values:
                return JsonResponse({'status': 'error', 'message': 'Invalid status provided.'}, status=400)

            post = get_object_or_404(
                Post, pk=post_id, campaign__organization=request.active_organization)
            post.status = new_status
            post.save()

            return JsonResponse({'status': 'success', 'message': f'Post status updated to {post.get_status_display()}.'})

        except (Post.DoesNotExist, json.JSONDecodeError, Exception) as e:
            return JsonResponse({'status': 'error', 'message': f'Failed to update status: {str(e)}'}, status=400)


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class ApproveCampaignView(View):
    """
    Handles changing a Campaign's status from DRAFT to QUEUED.
    """

    def post(self, request, *args, **kwargs):
        campaign_id = kwargs.get('pk')
        try:
            # For security, ensure the campaign exists and belongs to the user's active organization
            campaign = get_object_or_404(
                Campaign,
                id=campaign_id,
                organization=request.active_organization
            )

            # Only allow approval if the campaign is currently a DRAFT
            if campaign.status == Campaign.Status.DRAFT:
                campaign.status = Campaign.Status.QUEUED
                # Efficiently save only the changed field
                campaign.save(update_fields=['status'])
                messages.success(
                    request, f"Campaign '{campaign.name}' has been approved and is now in the queue.")
            else:
                # This prevents approving an already queued or completed campaign
                messages.warning(
                    request, f"Campaign '{campaign.name}' could not be approved because its status is not 'Draft'.")

        except Campaign.DoesNotExist:
            messages.error(
                request, "The campaign you tried to approve does not exist.")
        except Exception as e:
            # Log the error for debugging
            print(f"Error approving campaign ID {campaign_id}: {e}")
            messages.error(
                request, "An unexpected error occurred while approving the campaign.")

        return redirect('campaignhub:campaign_list')


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class ListBlogPostsView(View):
    """
    Provides a JSON list of published blog posts for the active organization.
    This is used to populate the 'Blog Link' table in the social campaign creator.
    """

    def get(self, request, *args, **kwargs):
        # We query the Post model, filtering for posts that are PUBLISHED
        # and belong to the user's current organization for security.
        published_posts = Post.objects.filter(
            campaign__organization=request.active_organization,
            status=Post.Status.PUBLISHED
        ).order_by('-publish_at')  # Show the most recent posts first

        # Format the data into a list of dictionaries (JSON)
        formatted_post_list = []
        for post in published_posts:
            formatted_post_list.append({
                'id': post.id,
                'title': post.title,
                'url': post.published_url,
                # Format the date to be more readable
                'published': post.publish_at.strftime('%Y-%m-%d %H:%M'),
                # Get the human-readable version of the status (e.g., "Published")
                'status': post.get_status_display()
            })

        # Return the list as a JSON response
        return JsonResponse(formatted_post_list, safe=False)


class SocialCampaignView(TemplateView):
    template_name = 'campaignhub/create_campaign_social.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['active_tab'] = 'social'
        
        # Add user plan context (same as CampaignCreateView)
        org = self.request.active_organization
        plan = org.settings.subscription_plan
        context['user_plan'] = plan.name.lower() if plan else 'free'
        
        return context


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class PostDeleteView(View):
    """
    Handles the deletion of a single Post via an AJAX request.
    """

    def post(self, request, *args, **kwargs):
        post_id = kwargs.get('pk')
        try:
            post = get_object_or_404(
                Post, pk=post_id, campaign__organization=request.active_organization)
            post.delete()
            return JsonResponse({'status': 'success', 'message': 'Post deleted successfully.'})
        except Post.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Post not found.'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


def publish_posts_in_background(post_ids, integration_id, organization_id):
    """
    This function runs in a background thread and handles the actual publishing.
    Now includes image upload functionality.
    """
    try:
        queryset = Post.objects.filter(
            id__in=post_ids,
            campaign__organization_id=organization_id
        )
        integration = Integration.objects.get(id=integration_id)
        
        print(f"--- Background Task Started: Publishing {queryset.count()} posts ---")

        success_count = 0
        failures = []
        num_posts = queryset.count()

        for i, post in enumerate(queryset):
            if post.status != Post.Status.PUBLISHED:
                # Use the updated publish_post_to_wordpress that now handles images
                success, result_message = publish_post_to_wordpress(post, integration)
                if success:
                    success_count += 1
                else:
                    failures.append(f"Post ID {post.id}: {result_message}")
                    post.status = Post.Status.PUBLISH_FAILED
                    post.save()

            # Add the delay between each post (including image upload time)
            if i < num_posts - 1:
                time.sleep(60)  # 60-second delay between posts

        final_message = f'Successfully published {success_count} posts.'
        if failures:
            final_message += f'\nFailed to publish {len(failures)} posts.\nDetails:\n' + '\n'.join(failures)
        
        print(f"--- Background Task Finished ---")
        print(final_message)

    except Exception as e:
        import traceback
        print("--- ERROR in background task ---")
        traceback.print_exc()


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class PostBulkActionView(View):
    """
    Handles bulk actions and initiates long-running tasks in the background.
    """

    def post(self, request, *args, **kwargs):
        try:
            print("\n--- DEBUG: Inside PostBulkActionView ---")
            data = json.loads(request.body)
            action = data.get('action')
            ids = data.get('ids')
            print(f"--- Action: {action}, IDs: {ids} ---")

            if not action or not isinstance(ids, list):
                return HttpResponseBadRequest('Invalid request: Missing action or IDs.')

            # The initial queryset is still useful for validation and other actions
            queryset = Post.objects.filter(
                id__in=ids,
                campaign__organization=request.active_organization
            )

            if action == 'publish':
                integration = Integration.objects.filter(
                    organization=request.active_organization,
                    provider=Integration.Provider.WORDPRESS,
                    is_active=True
                ).first()

                if not integration:
                    return JsonResponse({
                        'status': 'error',
                        'message': 'Cannot publish. No active WordPress integration found.'
                    }, status=400)

                # --- 2. Start the background thread ---
                # We pass simple IDs instead of full objects to the thread.
                thread = threading.Thread(
                    target=publish_posts_in_background,
                    args=(ids, integration.id, request.active_organization.id)
                )
                thread.start()

                # --- 3. Return an immediate response to the frontend ---
                return JsonResponse({
                    'status': 'success',
                    'message': f'Bulk publishing of {len(ids)} posts has been initiated. The Post will be updated as they are published.'
                })

            elif action == 'delete':
                count, _ = queryset.delete()
                return JsonResponse({'status': 'success', 'message': f'Successfully deleted {count} posts.'})

            elif action in ['schedule', 'draft', 'approved']: 
                # If the action is 'schedule' OR 'approved', set to SCHEDULED. Otherwise, set to DRAFT.
                new_status = Post.Status.SCHEDULED if action in ['schedule', 'approved'] else Post.Status.DRAFT
                # Determine the correct noun for the success message
                status_word = "Scheduled" if new_status == Post.Status.SCHEDULED else "Draft"
                count = queryset.update(status=new_status)
                return JsonResponse({'status': 'success', 'message': f'Successfully updated {count} posts to {status_word}.'})

            else:
                return HttpResponseBadRequest('Invalid action.')

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'error': str(e)}, status=500)


@method_decorator(login_required, name='dispatch')
# @method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class AnalyticsDataView(LoginRequiredMixin, View):
    """
    This view provides all the necessary post data for the analytics dashboard
    as a JSON response.
    """

    def get(self, request, *args, **kwargs):
        # 1. Query all posts belonging to the user's active organization.
        #    We use select_related to efficiently fetch related campaign and user data
        #    in a single database query, which is much faster.
        queryset = Post.objects.filter(
            campaign__organization=request.active_organization
        ).select_related('campaign', 'campaign__created_by')

        # 2. Format the data into a list of dictionaries, matching the structure
        #    your existing JavaScript expects.
        posts_data = []
        for post in queryset:
            # Determine the 'channel' based on the campaign type
            channel = post.campaign.get_campaign_type_display() if post.campaign else '—'

            posts_data.append({
                "id": post.pk,
                "title": post.title,
                "campaign": post.campaign.name if post.campaign else '—',
                "channel": channel,
                "status": post.status.lower(),  
                "publishAt": post.publish_at,
                "createdAt": post.created_at,
                "owner": post.campaign.created_by.username if post.campaign and post.campaign.created_by else '—',
            })
        print("AnalyticsDataView: Returning", len(posts_data), "posts")

        # 3. Return the data as a JSON response.
        #    We use DjangoJSONEncoder to correctly handle dates and times.
        return JsonResponse(posts_data, safe=False, encoder=DjangoJSONEncoder)

# Your existing AnalyticsView can remain as it is, since it just serves the template.


class AnalyticsView(TemplateView):
    template_name = 'campaignhub/analytics.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['active_tab'] = 'analytics'
        return context

@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class WordPressCategoriesView(View):
    """
    An API endpoint to fetch all categories from the user's connected
    and active WordPress integration.
    """

    def get(self, request, *args, **kwargs):
        # 1. Find the active WordPress integration for the organization
        try:
            integration = Integration.objects.get(
                organization=request.active_organization,
                provider=Integration.Provider.WORDPRESS,
                is_active=True
            )
        except Integration.DoesNotExist:
            # If no active integration is found, return a clear error
            return JsonResponse({
                'error': 'No active WordPress integration found. Please connect your site in the organization settings.'
            }, status=404) # 404 Not Found is appropriate here

        # 2. Prepare the request to the WordPress REST API
        #    We ask for up to 100 categories per page, which should be enough for most sites.
        wp_api_url = f"{integration.api_url.rstrip('/')}/wp-json/wp/v2/categories?per_page=100"
        
        # We use the username and the Application Password (stored in api_key) for authentication
        auth_credentials = (integration.username, integration.api_key)

        # 3. Make the API call and handle potential errors
        try:
            response = requests.get(
                wp_api_url,
                auth=auth_credentials,
                timeout=15  # Set a 15-second timeout to prevent hangs
            )
            # Raise an exception for bad status codes (4xx or 5xx)
            response.raise_for_status()

        except requests.exceptions.Timeout:
            return JsonResponse({'error': 'The connection to your WordPress site timed out.'}, status=408)
        except requests.exceptions.RequestException as e:
            # This catches connection errors, DNS errors, etc.
            return JsonResponse({
                'error': f"Could not connect to your WordPress site. Please check the URL in your settings"
            }, status=400)
        except Exception as e:
            # This is a fallback for other unexpected errors during the request
            return JsonResponse({'error': f'An unexpected error occurred: {str(e)}'}, status=500)

        # 4. Process the successful response
        try:
            categories_data = response.json()
            # We will simplify the data for the frontend, sending only what's needed.
            formatted_categories = [
                {'id': cat['id'], 'name': cat['name']}
                for cat in categories_data
                if cat.get('name') and cat.get('id') # Ensure the category has a name and ID
            ]
            
            # Return the clean list of categories
            return JsonResponse(formatted_categories, safe=False)

        except json.JSONDecodeError:
            return JsonResponse({
                'error': 'Received an invalid response from your WordPress site. It was not valid JSON.'
            }, status=500)

@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class AutoMatchImagesView(View):
    def get(self, request, *args, **kwargs):
        keyword = request.GET.get('keyword', '').strip()
        image_platform = request.GET.get('imageSourcePlatform', '').strip()

        if not keyword:
            return JsonResponse({'error': 'A keyword is required.'}, status=400)
        if not image_platform:
            return JsonResponse({'error': 'An image source platform is required.'}, status=400)

        # Add AI image platform support with credit check
        if image_platform == 'dalle':
            # --- SIMPLE CREDIT CHECK FOR AI IMAGES ---
            organization = request.active_organization
            org_settings = organization.settings
            
            # Check if user is on free plan
            plan = org_settings.subscription_plan
            if plan and plan.name.lower() == 'free':
                return JsonResponse({
                    'error': 'AI image generation is not available on Free plan. Please upgrade to Pro, Business, or Enterprise.'
                }, status=403)
            
            # Check if user has credits
            if org_settings.output_credits_remaining <= 0:
                return JsonResponse({
                    'error': 'No credits remaining for AI image generation. Please purchase more credits.'
                }, status=403)
            
            try:
                result = AIImageGenerator.generate_ai_image(
                    prompt=keyword,
                    style='realistic'
                )
                if result['success']:
                    # Deduct 1 credit for successful AI image generation
                    org_settings.output_credits_remaining = F('output_credits_remaining') - 1
                    org_settings.save()
                    org_settings.refresh_from_db()
                    
                    logger.info(f"AI image generated via AutoMatch. Credits remaining: {org_settings.output_credits_remaining}")
                    
                    return JsonResponse({
                        'status': 'success',
                        'images': [result['image_url']]
                    })
                else:
                    return JsonResponse({'error': result['error']}, status=500)
            except Exception as e:
                return JsonResponse({'error': f'AI image generation failed: {str(e)}'}, status=500)
        
        # Existing logic for other platforms...
        search_function = None
        if image_platform == 'pexels':
            search_function = search_pexels
        elif image_platform == 'unsplash':
            search_function = serach_unsplash
        elif image_platform == 'pixabay':
            search_function = serach_pixabay
        
        if not search_function:
            return JsonResponse({'error': 'Invalid image source platform.'}, status=400)

        try:
            images = search_function(query=keyword, per_page=5)
            if not images:
                return JsonResponse({'error': 'No images found for this keyword.'}, status=404)

            image_urls = [img.get('large_image') for img in images if img.get('large_image')]
            if not image_urls:
                return JsonResponse({'error': 'No valid image URLs found.'}, status=404)

            return JsonResponse({
                'status': 'success',
                'images': image_urls
            })

        except Exception as e:
            logger.error(f"FindBestImage failed for keyword '{keyword}': {e}")
            return JsonResponse({'error': 'An unexpected server error occurred.'}, status=500)
  


@method_decorator(login_required, name='dispatch')
@method_decorator(role_required('ADMIN', 'EDITOR'), name='dispatch')
class AIImageSearchView(View):
    """
    Professional JSON-only endpoint for DALL·E image generation.
    GET params:
        query : str  – required, will be stripped
        style : str  – optional, defaults to 'realistic'
    """

    def get(self, request, *args, **kwargs):
        query = request.GET.get('query', '').strip()
        style = request.GET.get('style', 'realistic').strip() or 'realistic'

        # --- basic validation -------------------------------------------------
        if not query:
            return JsonResponse({'error': 'A search query is required.'}, status=400)

        allowed_styles = {choice[0] for choice in
                          ContentSettings._meta.get_field('ai_image_style').choices}
        if style not in allowed_styles:
            return JsonResponse({'error': f'Unsupported style "{style}".'}, status=400)

        # --- SIMPLE CREDIT CHECK -------------------------------------------------
        organization = request.active_organization
        org_settings = organization.settings
        
        # Check if user is on free plan
        plan = org_settings.subscription_plan
        if plan and plan.name.lower() == 'free':
            return JsonResponse({
                'error': 'AI image generation is not available on Free plan. Please upgrade to Pro, Business, or Enterprise.'
            }, status=403)
        
        # Check if user has credits
        if org_settings.output_credits_remaining <= 0:
            return JsonResponse({
                'error': 'No credits remaining for AI image generation. Please purchase more credits.'
            }, status=403)

        # --- generation -------------------------------------------------------
        try:
            result = AIImageGenerator.generate_ai_image(prompt=query, style=style)
        except Exception as exc:  # network, coding bug, missing key, etc.
            logger.exception('Unhandled exception while calling AIImageGenerator')
            return JsonResponse({'error': 'Image service unavailable. Please try again later.'},
                                status=503)

        # --- success / controlled failure -------------------------------------
        if result.get('success'):
            # Deduct 1 credit for successful AI image generation
            org_settings.output_credits_remaining = F('output_credits_remaining') - 1
            org_settings.save()
            org_settings.refresh_from_db()
            
            logger.info(f"AI image generated. Credits remaining: {org_settings.output_credits_remaining}")
            
            return JsonResponse([{
                'large_image': result['image_url'],
                'original_url': result.get('original_url', result['image_url']),
                'photographer': 'AI Generated',
                'photographer_url': '',
                'source': 'dalle',
                'alt': query,
            }], safe=False)

        # `result['error']` already contains the user-safe message from utility
        logger.warning('DALL·E generation error: %s', result['error'])
        return JsonResponse({'error': result['error']}, status=502)  # 502 = upstream failure
# campaignhub/agent.py

from django.utils import timezone
from django.db.models import F
from .models import Campaign, Post, Keyword, ScheduleSettings, CampaignLog
from accounts.models import OrganizationSettings
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate
from langchain.output_parsers import PydanticOutputParser
import os
import logging
from datetime import timedelta
from typing import TypedDict, Optional, List
import pytz
# --- Environment and Django Setup ---
import django
from django.conf import settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'campaign.settings')
from .ai_image_utils import AIImageGenerator

# --- End Setup ---


# --- Logging Setup ---
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# === HELPER FOR DATABASE LOGGING ===
def log_to_db(campaign_id: str, level: str, message: str, node_name: str = ""):
    """Helper function to create a CampaignLog entry."""
    try:
        CampaignLog.objects.create(
            campaign_id=campaign_id, level=level, message=message, node_name=node_name)
    except Exception as e:
        print(
            f"CRITICAL: Failed to write log to database for campaign {campaign_id}. Error: {e}")


# === 1. DEFINE THE AGENT'S STATE ===
class BlogGenerationState(TypedDict):
    campaign_id: str
    campaign: Optional[Campaign]
    is_first_run: bool
    stop_reason: Optional[str]
    error_message: Optional[str]
    posts_created_count: int
    selected_keyword_obj: Optional[Keyword]
    generated_title: Optional[str]
    generated_meta_description: Optional[str]  # This field is necessary
    generated_content_html: Optional[str]
    generated_tags: Optional[List[str]]
    next_publish_at: Optional[timezone.datetime]
    featured_image_url: Optional[str]


# === 2. DEFINE THE NODES ===

def pre_flight_check(state: BlogGenerationState) -> dict:
    campaign_id = state['campaign_id']
    log_to_db(campaign_id, "INFO", "Agent run started.", "pre_flight_check")
    logger.info(f"--- ✈️ [PRE-FLIGHT CHECK] Campaign ID: {campaign_id} ---")
    try:
        campaign = Campaign.objects.select_related(
            'schedule_settings', 'keyword_settings').get(id=campaign_id)
        if campaign.status not in [Campaign.Status.QUEUED, Campaign.Status.ACTIVE]:
            reason = f"Campaign is not in a runnable state (status: {campaign.status})"
            log_to_db(campaign_id, "WARNING", reason, "pre_flight_check")
            return {"stop_reason": reason}
        is_first_run = campaign.status == Campaign.Status.QUEUED
        all_keyword_ids = set(
            campaign.keyword_settings.keywords.values_list('id', flat=True))
        used_keyword_ids = set(Post.objects.filter(
            campaign=campaign).values_list('keyword_id', flat=True))
        if not (all_keyword_ids - used_keyword_ids):
            campaign.status = Campaign.Status.COMPLETED
            campaign.save()
            reason = "No unused keywords remaining. Campaign marked as COMPLETED."
            log_to_db(campaign_id, "INFO", reason, "pre_flight_check")
            return {"stop_reason": reason}
        logger.info("✅ [PRE-FLIGHT CHECK] Passed.")
        log_to_db(campaign_id, "INFO",
                  "Pre-flight check passed.", "pre_flight_check")
        return {"campaign": campaign, "is_first_run": is_first_run}
    except Campaign.DoesNotExist:
        msg = f"Campaign with ID {campaign_id} not found."
        log_to_db(campaign_id, "ERROR", msg, "pre_flight_check")
        return {"error_message": msg}
    except Exception as e:
        msg = f"Unexpected error in pre_flight_check: {e}"
        log_to_db(campaign_id, "ERROR", msg, "pre_flight_check")
        return {"error_message": msg}


def select_keyword(state: BlogGenerationState) -> dict:
    campaign = state['campaign']
    campaign_id = campaign.id
    logger.info(f"--- 🔑 [SELECT KEYWORD] Campaign ID: {campaign_id} ---")
    log_to_db(campaign_id, "INFO", "Selecting next keyword.", "select_keyword")
    used_keyword_ids = set(Post.objects.filter(
        campaign=campaign).values_list('keyword_id', flat=True))
    next_keyword = campaign.keyword_settings.keywords.exclude(
        id__in=used_keyword_ids).order_by('text').first()
    if not next_keyword:
        return {"stop_reason": "No unused keyword found at selection time."}
    logger.info(f"Selected keyword: '{next_keyword.text}'")
    log_to_db(campaign_id, "INFO",
              f"Selected keyword: '{next_keyword.text}'", "select_keyword")
    return {"selected_keyword_obj": next_keyword}



def format_image_urls_for_prompt(
    cover_image_url: Optional[str],
    content_image_urls: List[str],
    media_type: str = 'image'
) -> str:
    # Helper text used when prompting the LLM about media assets.
    if media_type == 'video':
        lines = ["Video assets have been provided for this campaign."]
        if cover_image_url:
            lines.append(f"- Primary video asset: {cover_image_url}")
        if content_image_urls:
            lines.append("- Additional video URLs to reference:")
            for url in content_image_urls:
                lines.append(f"  - {url}")
        lines.append("Discuss the videos contextually; do not embed <img> tags.")
        return "\n".join(lines)

    if not content_image_urls:
        return "No specific images were provided. Do not invent or include any `<img>` tags in the HTML."
    lines = []
    if content_image_urls:
        lines.append(
            "\n- The following images should be embedded directly into the HTML content using `<img>` tags, distributing them logically throughout the article:")
        for url in content_image_urls:
            lines.append(f"  - {url}")
    return "\n".join(lines)

# ====== ===   Generate content ====== === === #

def generate_content(state: BlogGenerationState) -> dict:
    campaign_id = state['campaign_id']
    logger.info(f"--- ✍️ [GENERATE CONTENT] Campaign ID: {campaign_id} ---")
    log_to_db(campaign_id, "INFO",
              "Preparing to call OpenAI API.", "generate_content")
    try:
        campaign = state['campaign']
        keyword_obj = state['selected_keyword_obj']
        keyword_text = keyword_obj.text
        prompt_settings = campaign.prompt_settings
        content_settings = campaign.content_settings
        tags_config = content_settings.tags or {}
        logger.info(f"Tags configuration from DB: {tags_config}")
        tags_mode = tags_config.get('mode', 'auto')
        tag_instruction = "Generate a list of 5-7 relevant, lowercase tags for the article." # Default

        if tags_mode == 'auto':
            count = tags_config.get('count', 5)
            logger.info(f"Auto tag generation selected with count: {count}")
            tag_instruction = f"Generate a list of exactly {count} relevant, lowercase tags for the article."

        elif tags_mode == 'manual':
            manual_tags = tags_config.get('tags', [])
            if manual_tags:
                # Format the list into a string for the AI's instructions
                formatted_tags = ", ".join(f"'{tag}'" for tag in manual_tags)
                tag_instruction = f"You MUST use the following tags and only these tags, exactly as provided: [{formatted_tags}]."

        logger.info(f"Dynamic Tag Instruction: '{tag_instruction}'")
        class BlogPost(BaseModel):
            title: str = Field(
                description="The catchy, SEO-friendly title of the blog post.")
            meta_description: str = Field(
                description="An SEO-optimized meta description, around 155 characters long.")
            content_html: str = Field(
                description="The full content of the blog post, formatted in clean HTML.")
            tags: List[str] = Field(
                        description=tag_instruction  # <-- This is now dynamic!
                    )
        media_settings = campaign.media_settings
        seo_plugin = content_settings.seo_plugin.lower(
        ) if content_settings.seo_plugin else ""
        seo_rules = ""
        if "yoast" in seo_plugin or "rank math" in seo_plugin:
            seo_rules = """
            --- SEO OPTIMIZATION RULES ({plugin_name}) ---
            1.  **Keyword in Title**: The primary topic keyword MUST be in the 'title'.
            2.  **Keyword in Meta Description**: The primary topic keyword MUST be in the 'meta_description'.
            3.  **Keyword in Introduction**: The primary topic keyword MUST appear within the first 100 words.
            4.  **Keyword in Subheadings**: The primary topic keyword MUST be used in at least one `<h2>` or `<h3>`.
            --- END OF SEO RULES ---
            """.format(plugin_name=seo_plugin.title())
        parser = PydanticOutputParser(pydantic_object=BlogPost)
        cover_image_url = media_settings.cover_images.get(keyword_text)
        content_image_urls = media_settings.content_images.get(
            keyword_text, [])
        image_instructions = format_image_urls_for_prompt(
            cover_image_url,
            content_image_urls,
            media_settings.media_type,
        )
        user_custom_system_prompt = prompt_settings.system_prompt or ""
        system_template_string = """
        You are an expert SEO content writer... You must follow all instructions precisely.
        {user_system_instructions}
        {seo_rules_section}
        CRITICAL FINAL INSTRUCTION: You MUST format your entire response as a single, valid JSON object... {format_instructions}
        """
        system_message_prompt = SystemMessagePromptTemplate.from_template(
            system_template_string,
            partial_variables={
                "user_system_instructions": user_custom_system_prompt,
                "seo_rules_section": seo_rules,
                "format_instructions": parser.get_format_instructions()
            }
        )
        user_instructions_from_db = prompt_settings.user_prompt
        master_user_template_string = """
        Please write a blog post following all instructions...
        --- CRITICAL INSTRUCTION ---
        The 'content_html' field you generate must contain ONLY the body of the article. 
        DO NOT include the main title within the 'content_html' because the title is already handled by a separate 'title' field. The content should begin directly with the first paragraph.
        --- END ---
        --- USER'S DETAILED INSTRUCTIONS ---
        {user_instructions}
        --- END ---
        --- IMAGE REQUIREMENTS ---
        {image_urls}
        --- END ---
        Now, apply all instructions using these details:
        **Primary Topic Keyword:** {keyword}
        **Target Word Count:** {word_count}
        **Required Tone of Voice:** {tone_of_voice}
                """
        human_message_prompt = HumanMessagePromptTemplate.from_template(
            master_user_template_string,
            partial_variables={
                "user_instructions": user_instructions_from_db,
                "image_urls": image_instructions
            }
        )
        chat_prompt = ChatPromptTemplate.from_messages(
            [system_message_prompt, human_message_prompt])
        llm = ChatOpenAI(model="gpt-4-turbo-preview",
                         temperature=content_settings.temperature, openai_api_key=settings.OPENAI_API_KEY)
        chain = chat_prompt | llm | parser

        logger.info(
            "Invoking OpenAI API with keyword-specific image instructions...")
        response_obj = chain.invoke({
            "keyword": keyword_text,
            "word_count": content_settings.word_count,
            "tone_of_voice": content_settings.get_tone_of_voice_display(),
        })

        # Ensure 'generated_meta_description' is in the state and the return dictionary.
        logger.info(
            f"Content with images generated successfully for title: '{response_obj.title}'")
        return {
            "generated_title": response_obj.title,
            "generated_meta_description": response_obj.meta_description,  
            "generated_content_html": response_obj.content_html,
            "generated_tags": response_obj.tags,
            "featured_image_url": cover_image_url
        }
    except Exception as e:
        logger.error(f"Failed to generate content: {e}", exc_info=True)
        return {"error_message": f"OpenAI API or parsing error: {e}"}

def save_post_to_db(state: BlogGenerationState) -> dict:

    campaign_id = state['campaign_id']
    logger.info(f"--- 💾 [SAVE POST] Campaign ID: {campaign_id} ---")
    log_to_db(campaign_id, "INFO",
              "Saving generated post to database.", "save_post_to_db")
    try:
        campaign = state['campaign']
        schedule_settings = campaign.schedule_settings
        
        # ✅ FIXED: Randomness logic - Calculate base interval FIRST
        import random
        
        # Calculate base time interval in minutes for randomness calculation
        frequency_unit = schedule_settings.frequency_unit.lower()
        base_minutes = 0
        
        if frequency_unit == 'minutes':
            base_minutes = schedule_settings.frequency_value
        elif frequency_unit == 'hours':
            base_minutes = schedule_settings.frequency_value * 60
        elif frequency_unit == 'days':
            base_minutes = schedule_settings.frequency_value * 1440  # 24*60
        elif frequency_unit == 'weeks':
            base_minutes = schedule_settings.frequency_value * 10080  # 7*24*60
        elif frequency_unit == 'months':
            base_minutes = schedule_settings.frequency_value * 43200  # 30*24*60 (approx)
        else:
            base_minutes = schedule_settings.frequency_value * 1440  # fallback to days
        
        logger.info(f"🎲 Base interval in minutes: {base_minutes}")
        
        # ✅ FIXED: Apply randomness if enabled
        random_offset_minutes = 0
        if not schedule_settings.randomness_lock and schedule_settings.randomness_percent > 0:
            # Calculate maximum offset based on percentage
            max_offset_minutes = int(base_minutes * (schedule_settings.randomness_percent / 100.0))
            # Apply random offset (± max_offset_minutes)
            random_offset_minutes = random.randint(-max_offset_minutes, max_offset_minutes)
            logger.info(f"🎲 RANDOMNESS APPLIED: {schedule_settings.randomness_percent}% = ±{max_offset_minutes} minutes, offset: {random_offset_minutes} minutes")
        else:
            logger.info(f"🎲 NO RANDOMNESS - Locked: {schedule_settings.randomness_lock}, Percent: {schedule_settings.randomness_percent}%")
        
        # ✅ Get the MOST RECENT post to calculate the NEXT post time
        # This ensures each post builds on the previous one's time
        last_post = Post.objects.filter(
            campaign=campaign, 
            status__in=[Post.Status.SCHEDULED, Post.Status.PUBLISHED]
        ).order_by('-publish_at').first()
        
        if last_post:
            # Use the last post's publish time as base
            base_time = last_post.publish_at
            
            # ✅ FIXED: Use consistent timedelta calculation for base frequency
            if frequency_unit == 'minutes':
                base_time = base_time + timedelta(minutes=schedule_settings.frequency_value)
            elif frequency_unit == 'hours':
                base_time = base_time + timedelta(hours=schedule_settings.frequency_value)
            elif frequency_unit == 'days':
                base_time = base_time + timedelta(days=schedule_settings.frequency_value)
            elif frequency_unit == 'weeks':
                base_time = base_time + timedelta(weeks=schedule_settings.frequency_value)
            elif frequency_unit == 'months':
                from dateutil.relativedelta import relativedelta
                base_time = base_time + relativedelta(months=schedule_settings.frequency_value)
            else:
                base_time = base_time + timedelta(days=schedule_settings.frequency_value)
            
            logger.info(f"🎲 Base time after frequency: {base_time}")
            
            # ✅ FIXED: Apply randomness offset for subsequent posts
            if random_offset_minutes != 0:
                next_publish_time = base_time + timedelta(minutes=random_offset_minutes)
                logger.info(f"🎲 After randomness offset: {next_publish_time}")
            else:
                next_publish_time = base_time
                
        else:
            # This is the first post. We must use the user's timezone.
            start_time_from_db = schedule_settings.start_datetime

            if timezone.is_aware(start_time_from_db):
                # The datetime from the DB is ALREADY aware. No conversion needed.
                base_time = start_time_from_db
                logger.info(f"Using already aware start_datetime from DB: {base_time}")
            else:
                # The datetime from the DB is NAIVE. We must make it aware.
                try:
                    user_timezone = pytz.timezone(schedule_settings.timezone)
                except pytz.UnknownTimeZoneError:
                    logger.warning(f"Unknown timezone '{schedule_settings.timezone}'. Falling back to UTC.")
                    user_timezone = pytz.utc
                
                # This will now only run on naive datetimes, preventing the crash.
                base_time = user_timezone.localize(start_time_from_db)
                logger.info(f"Localized naive start_datetime to: {base_time}")
            
            # Apply randomness offset for first post
            if random_offset_minutes != 0:
                next_publish_time = base_time + timedelta(minutes=random_offset_minutes)
                logger.info(f"🎲 After randomness offset: {next_publish_time}")
            else:
                next_publish_time = base_time
                
        # ✅ ADDED: Final validation - ensure we don't schedule in the past
        now = timezone.now()
        if next_publish_time < now:
            logger.warning(f"🎲 Calculated time {next_publish_time} is in the past. Adjusting to now + 1 minute.")
            next_publish_time = now + timedelta(minutes=1)
                
        if campaign.post_creation_status == Campaign.Status.QUEUED:
            post_status = Post.Status.SCHEDULED
        else:
            post_status = Post.Status.DRAFT
            
        logger.info(f"🎲 FINAL SCHEDULE TIME: {next_publish_time} (Status: {post_status})")
        
        category_list = [cat.strip(
        ) for cat in state['campaign'].content_settings.categories.split(',') if cat.strip()]
        new_post = Post.objects.create(
            campaign=campaign,
            keyword=state['selected_keyword_obj'],
            title=state['generated_title'],
            meta_description=state['generated_meta_description'],
            tags=state['generated_tags'],
            categories=category_list,
            content=state['generated_content_html'],
            status=post_status,
            publish_at=next_publish_time,
            featured_image_url=state.get('featured_image_url')
        )
        logger.info(f"✅ Successfully saved Post ID: {new_post.id} with publish time: {next_publish_time}")
        log_to_db(campaign_id, "INFO",
                  f"Successfully saved Post ID: {new_post.id} with publish time: {next_publish_time}", "save_post_to_db")
        return {"next_publish_at": next_publish_time}
    except Exception as e:
        # Added exc_info=True
        logger.error(f"Failed to save post to database: {e}", exc_info=True)
        log_to_db(campaign_id, "ERROR",
                  f"Database save error: {e}", "save_post_to_db")
        try:
            # We need to get the campaign object again if it wasn't fetched
            campaign_for_refund = state.get('campaign') or Campaign.objects.get(id=campaign_id)
            org_settings = OrganizationSettings.objects.get(organization=campaign_for_refund.organization)
            
            # Use F() expression to prevent race conditions
            org_settings.output_credits_remaining = F('output_credits_remaining') + 1
            org_settings.save()
            
            logger.info(f"REFUNDED 1 credit to Org ID {org_settings.organization.id} due to post-save failure.")
            log_to_db(campaign_id, "INFO", "Refunded 1 output credit due to failure.", "save_post_to_db")
            
        except Exception as refund_error:
            logger.critical(f"FATAL: FAILED TO REFUND CREDIT for Org ID {campaign_for_refund.organization.id}. Error: {refund_error}", exc_info=True)
        return {"error_message": f"Database save error: {e}"}


def handle_failure(state: BlogGenerationState) -> dict:
    # This node is correct and needs no changes.
    logger.warning("--- 💀 HANDLING FAILURE ---")
    campaign_id = state['campaign_id']
    try:
        Post.objects.create(
            campaign_id=campaign_id,
            keyword=state.get('selected_keyword_obj'),
            status=Post.Status.GENERATION_FAILED,
            title=f"Failed: {state.get('selected_keyword_obj').text if state.get('selected_keyword_obj') else 'Unknown Keyword'}",
            error_message=state.get('error_message'),
            publish_at=timezone.now()
        )
        log_to_db(campaign_id, "ERROR",
                  f"Marked keyword '{state.get('selected_keyword_obj').text if state.get('selected_keyword_obj') else 'Unknown'}' as failed.", "handle_failure")
    except Exception as e:
        logger.error(
            f"CRITICAL: Could not even save the failure state! Error: {e}")
    return {}


def update_campaign_status(state: BlogGenerationState) -> dict:
    # This node is correct and needs no changes.
    if state.get("is_first_run"):
        campaign_id = state['campaign_id']
        logger.info(
            f"--- 🚀 [ACTIVATING CAMPAIGN] Campaign ID: {campaign_id} ---")
        try:
            campaign = Campaign.objects.get(id=campaign_id)
            campaign.status = Campaign.Status.ACTIVE
            campaign.save()
            logger.info(f"✅ Campaign '{campaign.name}' is now ACTIVE.")
            log_to_db(campaign_id, "INFO",
                      "First post created. Campaign is now ACTIVE.", "update_campaign_status")
        except Campaign.DoesNotExist:
            msg = f"Could not find campaign {campaign_id} to activate."
            logger.error(msg)
            log_to_db(campaign_id, "ERROR", msg, "update_campaign_status")
    return {}


def should_continue(state: BlogGenerationState) -> str:
    # This node is correct and needs no changes.
    if state.get("error_message"):
        logger.error(
            f"Error occurred: {state['error_message']}. Ending graph.")
        return "end_error"
    if state.get("stop_reason"):
        logger.info(f"Stopping graph: {state['stop_reason']}")
        return "end_stop"
    return "continue"





def generate_content(state: BlogGenerationState) -> dict:
    campaign_id = state['campaign_id']
    logger.info(f"--- ✍️ [GENERATE CONTENT] Campaign ID: {campaign_id} ---")
    log_to_db(campaign_id, "INFO", "Preparing to call OpenAI API.", "generate_content")
    
    try:
        campaign = state['campaign']
        keyword_obj = state['selected_keyword_obj']
        keyword_text = keyword_obj.text
        prompt_settings = campaign.prompt_settings
        content_settings = campaign.content_settings
        
        # --- AI IMAGE GENERATION LOGIC ---
        ai_image_url = None
        if content_settings.ai_image_enabled:
            logger.info(f"🎨 AI Image generation enabled for keyword: '{keyword_text}'")
            log_to_db(campaign_id, "INFO", f"Generating AI image for keyword: {keyword_text}", "generate_content")
            
            # Build AI image prompt
            ai_prompt = content_settings.ai_image_instructions or f"Professional image for article about {keyword_text}"
            
            # Generate AI image
            ai_result = AIImageGenerator.generate_ai_image(
                prompt=ai_prompt,
                style=content_settings.ai_image_style
            )
            
            if ai_result['success']:
                ai_image_url = ai_result['image_url']
                logger.info(f"🎨 AI Image generated successfully: {ai_image_url}")
                log_to_db(campaign_id, "INFO", f"AI image generated: {ai_image_url}", "generate_content")
            else:
                logger.warning(f"🎨 AI Image generation failed: {ai_result['error']}")
                log_to_db(campaign_id, "WARNING", f"AI image generation failed: {ai_result['error']}", "generate_content")
        
        # Continue with existing tags configuration
        tags_config = content_settings.tags or {}
        logger.info(f"Tags configuration from DB: {tags_config}")
        tags_mode = tags_config.get('mode', 'auto')
        tag_instruction = "Generate a list of 5-7 relevant, lowercase tags for the article."

        if tags_mode == 'auto':
            count = tags_config.get('count', 5)
            logger.info(f"Auto tag generation selected with count: {count}")
            tag_instruction = f"Generate a list of exactly {count} relevant, lowercase tags for the article."

        elif tags_mode == 'manual':
            manual_tags = tags_config.get('tags', [])
            if manual_tags:
                formatted_tags = ", ".join(f"'{tag}'" for tag in manual_tags)
                tag_instruction = f"You MUST use the following tags and only these tags, exactly as provided: [{formatted_tags}]."

        logger.info(f"Dynamic Tag Instruction: '{tag_instruction}'")
        
        class BlogPost(BaseModel):
            title: str = Field(
                description="The catchy, SEO-friendly title of the blog post.")
            meta_description: str = Field(
                description="An SEO-optimized meta description, around 155 characters long.")
            content_html: str = Field(
                description="The full content of the blog post, formatted in clean HTML.")
            tags: List[str] = Field(
                        description=tag_instruction
                    )

        media_settings = campaign.media_settings
        seo_plugin = content_settings.seo_plugin.lower() if content_settings.seo_plugin else ""
        seo_rules = ""
        if "yoast" in seo_plugin or "rank math" in seo_plugin:
            seo_rules = """
            --- SEO OPTIMIZATION RULES ({plugin_name}) ---
            1.  **Keyword in Title**: The primary topic keyword MUST be in the 'title'.
            2.  **Keyword in Meta Description**: The primary topic keyword MUST be in the 'meta_description'.
            3.  **Keyword in Introduction**: The primary topic keyword MUST appear within the first 100 words.
            4.  **Keyword in Subheadings**: The primary topic keyword MUST be used in at least one `<h2>` or `<h3>`.
            --- END OF SEO RULES ---
            """.format(plugin_name=seo_plugin.title())
        
        parser = PydanticOutputParser(pydantic_object=BlogPost)
        
        # Use AI image if available, otherwise fall back to media settings
        cover_image_url = ai_image_url or media_settings.cover_images.get(keyword_text)
        content_image_urls = media_settings.content_images.get(keyword_text, [])
        
        image_instructions = format_image_urls_for_prompt(
            cover_image_url,
            content_image_urls,
            media_settings.media_type,
        )
        
        # Add AI image context to instructions if AI image was generated
        if ai_image_url:
            image_instructions += f"\n\n--- AI GENERATED COVER IMAGE ---\nAn AI-generated cover image has been created for this article and will be used as the featured image."
        
        user_custom_system_prompt = prompt_settings.system_prompt or ""
        system_template_string = """
        You are an expert SEO content writer. You must follow all instructions precisely.
        {user_system_instructions}
        {seo_rules_section}
        CRITICAL FINAL INSTRUCTION: You MUST format your entire response as a single, valid JSON object. {format_instructions}
        """
        
        system_message_prompt = SystemMessagePromptTemplate.from_template(
            system_template_string,
            partial_variables={
                "user_system_instructions": user_custom_system_prompt,
                "seo_rules_section": seo_rules,
                "format_instructions": parser.get_format_instructions()
            }
        )

        user_instructions_from_db = prompt_settings.user_prompt
        master_user_template_string = """
        Please write a blog post following all instructions.
        --- CRITICAL INSTRUCTION ---
        The 'content_html' field you generate must contain ONLY the body of the article. 
        DO NOT include the main title within the 'content_html' because the title is already handled by a separate 'title' field. The content should begin directly with the first paragraph.
        --- END ---
        --- USER'S DETAILED INSTRUCTIONS ---
        {user_instructions}
        --- END ---
        --- IMAGE REQUIREMENTS ---
        {image_urls}
        --- END ---
        Now, apply all instructions using these details:
        **Primary Topic Keyword:** {keyword}
        **Target Word Count:** {word_count}
        **Required Tone of Voice:** {tone_of_voice}
        """
        
        human_message_prompt = HumanMessagePromptTemplate.from_template(
            master_user_template_string,
            partial_variables={
                "user_instructions": user_instructions_from_db,
                "image_urls": image_instructions
            }
        )
        
        chat_prompt = ChatPromptTemplate.from_messages(
            [system_message_prompt, human_message_prompt])
        llm = ChatOpenAI(model="gpt-4-turbo-preview",
                         temperature=content_settings.temperature, 
                         openai_api_key=settings.OPENAI_API_KEY)
        chain = chat_prompt | llm | parser

        logger.info("Invoking OpenAI API with keyword-specific image instructions...")
        response_obj = chain.invoke({
            "keyword": keyword_text,
            "word_count": content_settings.word_count,
            "tone_of_voice": content_settings.get_tone_of_voice_display(),
        })

        logger.info(f"Content generated successfully for title: '{response_obj.title}'")
        
        # Return AI image URL if generated
        return {
            "generated_title": response_obj.title,
            "generated_meta_description": response_obj.meta_description,  
            "generated_content_html": response_obj.content_html,
            "generated_tags": response_obj.tags,
            "featured_image_url": cover_image_url  # This will be AI image if generated
        }
        
    except Exception as e:
        logger.error(f"Failed to generate content: {e}", exc_info=True)
        return {"error_message": f"OpenAI API or parsing error: {e}"}
    
# # === 3. WIRE THE GRAPH TOGETHER ===


workflow = StateGraph(BlogGenerationState)

# 1. Add all nodes to the graph
workflow.add_node("pre_flight_check", pre_flight_check)
workflow.add_node("select_keyword", select_keyword)
workflow.add_node("generate_content", generate_content)
workflow.add_node("save_post_to_db", save_post_to_db)
workflow.add_node("update_campaign_status", update_campaign_status)
workflow.add_node("handle_failure", handle_failure)

# 2. Set the entry point for the graph
workflow.set_entry_point("pre_flight_check")

# 3. Define the graph's flow with robust conditional logic

# After the pre-flight check, decide whether to start the main process or stop.
workflow.add_conditional_edges(
    "pre_flight_check",
    should_continue,
    {"continue": "select_keyword", "end_stop": END, "end_error": "handle_failure"}
)


# This prevents the 'KeyError: 'end_stop'' by stopping the graph gracefully if no keywords are left.
workflow.add_conditional_edges(
    "select_keyword",
    should_continue,
    {"continue": "generate_content", "end_stop": END, "end_error": "handle_failure"}
)

# After generating content, check for any API or parsing errors before saving.
workflow.add_conditional_edges(
    "generate_content",
    should_continue,
    {"continue": "save_post_to_db", "end_error": "handle_failure"}
)

# Define a router function to handle the logic after a post is saved.


def after_save_router(state: BlogGenerationState) -> str:
    """Decides where to go after successfully saving a post."""
    if state.get("error_message"):
        return "handle_failure"

    # After saving a post, check if the campaign is now complete.
    try:
        campaign = state['campaign']

        # Re-check the keyword counts against the database
        all_keyword_ids = set(
            campaign.keyword_settings.keywords.values_list('id', flat=True))
        used_keyword_ids = set(Post.objects.filter(
            campaign=campaign).values_list('keyword_id', flat=True))

        if not (all_keyword_ids - used_keyword_ids):
            # If no unused keywords are left, the campaign is finished.
            campaign.status = Campaign.Status.COMPLETED
            campaign.save(update_fields=['status'])
            logger.info(
                f"✅ All keywords used. Campaign '{campaign.name}' marked as COMPLETED.")
            log_to_db(campaign.id, "INFO",
                      "All keywords have been used. Campaign is now COMPLETED.", "after_save_router")
            return "end_completed"  # Return a new state to terminate the graph gracefully
    except Exception as e:
        logger.error(f"Error during completion check: {e}", exc_info=True)
        return "handle_failure"

    # If the campaign is not complete, continue with the original logic.
    if state.get("is_first_run"):
        return "update_campaign_status"
    else:
        return "select_keyword"


# After saving the post, use the router to decide the next step.
workflow.add_conditional_edges(
    "save_post_to_db",
    after_save_router,
    {
        "update_campaign_status": "update_campaign_status",
        "select_keyword": "select_keyword",
        "handle_failure": "handle_failure",
        "end_completed": END
    }
)

# After updating the campaign status on the first run, continue the main loop.
workflow.add_edge("update_campaign_status", "select_keyword")

# Any failure should terminate the graph run.
workflow.add_edge("handle_failure", END)

# 4. Compile the final, robust agent
app = workflow.compile()
logger.info(
    "Blog Generation Agent compiled successfully with full error handling and looping logic.")

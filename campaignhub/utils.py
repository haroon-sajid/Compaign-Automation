# campaignhub/utils.py

import requests
from django.conf import settings
from .models import Post
from django.utils import timezone
import json
import logging
from .wordpress_media import upload_image_to_wordpress_media, download_image_to_temp, upload_featured_image_for_post   

logger = logging.getLogger(__name__)

import os
from urllib.parse import urlparse
import tempfile
from bs4 import BeautifulSoup

#  Define logger for utils.py
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def search_pexels(query, per_page=15):
    """
    Fetches image results from the Pexels API.
    Returns a list of formatted image data on success, or None on failure.
    """
    # Ensure the API key is configured in settings.py
    if not hasattr(settings, 'PEXELS_API_KEY'):
        print("Error: PEXELS_API_KEY not found in Django settings.")
        return None

    url = f"https://api.pexels.com/v1/search?query={query}&per_page={per_page}"
    headers = {"Authorization": settings.PEXELS_API_KEY}

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        # Raise an exception for bad status codes (4xx or 5xx)
        resp.raise_for_status()
        data = resp.json()

        # Format the data for our frontend
        return [
            {
                "id": photo["id"],
                "url": photo["url"],
                # Provide different sizes
                "small_image": photo["src"]["medium"],
                "large_image": photo["src"]["large2x"],
                "photographer": photo["photographer"]
            }
            for photo in data.get("photos", [])
        ]
    except requests.exceptions.RequestException as e:
        # Log the error for debugging
        print(f"Pexels API request failed: {e}")
        return None


def serach_unsplash(query, per_page=15):
    '''
    Fetches image results from the Unsplash API.
    '''
    if not hasattr(settings, 'UNSPLASH_ACCESS_KEY'):
        print("Error: UNSPLASH_ACCESS_KEY not found in Django settings.")
        return None
    try:
        url = "https://api.unsplash.com/search/photos"
        headers = {"Authorization": f"Client-ID {settings.UNSPLASH_ACCESS_KEY}"}
        params = {"query": query}
        response = requests.get(url, headers=headers,
                                params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return [
            {
                "id": photo["id"],
                "url": photo["urls"]["regular"],
                "small_image": photo["urls"]["small"],
                "large_image": photo["urls"]["full"],
                "photographer": photo["user"]["name"]
            }
            for photo in data.get("results", [])
        ]
    except requests.exceptions.RequestException as e:
        print(f"Unsplash API request failed: {e}")
        return None


def serach_pixabay(query, per_page=15):
    '''
    fetch image result from the pixabay API
    '''
    if not hasattr(settings, 'PIXABAY_API_KEY'):
        print("Error: PIXABAY_API_KEY not found in Django settings.")
        return None
    try:
        url = "https://pixabay.com/api/"
        params = {
            "key": f'{settings.PIXABAY_API_KEY}',
            "q": query,
            "image_type": "photo"
        }
        response = requests.get(url,
                                params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return [
            {
                "id": photo["id"],
                "url": photo["pageURL"],
                "small_image": photo["webformatURL"],
                "large_image": photo["largeImageURL"],
                "photographer": photo["user"]
            }
            for photo in data.get("hits", [])
        ]
    except requests.exceptions.RequestException as e:
        print(f"Pixabay API request failed: {e}")
        return None



def create_wp_tag(tag_name, integration):
    """
    Creates a new tag in WordPress and returns its ID.
    """
    try:
        # Validate tag name
        if not tag_name or not tag_name.strip():
            logger.warning("Attempted to create WordPress tag with empty name")
            return None
            
        tag_name = tag_name.strip()
        
        tags_url = f"{integration.api_url.rstrip('/')}/wp-json/wp/v2/tags"
        tag_data = {
            'name': tag_name
        }
        response = requests.post(
            tags_url,
            json=tag_data,
            auth=(integration.username, integration.api_key),
            timeout=20
        )
        response.raise_for_status()
        tag_id = response.json().get('id')
        logger.info(f"✅ WordPress tag created: '{tag_name}' (ID: {tag_id})")
        return tag_id
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to create WordPress tag '{tag_name}': {e}", exc_info=True)
        return None
    except Exception as e:
        logging.error(f"Unexpected error creating WordPress tag '{tag_name}': {e}", exc_info=True)
        return None

def get_wp_tag_ids(post_tags, integration):
    """
    Takes a list of tag names, checks if they exist in WordPress,
    creates them if they don't, and returns a list of their IDs.
    """
    if not isinstance(post_tags, list):
        return []

    try:
        tags_url = f"{integration.api_url.rstrip('/')}/wp-json/wp/v2/tags?per_page=100"
        response = requests.get(
            tags_url,
            auth=(integration.username, integration.api_key),
            timeout=20
        )
        response.raise_for_status()
        existing_tags = {tag['name'].lower(): tag['id'] for tag in response.json()}

        tag_ids = []
        valid_tag_names = [name.strip() for name in post_tags if name and name.strip()]

        for tag_name in valid_tag_names:
            if tag_name.lower() in existing_tags:
                tag_ids.append(existing_tags[tag_name.lower()])
            else:
                new_tag_id = create_wp_tag(tag_name, integration)
                if new_tag_id:
                    tag_ids.append(new_tag_id)
                    existing_tags[tag_name.lower()] = new_tag_id
        return tag_ids
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to communicate with WordPress to get tags: {e}", exc_info=True)
        return []
def create_wp_category(category_name, integration):
    """
    Creates a new category in WordPress and returns its ID.
    """
    try:
        categories_url = f"{integration.api_url.rstrip('/')}/wp-json/wp/v2/categories"
        category_data = {
            'name': category_name
        }
        print("the category name is this ", category_name)
        response = requests.post(
            categories_url,
            json=category_data,
            auth=(integration.username, integration.api_key),
            timeout=20
        )
        response.raise_for_status()
        return response.json().get('id')
    except requests.exceptions.RequestException as e:
        # Log the error or handle it as needed
        return None



def get_wp_category_ids(post_categories, integration):
    """
    Takes a list of category names, checks if they exist in WordPress,
    creates them if they don't, and returns a list of their IDs.
    """
    # Ensure post_categories is a list, as it comes from a JSONField
    if not isinstance(post_categories, list):
        return []

    try:
        # Get all existing categories from WordPress
        categories_url = f"{integration.api_url.rstrip('/')}/wp-json/wp/v2/categories?per_page=100"
        response = requests.get(
            categories_url,
            auth=(integration.username, integration.api_key),
            timeout=20
        )
        response.raise_for_status()
        existing_categories = {cat['name'].lower(): cat['id'] for cat in response.json()}

        category_ids = []
        # Filter out empty or whitespace-only category names before processing
        valid_category_names = []
        for name in post_categories:
            if name and str(name).strip():
                cleaned_name = str(name).strip()
                if cleaned_name:  # Double check it's not empty after stripping
                    valid_category_names.append(cleaned_name)

        for category_name in valid_category_names:
            if category_name.lower() in existing_categories:
                category_ids.append(existing_categories[category_name.lower()])
            else:
                # Create the new category
                new_category_id = create_wp_category(category_name, integration)
                if new_category_id:
                    category_ids.append(new_category_id)
                    # Add the newly created category to our lookup dictionary to avoid re-creating it
                    existing_categories[category_name.lower()] = new_category_id

        return category_ids
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to communicate with WordPress to get categories: {e}", exc_info=True)
        return []
        

def upload_content_images_and_update_html(html_content, integration, post_title):
    """
    Upload all content images to WordPress and replace URLs in HTML
    Returns: (modified_html, error_messages)
    """
    try:
        from bs4 import BeautifulSoup
        import re
        
        soup = BeautifulSoup(html_content, 'html.parser')
        img_tags = soup.find_all('img')
        errors = []
        
        for img in img_tags:
            original_src = img.get('src', '')
            if not original_src:
                continue
                
            # Skip if already a WordPress URL or data URI
            if 'wordpress.com' in original_src or original_src.startswith('data:'):
                continue
                
            # Download and upload the image
            temp_image_path = download_image_to_temp(original_src)
            if not temp_image_path:
                errors.append(f"Failed to download content image: {original_src}")
                continue
            
            # Upload to WordPress
            success, media_id, media_url, error_msg = upload_image_to_wordpress_media(
                integration=integration,
                image_path=temp_image_path,
                title=f"Content image for {post_title}",
                alt_text=img.get('alt', f"Content image for {post_title}")
            )
            
            # Clean up temp file
            try:
                os.unlink(temp_image_path)
            except:
                pass
            
            if success and media_url:
                img['src'] = media_url
                logger.info(f"✅ Content image uploaded and replaced: {original_src} -> {media_url}")
            else:
                errors.append(f"Failed to upload content image {original_src}: {error_msg}")
        
        return str(soup), errors
        
    except Exception as e:
        logger.error(f"Error processing content images: {e}")
        return html_content, [f"Content image processing error: {str(e)}"]

def publish_post_to_wordpress(post, integration):
    """
    Publish a single post to WordPress (including featured image AND content images) in one REST call.
    Returns (bool_success, message_string)
    """
    try:
        # ---- basic sanity check ----
        if not all([integration.api_url, integration.username, integration.api_key]):
            return False, "Incomplete WordPress integration credentials."

        # ---- 1. upload featured image (if any) ----
        featured_media_id = None
        if post.featured_image_url:
            logger.info("Uploading featured image for post '%s'", post.title)
            ok, err = upload_featured_image_for_post(post, integration)
            if ok and post.wordpress_media_id:
                featured_media_id = post.wordpress_media_id
                logger.info("✅ Featured image uploaded, media ID: %s", featured_media_id)
            else:
                logger.warning("⚠️ Featured image not attached: %s", err or "unknown error")

        # ---- 2. upload content images and update HTML ----
        modified_content, content_image_errors = upload_content_images_and_update_html(
            post.content, integration, post.title
        )
        
        for error in content_image_errors:
            logger.warning("Content image issue: %s", error)

        # ---- 3. categories & tags ----
        wp_category_ids = get_wp_category_ids(post.categories, integration)
        if not wp_category_ids and post.categories:
            logger.warning("No WordPress category IDs found for post categories: %s", post.categories)

        wp_tag_ids = get_wp_tag_ids(post.tags, integration)
        if not wp_tag_ids and post.tags:
            logger.warning("No WordPress tag IDs found for post tags: %s", post.tags)

        # ---- 4. build payload ----
        wp_data = {
            "title": post.title,
            "content": modified_content,  # Use the modified content with WordPress image URLs
            "status": "publish",
            "meta": {"_yoast_wpseo_metadesc": post.meta_description},
            "featured_media": featured_media_id,
        }
        
        logger.info(f"Prepared WordPress post data: {wp_data}")
        
        if wp_category_ids:
            wp_data["categories"] = wp_category_ids
        if wp_tag_ids:
            wp_data["tags"] = wp_tag_ids
            
        logger.info(f"Submitting final payload to WordPress: {wp_data}")

        # ---- 5. create post ----
        url = f"{integration.api_url.rstrip('/')}/wp-json/wp/v2/posts"
        resp = requests.post(
            url,
            json=wp_data,
            auth=(integration.username, integration.api_key),
            timeout=30,
        )
        resp.raise_for_status()

        # ---- 6. success bookkeeping ----
        data = resp.json()
        post.status = Post.Status.PUBLISHED
        post.published_url = data.get("link")
        post.integration_target = integration
        post.publish_at = timezone.now()
        post.save()

        logger.info("✅ Post '%s' published with featured_media=%s and content images processed", 
                   post.title, featured_media_id or "None")
        return True, f"'{post.title}' published successfully."

    # ---- error handling ----
    except requests.exceptions.Timeout:
        return False, f"Request timed out while publishing '{post.title}'."
    except json.JSONDecodeError:
        return False, f"Invalid JSON response from WordPress for '{post.title}'."
    except requests.exceptions.RequestException as e:
        code = e.response.status_code if e.response else 0
        msg = f"WordPress API error {code}"
        if e.response is not None:
            try:
                msg = f"WordPress API error {code}: {e.response.json().get('message', e.response.text)}"
            except Exception:
                msg = f"WordPress API error {code}: {e.response.text}"
        return False, f"Failed to publish '{post.title}': {msg}"
    except Exception as e:
        logger.exception("Unexpected error while publishing '%s'", post.title)
        return False, f"Unexpected error for '{post.title}': {e}"


def process_tags_payload(payload: dict) -> dict:
    """
    Cleans and standardizes the tags payload from the frontend into a
    consistent format that the agent can easily understand.
    """
    if not isinstance(payload, dict):
        # If the payload is invalid, default to auto-generating 5 tags.
        return {'mode': 'auto', 'count': 5}

    mode = payload.get('mode')

    if mode == 'auto':
        try:
            # For 'auto' mode, we only care about the count.
            count = int(payload.get('count', 5))
            return {'mode': 'auto', 'count': max(1, count)}
        except (ValueError, TypeError):
            return {'mode': 'auto', 'count': 5} # Fallback on error

    elif mode == 'manual':
        # For 'manual' mode, we combine all provided tags into one clean list.
        tags = set() # Use a set to automatically handle duplicates

        # Combine tags from 'global', 'manual', and 'include' fields
        for key in ['global', 'manual']:
            tag_list = payload.get(key, [])
            if isinstance(tag_list, list):
                tags.update(tag.strip() for tag in tag_list if tag.strip())

        include_tag = payload.get('include', '')
        if isinstance(include_tag, str) and include_tag.strip():
            tags.add(include_tag.strip())

        # Return the processed manual structure with a sorted list of tags.
        return {'mode': 'manual', 'tags': sorted(list(tags))}

    # If the mode is unknown, default to auto.
    return {'mode': 'auto', 'count': 5}
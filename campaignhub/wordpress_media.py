# campaignhub/wordpress_media.py - CREATE NEW FILE
import requests
import base64
import mimetypes
from urllib.parse import urlparse
import logging
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
import tempfile
import os

logger = logging.getLogger(__name__)


def download_image_to_temp(image_url):
    """
    Download image from URL to a temporary file
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(image_url, timeout=30, headers=headers)
        response.raise_for_status()
        
        # Get file extension from URL or Content-Type
        parsed_url = urlparse(image_url)
        file_extension = os.path.splitext(parsed_url.path)[1] if os.path.splitext(parsed_url.path)[1] else '.jpg'
        
        if not file_extension or file_extension == '.':
            content_type = response.headers.get('content-type', '')
            if 'jpeg' in content_type or 'jpg' in content_type:
                file_extension = '.jpg'
            elif 'png' in content_type:
                file_extension = '.png'
            elif 'gif' in content_type:
                file_extension = '.gif'
            else:
                file_extension = '.jpg'  # default
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension)
        temp_file.write(response.content)
        temp_file.flush()
        
        return temp_file.name
    except Exception as e:
        logger.error(f"Failed to download image from {image_url}: {e}")
        return None


def upload_image_to_wordpress_media(integration, image_path, title=None, alt_text=""):
    """
    Upload image to WordPress media library using integration credentials
    
    Args:
        integration: Integration model instance with WordPress credentials
        image_path: Path to local image file
        title: Image title (defaults to filename)
        alt_text: Alt text for the image
    
    Returns:
        tuple: (success(bool), wordpress_media_id(int|None), wordpress_url(str|None), error_message(str))
    """
    try:
        if not all([integration.api_url, integration.username, integration.api_key]):
            return False, None, None, "Incomplete WordPress integration credentials"
        
        if not os.path.exists(image_path):
            return False, None, None, f"Image file not found: {image_path}"
        
        # Set default title
        if title is None:
            title = os.path.basename(image_path)
        
        # Read the image file
        with open(image_path, 'rb') as image_file:
            image_data = image_file.read()
        
        # Get filename and MIME type
        filename = os.path.basename(image_path)
        mime_type, _ = mimetypes.guess_type(image_path)
        if not mime_type:
            mime_type = 'image/jpeg'  # fallback
        
        # Prepare API endpoint and headers
        url = f"{integration.api_url.rstrip('/')}/wp-json/wp/v2/media"
        
        credentials = f"{integration.username}:{integration.api_key}"
        token = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            'Authorization': f'Basic {token}',
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Type': mime_type
        }
        
        logger.info(f"Uploading image '{title}' to WordPress...")
        response = requests.post(url, headers=headers, data=image_data, timeout=30)
        
        if response.status_code in [200, 201]:
            data = response.json()
            logger.info(f"✅ Image upload successful! WordPress Media ID: {data['id']}")
            return True, data['id'], data.get('source_url', ''), None
        else:
            error_msg = f"WordPress API error: {response.status_code}"
            try:
                error_data = response.json()
                if 'message' in error_data:
                    error_msg += f" - {error_data['message']}"
            except:
                error_msg += f" - {response.text}"
            
            logger.error(f"❌ Image upload failed: {error_msg}")
            return False, None, None, error_msg
            
    except requests.exceptions.Timeout:
        error_msg = "WordPress API timeout - request took too long"
        logger.error(f"❌ {error_msg}")
        return False, None, None, error_msg
    except requests.exceptions.ConnectionError:
        error_msg = f"Connection error - cannot reach WordPress site at {integration.api_url}"
        logger.error(f"❌ {error_msg}")
        return False, None, None, error_msg
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(f"❌ {error_msg}")
        return False, None, None, error_msg

def upload_featured_image_for_post(post, integration):
    """
    Main function to handle featured image upload for a post
    """
    if not post.featured_image_url:
        logger.info(f"No featured image for post '{post.title}', skipping image upload")
        return True, None  # No image to upload, but not an error
    
    try:
        # Download the image to temporary file
        temp_image_path = download_image_to_temp(post.featured_image_url)
        if not temp_image_path:
            return False, "Failed to download image from URL"
        
        # Upload to WordPress
        success, media_id, media_url, error_msg = upload_image_to_wordpress_media(
            integration=integration,
            image_path=temp_image_path,
            title=post.title,
            alt_text=post.title
        )
        
        # Clean up temporary file
        try:
            os.unlink(temp_image_path)
        except:
            pass
        
        if success:
            # Update post with WordPress media info
            post.wordpress_media_id = media_id
            post.wordpress_image_url = media_url
            post.save(update_fields=['wordpress_media_id', 'wordpress_image_url'])
            return True, None
        else:
            return False, error_msg
            
    except Exception as e:
        logger.error(f"Error in upload_featured_image_for_post: {e}")
        return False, str(e)




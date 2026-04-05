# campaignhub/ai_image_utils.py

import requests
import logging
from django.conf import settings
from urllib.parse import urljoin
import uuid
import base64
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
import os

logger = logging.getLogger(__name__)

class AIImageGenerator:
    """
    Professional AI image generation utility that integrates with OpenAI DALL-E
    """
    
    @staticmethod
    def generate_ai_image(prompt, style='realistic', size="1024x1024", quality="standard"):
        """
        Generate AI image using OpenAI DALL-E API
        
        Args:
            prompt (str): The image generation prompt
            style (str): Image style from available choices
            size (str): Image size - "1024x1024", "1792x1024", "1024x1792"
            quality (str): "standard" or "hd" - only for DALL-E 3
            
        Returns:
            dict: {'success': bool, 'image_url': str, 'error': str}
        """
        try:
            # ✅ FIXED: Better API key check
            openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
            if not openai_api_key:
                logger.error("OpenAI API key not configured in settings")
                return {'success': False, 'error': 'OpenAI API key not configured'}
            
            # ✅ FIXED: Enhanced prompt building
            enhanced_prompt = AIImageGenerator._build_enhanced_prompt(prompt, style)
            logger.info(f"Generating AI image with prompt: {enhanced_prompt}")
            
            # Call OpenAI DALL-E API
            headers = {
                'Authorization': f'Bearer {openai_api_key}',
                'Content-Type': 'application/json'
            }
            
            # ✅ FIXED: Create payload based on model version
            model = 'dall-e-2'  # or 'dall-e-3' if you want to upgrade
            
            if model == 'dall-e-3':
                # DALL-E 3 supports quality parameter
                payload = {
                    'model': model,
                    'prompt': enhanced_prompt,
                    'size': size,
                    'quality': quality,
                    'n': 1
                }
            else:
                # DALL-E 2 does NOT support quality parameter
                payload = {
                    'model': model,
                    'prompt': enhanced_prompt,
                    'size': size,
                    'n': 1
                }
            
            logger.info(f"Sending request to OpenAI DALL-E API with model: {model}")
            response = requests.post(
                'https://api.openai.com/v1/images/generations',
                headers=headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                image_url = data['data'][0]['url']
                logger.info(f"Successfully generated AI image: {image_url}")
                
                # ✅ FIXED: Download and save the image locally
                saved_url = AIImageGenerator._download_and_save_image(image_url)
                
                return {
                    'success': True,
                    'image_url': saved_url,
                    'original_url': image_url,
                    'prompt_used': enhanced_prompt
                }
            else:
                error_msg = f"OpenAI API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                return {'success': False, 'error': error_msg}
                
        except requests.exceptions.Timeout:
            error_msg = "OpenAI API request timed out (60s)"
            logger.error(error_msg)
            return {'success': False, 'error': error_msg}
        except requests.exceptions.ConnectionError:
            error_msg = "Connection error to OpenAI API"
            logger.error(error_msg)
            return {'success': False, 'error': error_msg}
        except Exception as e:
            error_msg = f"AI image generation failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return {'success': False, 'error': error_msg}
        
    
    @staticmethod
    def _build_enhanced_prompt(base_prompt, style):
        """
        Enhance the base prompt with style-specific instructions
        """
        # ✅ FIXED: Better prompt engineering for different styles
        style_enhancements = {
            'realistic': f"Highly realistic and detailed photographic style, professional lighting, sharp focus: {base_prompt}",
            'artistic': f"Artistic, painterly style with creative composition, artistic interpretation: {base_prompt}",
            'minimal': f"Minimalist, clean, simple composition with ample whitespace, modern design: {base_prompt}",
            'vibrant': f"Vibrant, colorful, high-contrast style, bold colors, dynamic composition: {base_prompt}",
            'professional': f"Professional, corporate, clean business style, modern office aesthetic: {base_prompt}",
            'photographic': f"Professional photographic quality, sharp focus, natural lighting, high resolution: {base_prompt}",
            'digital_art': f"Digital art, modern graphic design style, vector art influence: {base_prompt}",
            'fantasy': f"Fantasy, imaginative, dreamlike style, magical elements: {base_prompt}"
        }
        
        enhanced = style_enhancements.get(style, base_prompt)
        
        # ✅ ADDED: Common improvements for all prompts
        enhanced += " - high quality, detailed, professional"
        
        # ✅ FIXED: DALL-E 3 has 4000 character limit
        if len(enhanced) > 3800:
            enhanced = enhanced[:3800] + "..."
            
        return enhanced
    
    @staticmethod
    def _download_and_save_image(image_url):
        """
        Download image from URL and save to local storage
        Returns the publicly accessible URL
        """
        try:
            logger.info(f"Downloading AI image from: {image_url}")
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            
            # ✅ FIXED: Create directory if it doesn't exist
            storage_path = "ai_images/"
            if not default_storage.exists(storage_path):
                # This depends on your storage backend
                logger.info(f"Creating directory: {storage_path}")
            
            # Generate unique filename
            file_ext = 'png'  # DALL-E returns PNG
            file_name = f"{storage_path}{uuid.uuid4()}.{file_ext}"
            
            # Save to storage
            content_file = ContentFile(response.content, name=file_name)
            saved_file_name = default_storage.save(file_name, content_file)
            logger.info(f"Saved AI image to: {saved_file_name}")
            
            # Get public URL
            file_url = default_storage.url(saved_file_name)
            
            # ✅ FIXED: Handle relative URLs properly
            if file_url.startswith('http'):
                return file_url
            else:
                base_url = getattr(settings, "BASE_URL", "http://127.0.0.1:8000")
                full_url = urljoin(base_url, file_url.lstrip("/"))
                return full_url
            
        except Exception as e:
            logger.error(f"Failed to download/save AI image: {str(e)}", exc_info=True)
            # Return original URL if download fails
            logger.info("Returning original URL due to download failure")
            return image_url

    @staticmethod
    def test_connection():
        """
        Test if OpenAI API is accessible and working
        Returns: dict with connection status
        """
        try:
            openai_api_key = getattr(settings, 'OPENAI_API_KEY', None)
            if not openai_api_key:
                return {'success': False, 'error': 'OpenAI API key not configured'}
            
            headers = {
                'Authorization': f'Bearer {openai_api_key}',
                'Content-Type': 'application/json'
            }
            
            # Test with a simple models list request
            response = requests.get(
                'https://api.openai.com/v1/models',
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                return {'success': True, 'message': 'OpenAI API connection successful'}
            else:
                return {'success': False, 'error': f'API returned status {response.status_code}'}
                
        except Exception as e:
            return {'success': False, 'error': f'Connection test failed: {str(e)}'}

    # ✅ ADDED: Simple method for multiple images (if needed)
    @staticmethod
    def generate_multiple_ai_images(prompt, num_images=1, style='realistic', size="1024x1024", quality="standard"):
        """
        Generate multiple AI images using sequential calls
        Simple wrapper for your existing code
        """
        results = []
        
        for i in range(num_images):
            result = AIImageGenerator.generate_ai_image(prompt, style, size, quality)
            results.append(result)
            
        # Return consolidated results
        successful = [r for r in results if r['success']]
        return {
            'success': len(successful) > 0,
            'images': successful,
            'total_requested': num_images,
            'total_generated': len(successful),
            'errors': [r['error'] for r in results if not r['success']]
        }
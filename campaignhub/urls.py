# campaignhub/urls.py

from django.urls import path
from .views import CampaignListView, CampaignCreateView, SavePromptTemplateView, UpdatePromptTemplateView, ListPromptTemplatesView, DeletePromptTemplateView, PexelsSearchView, CampaignDeleteView, \
    PostListView, SendPostToWordPressView, PostStatusUpdateView, UNSPLASHSearchView, PixabaySearchView, ApproveCampaignView, SocialCampaignView, ListBlogPostsView, \
    PostBulkActionView, PostDeleteView, AnalyticsView, AnalyticsDataView, WordPressCategoriesView, AutoMatchImagesView, AIImageSearchView

app_name = 'campaignhub'

urlpatterns = [
    path('', CampaignListView.as_view(), name='campaign_list'),
    path('create/', CampaignCreateView.as_view(), name='create_campaign'),
    path('delete/<uuid:pk>/', CampaignDeleteView.as_view(), name='delete_campaign'),
    path('prompts/save/', SavePromptTemplateView.as_view(),
         name='save_prompt_template'),
    path('prompts/update/<uuid:pk>/', UpdatePromptTemplateView.as_view(),
         name='update_prompt_template'),
    path('prompts/list/', ListPromptTemplatesView.as_view(),
         name='list_prompt_templates'),
    path('prompts/delete/<uuid:pk>/', DeletePromptTemplateView.as_view(),
         name='delete_prompt_template'),
    path('api/media/search/pexels/',
         PexelsSearchView.as_view(), name='api_pexels_search'),
    path('api/media/search/unsplash/',
         UNSPLASHSearchView.as_view(), name='api_unsplash_search'),
    path('api/media/search/pixabay/',
         PixabaySearchView.as_view(), name='api_pixabay_search'),
    path('api/images/ai/', AIImageSearchView.as_view(), name='api_ai_image_search'),  # This should be correct
    path('posts/', PostListView.as_view(), name='post_list'),
    path('posts/<int:pk>/send-to-wordpress/',
         SendPostToWordPressView.as_view(),
         name='send_post_to_wordpress'),
    path('api/posts/<int:pk>/status/',
         PostStatusUpdateView.as_view(),
         name='api_post_status_update'),
    path('approve/<uuid:pk>/', ApproveCampaignView.as_view(),
         name='approve_campaign'),
    path('create/social/', SocialCampaignView.as_view(),
         name='create_social_campaign'),
    path('api/list-blog-posts/', ListBlogPostsView.as_view(), name='list_blog_posts'),
    path('api/posts/bulk-action/', PostBulkActionView.as_view(),
         name='api_post_bulk_action'),
    path('api/posts/<int:pk>/delete/',
         PostDeleteView.as_view(), name='api_post_delete'),
    path('analytics/', AnalyticsView.as_view(), name='analytics'),
    path('api/analytics-data/', AnalyticsDataView.as_view(),
         name='api_analytics_data'),
    path('api/wordpress/categories/', WordPressCategoriesView.as_view(), name='api_wordpress_categories'),
    path('api/media/auto-match/', AutoMatchImagesView.as_view(), name='api_auto_match_images'),
#     path('upload-media/', upload_media, name='upload_media'),
    
]

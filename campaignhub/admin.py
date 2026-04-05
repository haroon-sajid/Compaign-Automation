# In campaignhub/admin.py

from django.contrib import admin
from django.contrib import messages
from .tasks import generate_blog_post_for_campaign
# In campaignhub/admin.py
from .models import Campaign, Post, Keyword, PromptTemplate, CampaignLog, MediaSettings, ContentSettings, ScheduleSettings


class CampaignLogInline(admin.TabularInline):
    model = CampaignLog
    extra = 0  # Don't show any empty forms for adding new logs
    fields = ('created_at', 'level', 'node_name', 'message')
    readonly_fields = ('created_at', 'level', 'node_name', 'message')
    can_delete = False  # You shouldn't be able to delete logs from the admin

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'status',
                    'campaign_type', 'created_at')
    list_filter = ('status', 'campaign_type', 'organization')
    search_fields = ('name',)
    inlines = [CampaignLogInline]  # This is the magic line!
    actions = ['manually_trigger_run', 'mark_as_active', 'mark_as_archived']

    @admin.action(description="Manually generate next post for selected campaigns")
    def manually_trigger_run(self, request, queryset):
        triggered_count = 0
        for campaign in queryset:
            if campaign.status == Campaign.Status.ACTIVE:
                generate_blog_post_for_campaign.delay(str(campaign.id))
                triggered_count += 1

        self.message_user(request,
                          f'{triggered_count} campaign(s) were successfully queued for a manual run.',
                          messages.SUCCESS)

    @admin.action(description="Mark selected campaigns as ACTIVE")
    def mark_as_active(self, request, queryset):
        updated_count = queryset.update(status=Campaign.Status.ACTIVE)
        self.message_user(request,
                          f'{updated_count} campaign(s) were successfully marked as Active.',
                          messages.SUCCESS)

    @admin.action(description="Mark selected campaigns as ARCHIVED")
    def mark_as_archived(self, request, queryset):
        updated_count = queryset.update(status=Campaign.Status.ARCHIVED)
        self.message_user(request,
                          f'{updated_count} campaign(s) were successfully Archived.',
                          messages.SUCCESS)


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'title', 'campaign', 'status',
        'publish_at', 'published_url',
        'display_categories', 'display_tags', 'featured_image_url', "wordpress_image_url", "wordpress_media_id"
    )
    list_filter = ('status', 'campaign')
    actions = ['re_queue_failed_posts']

    def display_categories(self, obj):
        if not obj.categories:
            return "-"
        return ", ".join(map(str, obj.categories))
    display_categories.short_description = "Categories"

    def display_tags(self, obj):
        if not obj.tags:
            return "-"
        return ", ".join(map(str, obj.tags))
    display_tags.short_description = "Tags"

    @admin.action(description="Re-queue selected FAILED posts for generation")
    def re_queue_failed_posts(self, request, queryset):
        failed_posts = queryset.filter(status=Post.Status.FAILED)
        campaigns_to_trigger = set()

        for post in failed_posts:
            campaigns_to_trigger.add(post.campaign_id)
            post.delete()

        for campaign_id in campaigns_to_trigger:
            generate_blog_post_for_campaign.delay(str(campaign_id))

        self.message_user(
            request,
            f"Deleted {len(failed_posts)} failed posts and re-queued their campaigns.",
            messages.SUCCESS
        )


class KeywordCampaignFilter(admin.SimpleListFilter):
    title = 'Campaign'
    parameter_name = 'campaign'

    def lookups(self, request, model_admin):
        # Returns a list of tuples (id, name) for the filter dropdown
        campaigns = Campaign.objects.all().order_by('name')
        return [(c.id, c.name) for c in campaigns]

    def queryset(self, request, queryset):
        # Filters the Keyword queryset based on the selected campaign
        if self.value():
            # We traverse: Keyword -> (reverse M2M) KeywordSettings -> Campaign
            # Note: 'keywordsettings' is the lowercase model name used for the reverse relationship
            return queryset.filter(keywordsettings__campaign__id=self.value())
        return queryset

@admin.register(Keyword)
class KeywordAdmin(admin.ModelAdmin):
    list_display = ('text', 'organization')
    # Add the custom filter class here
    list_filter = ('organization', KeywordCampaignFilter) 
    search_fields = ('text',)

@admin.register(PromptTemplate)
class PromptTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'campaign_type', 'created_at')
    list_filter = ('organization', 'campaign_type')
    search_fields = ('name', 'system_prompt', 'user_prompt')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        (None, {
            'fields': ('name', 'organization', 'campaign_type', 'system_prompt', 'user_prompt')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)  # Makes this section collapsible
        }),
    )

    def has_add_permission(self, request):
        # Disable adding new prompt templates directly from the admin
        return False


@admin.register(CampaignLog)
class CampaignLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'level', 'node_name', 'message')
    list_filter = ('level', 'node_name')
    search_fields = ('message',)
    readonly_fields = ('created_at', 'level', 'node_name', 'message')
    fieldsets = (
        (None, {
            'fields': ('created_at', 'level', 'node_name', 'message')
        }),
    )

    def has_add_permission(self, request):
        # Disable adding new logs directly from the admin
        return False


@admin.register(MediaSettings)
class MediaSettingsAdmin(admin.ModelAdmin):
    list_display = ('campaign', 'media_type', 'cover_images', 'content_images')
    search_fields = ('campaign__name',)
    readonly_fields = ('cover_images', 'content_images')

    def has_add_permission(self, request):
        # Disable adding new media settings directly from the admin
        return False


@admin.register(ContentSettings)
class ContentSettingsAdmin(admin.ModelAdmin):
    list_display = ('id', 'campaign', 'tone_of_voice', 'word_count', 'display_categories')
    search_fields = ('campaign__name', 'categories')
    readonly_fields = ('tone_of_voice', 'word_count', 'categories')

    def display_categories(self, obj):
        if not obj.categories:
            return "-"
        # Clean up and show categories nicely
        cats = [c.strip() for c in obj.categories.split(',') if c.strip()]
        return ", ".join(cats)
    display_categories.short_description = "Categories"

    def has_add_permission(self, request):
        # Disable adding new content settings directly from the admin
        return False


@admin.register(ScheduleSettings)
class ScheduleSettingsAdmin(admin.ModelAdmin):
    list_display = ('campaign', 'start_datetime', 'frequency_unit', 'frequency_value', 'end_condition_type')
    search_fields = ('campaign__name',)
from django.apps import AppConfig


class CampaignhubConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "campaignhub"

    def ready(self):
        # This line is crucial. It imports your signals module,
        # which makes the receiver function available.
        import campaignhub.signals

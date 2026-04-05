# campaign/celery.py

import os
from celery import Celery

# Set the default Django settings module for the 'celery' program.
# IMPORTANT: Change 'campaign' to the actual name of your project folder.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'campaign.settings')

# Create the Celery application instance.
# The first argument is the name of the current module.
app = Celery('campaign')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix in settings.py.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
# Celery will automatically look for a 'tasks.py' file in each app.
app.autodiscover_tasks()

# Example of a debug task to test if Celery is working


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')


from django.db import models

# Create your models here.
class Subscription(models.Model):
    email = models.EmailField(unique=True) # Ensures no duplicate emails
    subscribed_at = models.DateTimeField(auto_now_add=True) # Automatically records the date

    def __str__(self):
        return self.email
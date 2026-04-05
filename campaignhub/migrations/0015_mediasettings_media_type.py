from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('campaignhub', '0014_schedulesettings_randomness_lock_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='mediasettings',
            name='media_type',
            field=models.CharField(
                choices=[('image', 'image'), ('video', 'video')],
                default='image',
                max_length=10,
            ),
        ),
    ]


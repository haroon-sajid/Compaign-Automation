
from celery.schedules import crontab
from pathlib import Path
import environ
from dotenv import load_dotenv
import os
load_dotenv()

# Initialise environment variables

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialise environment variables

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = "django-insecure-6ln)2a(5hg^v(z#q1&cv%x*galz=o()$-h_=)#-6tobx$x7zlm"

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['*']
CSRF_TRUSTED_ORIGINS = ['http://127.0.0.1:8000',
                        'https://publisha.io',
                        'https://www.publisha.io']

# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "public",
    "accounts",
    "dashboard",
    "profilesettings",
    "billing",
    'organizations',
    'crispy_forms',
    'crispy_bootstrap5',
    'integrations',
    'campaignhub',
    'csp',
    'django_celery_beat',
    'django.contrib.sites',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
]

SITE_ID = 1

CRISPY_ALLOWED_TEMPLATE_PACKS = "bootstrap5"
CRISPY_TEMPLATE_PACK = "bootstrap5"

AUTHENTICATION_BACKENDS = [
    'accounts.backends.EmailBackend',
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # "campaign.middleware.ContentSecurityPolicyMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "accounts.middleware.CustomCsrfMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    'accounts.middleware.ActiveOrganizationMiddleware',
    # 'csp.middleware.CSPMiddleware',
]
# CSP_STYLE_SRC = ("'self'", "https://fonts.googleapis.com")

ROOT_URLCONF = "campaign.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        'DIRS': [BASE_DIR / 'templates'],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                'accounts.context_processors.active_organization',
            ],
        },
    },
]

WSGI_APPLICATION = "campaign.wsgi.application"


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

# DATABASES = {
#     "default": {
#         "ENGINE": "django.db.backends.sqlite3",
#         "NAME": BASE_DIR / "db.sqlite3",
#     }
# }
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'campaign_db',
        'USER': 'campaign_user',
        'PASSWORD': 'campaign_pass',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

SOCIALACCOUNT_PROVIDERS = {
    'google': {
        # This app configuration will be used instead of creating a SocialApp in the admin
        'APP': {
            'client_id': os.getenv('GOOGLE_CLIENT_ID'),
            'secret': os.getenv('GOOGLE_CLIENT_SECRET'),
            'key': ''  # Leave key empty
        },
        # The scope of data you are requesting from Google
        'SCOPE': [
            'profile',
            'email',
        ],
        # Authentication parameters
        'AUTH_PARAMS': {
            'access_type': 'online',
            'prompt': 'select_account',
        }
    }
}
# Or 'mandatory' if you want to verify emails
ACCOUNT_EMAIL_VERIFICATION = 'none'
SOCIALACCOUNT_LOGIN_ON_GET = True  # Skips the intermediate "are you sure?" page

# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

# STATIC_URL = "static/"

# STATICFILES_DIRS = [
#     BASE_DIR / 'static',
# ]


LOGOUT_REDIRECT_URL = 'home'
LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'dashboard:login_redirect'
# LOGIN_REDIRECT_URL = '/dashboard/'
# LOGOUT_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = 'public:home'
SOCIALACCOUNT_AUTO_SIGNUP = True

# You can also add this to attempt to generate a username automatically
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_AUTHENTICATION_METHOD = 'email'
# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

# DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
# EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
# EMAIL_HOST = os.getenv('EMAIL_HOST')
# EMAIL_PORT = os.getenv('EMAIL_PORT')
# EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
# EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
# EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS')
# DEFAULT_FROM_EMAIL = EMAIL_HOST_USER
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')
EMAIL_HOST_USER = os.getenv('DEFAULT_FROM_EMAIL')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL')


DATA_UPLOAD_MAX_MEMORY_SIZE = 52428800  # 50 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 104857600  # 100 MB


STRIPE_PUBLISHABLE_KEY = os.getenv('STRIPE_PUBLISHABLE_KEY')
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET')

AUTH_USER_MODEL = 'accounts.CustomUser'
# FERNET_KEYS = ['Ne4X04Y-TP0vpMNhCN6IzRQU0XFRec9SQ9tuuQ_ayPM=']
FIELD_ENCRYPTION_KEY = "lBdR_7ZLoli_sWEsxwaIVGO9knFjzTT9uN9TCJlE3ho="

PEXELS_API_KEY = os.getenv('pexels')
UNSPLASH_ACCESS_KEY = os.getenv('UNSPLASH_ACCESS_KEY')
PIXABAY_API_KEY = os.getenv('PIXABAY_API_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

X_CLIENT_ID = 'T3dLRkJTQnc0bmdUZkt5TWNiTDI6MTpjaQ'
X_CLIENT_SECRET = '_yRF9gRrUKFkiYIhxUcazwuOzCf4CS6tPzrNNV67AIwfHrHrHS'

# CSP_STYLE_SRC = (
#     "'self'",
#     "'unsafe-inline'",
#     "https://fonts.googleapis.com",
#     "https://cdn.jsdelivr.net",
#     "https://cdn.datatables.net",
#     "https://cdnjs.cloudflare.com",  # <-- Add this for select2.min.css
#     "https://cdnjs.cloudflare.com",
#     "https://cdn.jsdelivr.net",
# )

# CSP_SCRIPT_SRC = (
#     "'self'",
#     "'unsafe-inline'",
#     "https://js.stripe.com",
#     "https://m.stripe.network",
#     "https://cdn.jsdelivr.net",
#     "https://code.jquery.com",
#     "https://cdnjs.cloudflare.com",
#     "https://cdn.datatables.net"  # <-- Add this for dataTables.min.js
# )

CONTENT_SECURITY_POLICY = {
    'DIRECTIVES': {
        'default-src': ("'self'",),
        'connect-src': (
            "'self'",
            'https://api.stripe.com',
            'https://cdn.jsdelivr.net'
        ),
        'font-src': (
            "'self'",
            'https://fonts.gstatic.com'
        ),
        'script-src': (
            "'self'",
            "'unsafe-inline'",
            'https://js.stripe.com',
            'https://m.stripe.network',
            'https://cdn.jsdelivr.net',
            'https://code.jquery.com',
            'https://cdnjs.cloudflare.com',
            'https://cdn.datatables.net'
        ),
        'style-src': (
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
            'https://cdn.jsdelivr.net',
            'https://cdn.datatables.net',
            'https://cdnjs.cloudflare.com'
        )
    }
}
STATIC_URL = '/static/'

# This is where Django will collect all static files for production
STATIC_ROOT = BASE_DIR / 'staticfiles'

# This is the source folder where your app's static files live
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


# =============================================================================
# CELERY SETTINGS
# =============================================================================
# This configuration tells Celery to use Redis as its message broker and result backend.
# The message broker is the "to-do list" where tasks are queued.
# The result backend is where Celery stores the status and results of completed tasks.

# The default Redis URL. Redis runs on port 6379 by default.
# The '0' at the end specifies database number 0 inside Redis.
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'

# These settings ensure tasks are handled in a predictable way.
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# This setting tells Celery to store task results for one hour (3600 seconds).
CELERY_RESULT_EXPIRES = 3600

# For production, it's recommended to set a timezone.
# Replace 'UTC' with your project's timezone if different.
CELERY_TIMEZONE = 'UTC'

# This setting helps prevent deadlocks in certain scenarios.
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True


CELERY_BEAT_SCHEDULE = {
    'run-campaign-scheduler-every-minute': {
        'task': 'campaign_scheduler_tick',   # The task to run
        'schedule': crontab(),               # Run every minute
    },
        'publish-scheduled-posts-every-minute': {
        'task': 'publish_scheduled_posts', # This new task publishes the posts
        'schedule': crontab(),             # Run every minute
    },
}

SOCIALACCOUNT_ADAPTER = 'accounts.adapters.MySocialAccountAdapter'
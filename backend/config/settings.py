"""KrishiSetu settings. Secure defaults; production startup requires explicit config."""
import os
from datetime import timedelta
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv('DJANGO_DEBUG', '0') == '1'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'LOCAL-DEV-ONLY-insecure-replace-before-deploy-very-long-key'
    else:
        from django.core.exceptions import ImproperlyConfigured
        raise ImproperlyConfigured('DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=0')
ALLOWED_HOSTS = [h.strip() for h in os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]
CSRF_TRUSTED_ORIGINS = [x for x in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if x]
INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'rest_framework', 'rest_framework_simplejwt.token_blacklist', 'corsheaders', 'core',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware', 'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{'BACKEND':'django.template.backends.django.DjangoTemplates', 'DIRS':[],
              'APP_DIRS':True,'OPTIONS':{'context_processors':[
                  'django.template.context_processors.debug', 'django.template.context_processors.request',
                  'django.contrib.auth.context_processors.auth','django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'config.wsgi.application'
DATABASES = {'default': dj_database_url.config(default=f'sqlite:///{BASE_DIR / "db.sqlite3"}', conn_max_age=60)}
AUTH_USER_MODEL = 'core.User'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME':'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator','OPTIONS':{'min_length':10}},
    {'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME':'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
LANGUAGE_CODE = 'en-in'; TIME_ZONE = 'Asia/Kolkata'; USE_I18N = True; USE_TZ = True
STATIC_URL = '/static/'; STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'; MEDIA_ROOT = BASE_DIR / 'media'
PRIVATE_MEDIA_ROOT = BASE_DIR / 'private_media'  # not served by nginx /media
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.getenv('CORS_ALLOWED_ORIGINS','http://localhost:5173').split(',') if o.strip()]
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES':['rest_framework_simplejwt.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES':['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_THROTTLE_CLASSES':['rest_framework.throttling.AnonRateThrottle','rest_framework.throttling.UserRateThrottle'],
    'DEFAULT_THROTTLE_RATES':{'anon':'60/hour','user':'600/hour'},
    'DEFAULT_PAGINATION_CLASS':'rest_framework.pagination.PageNumberPagination', 'PAGE_SIZE':20,
}
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':timedelta(minutes=15), 'REFRESH_TOKEN_LIFETIME':timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':True, 'BLACKLIST_AFTER_ROTATION':True,
    'AUTH_HEADER_TYPES':('Bearer',),
}
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST',''); EMAIL_PORT=int(os.getenv('EMAIL_PORT','587'))
EMAIL_HOST_USER=os.getenv('EMAIL_HOST_USER',''); EMAIL_HOST_PASSWORD=os.getenv('EMAIL_HOST_PASSWORD','')
EMAIL_USE_TLS=os.getenv('EMAIL_USE_TLS','1') == '1'
DEFAULT_FROM_EMAIL=os.getenv('DEFAULT_FROM_EMAIL','no-reply@krishisetu.invalid')
FRONTEND_URL = os.getenv('FRONTEND_URL','http://localhost:5173').rstrip('/')
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID','')
SMS_PROVIDER = os.getenv('SMS_PROVIDER','')
TWILIO_ACCOUNT_SID=os.getenv('TWILIO_ACCOUNT_SID','')
TWILIO_AUTH_TOKEN=os.getenv('TWILIO_AUTH_TOKEN','')
TWILIO_FROM_NUMBER=os.getenv('TWILIO_FROM_NUMBER','')
OGD_API_KEY=os.getenv('OGD_API_KEY','')
OGD_RESOURCE_ID=os.getenv('OGD_RESOURCE_ID','')
OGD_IMPORT_PAGE_SIZE=int(os.getenv('OGD_IMPORT_PAGE_SIZE','500'))
OGD_IMPORT_MAX_PAGES=int(os.getenv('OGD_IMPORT_MAX_PAGES','100'))
SECURE_SSL_REDIRECT = not DEBUG and os.getenv('SECURE_SSL_REDIRECT','1')=='1'
SESSION_COOKIE_SECURE=not DEBUG
CSRF_COOKIE_SECURE=not DEBUG
SECURE_HSTS_SECONDS=31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS=not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF=True
SECURE_REFERRER_POLICY='strict-origin-when-cross-origin'
X_FRAME_OPTIONS='DENY'
# Multi-instance deployment: configure an external shared cache for reliable throttle/cooldown limits.
if os.getenv('REDIS_URL'):
    CACHES={'default':{'BACKEND':'django.core.cache.backends.redis.RedisCache','LOCATION':os.environ['REDIS_URL']}}

# Only public key IDs are returned to browsers; secret values stay on the server.
RAZORPAY_KEY_ID=os.getenv('RAZORPAY_KEY_ID','')
RAZORPAY_KEY_SECRET=os.getenv('RAZORPAY_KEY_SECRET','')
RAZORPAY_WEBHOOK_SECRET=os.getenv('RAZORPAY_WEBHOOK_SECRET','')
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].update({'login':'12/hour','password_reset':'5/hour'})

# Optional provider boundaries; no source-derived prices or route distances are fabricated.
ORS_API_KEY=os.getenv('ORS_API_KEY','')
MARKET_LLM_PROVIDER=os.getenv('MARKET_LLM_PROVIDER','')
OPENAI_API_KEY=os.getenv('OPENAI_API_KEY','')
OPENAI_MODEL=os.getenv('OPENAI_MODEL','gpt-4.1-mini')

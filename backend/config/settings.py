"""KrishiSetu settings. Secure defaults; production startup requires explicit config."""
import os
import sys
from datetime import timedelta
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# Gracefully load local .env if present
for env_candidate in [BASE_DIR / '.env', BASE_DIR.parent / '.env']:
    if env_candidate.exists():
        try:
            with open(env_candidate, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        k, v = k.strip(), v.strip()
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass
        break

DEBUG = os.getenv('DJANGO_DEBUG', '0') == '1'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'LOCAL-DEV-ONLY-insecure-replace-before-deploy-very-long-key'
    else:
        from django.core.exceptions import ImproperlyConfigured
        raise ImproperlyConfigured('DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=0')
ALLOWED_HOSTS = [h.strip() for h in os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]
RENDER_EXTERNAL_HOSTNAME = os.getenv('RENDER_EXTERNAL_HOSTNAME', '').strip()
if RENDER_EXTERNAL_HOSTNAME and RENDER_EXTERNAL_HOSTNAME not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

CSRF_TRUSTED_ORIGINS = [x.strip() for x in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if x.strip()]
if RENDER_EXTERNAL_HOSTNAME:
    render_origin = f'https://{RENDER_EXTERNAL_HOSTNAME}'
    if render_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(render_origin)
INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'rest_framework', 'rest_framework_simplejwt.token_blacklist', 'corsheaders', 'core.apps.CoreConfig',
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
_raw_db = os.getenv('DATABASE_URL', '')
if 'test' in sys.argv or 'pytest' in sys.modules or os.getenv('PYTEST_CURRENT_TEST'):
    _raw_db = ''
elif '@db:' in _raw_db and not os.path.exists('/.dockerenv') and not os.getenv('RUNNING_IN_DOCKER'):
    _raw_db = ''
if _raw_db:
    DATABASES = {'default': dj_database_url.parse(_raw_db, conn_max_age=0)}
    DATABASES['default']['DISABLE_SERVER_SIDE_CURSORS'] = True
    DATABASES['default']['CONN_HEALTH_CHECKS'] = True
else:
    DATABASES = {'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }}
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
_raw_cors_regexes = os.getenv(
    'CORS_ORIGIN_REGEXES',
    r'^https://krishisetu.*\.onrender\.com$,^https://krishisetu.*\.vercel\.app$' if not DEBUG else '',
)
CORS_ALLOWED_ORIGIN_REGEXES = [r.strip() for r in _raw_cors_regexes.split(',') if r.strip()]
REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
    'DEFAULT_AUTHENTICATION_CLASSES':[
        'core.supabase_auth.SupabaseAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES':['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_THROTTLE_CLASSES':['rest_framework.throttling.AnonRateThrottle','rest_framework.throttling.UserRateThrottle'],
    'DEFAULT_THROTTLE_RATES':{
        'anon': os.getenv('ANON_THROTTLE_RATE', '1000/hour'),
        'user': os.getenv('USER_THROTTLE_RATE', '6000/hour'),
        'catalog': os.getenv('CATALOG_THROTTLE_RATE', '3000/hour'),
    },
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
if FRONTEND_URL.startswith(('http://', 'https://')):
    if FRONTEND_URL not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(FRONTEND_URL)
    if FRONTEND_URL not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(FRONTEND_URL)
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID','')
SMS_PROVIDER = os.getenv('SMS_PROVIDER','')
FAST2SMS_API_KEY = os.getenv('FAST2SMS_API_KEY','')
FAST2SMS_OTP_ID = os.getenv('FAST2SMS_OTP_ID','')
TWILIO_ACCOUNT_SID=os.getenv('TWILIO_ACCOUNT_SID','')
TWILIO_AUTH_TOKEN=os.getenv('TWILIO_AUTH_TOKEN','')
TWILIO_FROM_NUMBER=os.getenv('TWILIO_FROM_NUMBER','')
OGD_API_KEY=os.getenv('OGD_API_KEY','')
OGD_RESOURCE_ID=os.getenv('OGD_RESOURCE_ID','')
OGD_IMPORT_PAGE_SIZE=int(os.getenv('OGD_IMPORT_PAGE_SIZE','500'))
OGD_IMPORT_MAX_PAGES=int(os.getenv('OGD_IMPORT_MAX_PAGES','100'))
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = not DEBUG
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
    try:
        import redis  # noqa: F401
        CACHES={'default':{'BACKEND':'django.core.cache.backends.redis.RedisCache','LOCATION':os.environ['REDIS_URL']}}
    except ImportError:
        CACHES={'default':{'BACKEND':'django.core.cache.backends.locmem.LocMemCache'}}

# Only public key IDs are returned to browsers; secret values stay on the server.
RAZORPAY_KEY_ID=os.getenv('RAZORPAY_KEY_ID','')
RAZORPAY_KEY_SECRET=os.getenv('RAZORPAY_KEY_SECRET','')
RAZORPAY_WEBHOOK_SECRET=os.getenv('RAZORPAY_WEBHOOK_SECRET','')
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].update({
    'login': '12/hour',
    'password_reset': '5/hour',
    'market_sync': '10/hour',
})

# Optional provider boundaries; no source-derived prices or route distances are fabricated.
ORS_API_KEY=os.getenv('ORS_API_KEY','')
MARKET_LLM_PROVIDER=os.getenv('MARKET_LLM_PROVIDER','')
OPENAI_API_KEY=os.getenv('OPENAI_API_KEY','')
OPENAI_MODEL=os.getenv('OPENAI_MODEL','gpt-4.1-mini')

# Supabase Platform Integration
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET', '')

IS_TESTING = 'test' in sys.argv or 'pytest' in sys.modules or bool(os.getenv('PYTEST_CURRENT_TEST'))
STORAGES = {
    'default': (
        {
            'BACKEND': 'core.supabase_storage.SupabaseStorage',
            'OPTIONS': {'bucket_name': os.getenv('SUPABASE_PUBLIC_BUCKET', 'crop-images'), 'is_private': False},
        }
        if (not DEBUG and not IS_TESTING and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
        else {'BACKEND': 'django.core.files.storage.FileSystemStorage'}
    ),
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage'
        if not DEBUG
        else 'django.contrib.staticfiles.storage.StaticFilesStorage',
    },
}

# Ensure local directories exist
STATIC_ROOT.mkdir(parents=True, exist_ok=True)
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
PRIVATE_MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

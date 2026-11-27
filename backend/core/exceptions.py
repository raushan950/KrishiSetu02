import logging
from django.db import IntegrityError
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Sanitized exception handler for REST Framework:
    - Traps Django IntegrityErrors and converts them into structured 400/409 JSON responses.
    - Shields database credentials, environment variables, and tracebacks from frontend clients.
    """
    response = exception_handler(exc, context)
    if response is not None:
        return response

    # Handle database integrity errors (unique constraints, foreign keys)
    if isinstance(exc, IntegrityError):
        err_msg = str(exc)
        if 'core_user_phone_key' in err_msg or 'phone' in err_msg.lower():
            return Response(
                {'phone': ['This mobile number cannot be used. Try another number or contact support.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        if 'core_user_email_key' in err_msg or 'email' in err_msg.lower():
            return Response(
                {'email': ['This email address cannot be used. Try another email or contact support.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        logger.warning("Database IntegrityError trapped: %s", exc)
        return Response(
            {'detail': 'A database constraint conflict occurred. Please review your input and try again.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # General unexpected exception fallback: log securely without leaking stack or secrets
    logger.exception("Unexpected exception in API view: %s", exc)
    return Response(
        {'detail': 'An internal server error occurred. Please try again later or contact support.'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )

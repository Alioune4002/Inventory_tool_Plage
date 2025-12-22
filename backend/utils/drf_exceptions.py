import logging

from django.db.utils import OperationalError, ProgrammingError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

LOGGER = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Return JSON for known infra/runtime errors (DB not ready, migrations missing)
    instead of the default Django HTML 500 page.
    """
    response = exception_handler(exc, context)
    if response is not None:
        return response

    try:
        from accounts.services.access import LimitExceeded
    except Exception:
        LimitExceeded = None

    if LimitExceeded is not None and isinstance(exc, LimitExceeded):
        return Response(
            {
                "detail": exc.detail,
                "code": exc.code,
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if isinstance(exc, (OperationalError, ProgrammingError)):
        request = context.get("request")
        if request is not None:
            LOGGER.exception("Database error on %s %s", request.method, request.get_full_path())
        else:
            LOGGER.exception("Database error (no request in context)")

        return Response(
            {
                "detail": "Service indisponible (base de données). Réessaie dans quelques instants.",
                "code": "db_unavailable",
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return None

"""SendGrid helpers shared across the backend."""

from __future__ import annotations

import base64
import logging
from typing import Optional

from django.conf import settings
from django.core.mail import EmailMessage

try:  # pragma: no cover
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import (
        Attachment,
        Disposition,
        FileContent,
        FileName,
        FileType,
        Mail,
    )
except ImportError:  # pragma: no cover
    SendGridAPIClient = None
    Mail = None
    Attachment = None
    Disposition = None
    FileContent = None
    FileName = None
    FileType = None

logger = logging.getLogger(__name__)


def invitations_email_enabled() -> bool:
    """True si l’envoi d’email d’invitation est activé côté prod."""
    return getattr(settings, "INVITATIONS_SEND_EMAILS", True)


def _build_sendgrid_attachment(filename: str, file_bytes: bytes, mimetype: str):
    if not file_bytes:
        return None
    if Attachment is None:
        return None

    encoded = base64.b64encode(file_bytes).decode()
    attachment = Attachment()
    attachment.file_content = FileContent(encoded)
    attachment.file_type = FileType(mimetype or "application/octet-stream")
    attachment.file_name = FileName(filename or "attachment.bin")
    attachment.disposition = Disposition("attachment")
    return attachment


def send_email_with_sendgrid(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: Optional[str] = None,
    filename: str = "",
    file_bytes: Optional[bytes] = None,
    mimetype: str = "text/plain",
    fallback_to_django: bool = True,
) -> bool:
    """Envoie un email via SendGrid quand configuré, sinon fallback vers EmailMessage."""
    if not to_email:
        logger.debug("Envoi email annulé : aucun destinataire.")
        return False

    from_email = getattr(settings, "SENDGRID_FROM_EMAIL", "no-reply@stockscan.app")
    sent = False
    client = None
    if SendGridAPIClient and Mail and getattr(settings, "SENDGRID_API_KEY", None):
        try:
            client = SendGridAPIClient(settings.SENDGRID_API_KEY)
            sg_mail = Mail(
                from_email=from_email,
                to_emails=[to_email],
                subject=subject,
                plain_text_content=text_body,
                html_content=html_body or text_body,
            )

            attachment = _build_sendgrid_attachment(filename, file_bytes or b"", mimetype)
            if attachment:
                sg_mail.attachment = attachment

            client.send(sg_mail)
            sent = True
        except Exception as exc:  # pragma: no cover
            logger.warning("SendGrid envoi échoué (%s): %s", to_email, exc)
            sent = False

    if not sent and fallback_to_django:
        try:
            mail = EmailMessage(
                subject=subject,
                body=text_body,
                from_email=from_email,
                to=[to_email],
            )
            if html_body:
                mail.content_subtype = "html"
                mail.body = html_body
            if file_bytes:
                mail.attach(filename or "attachment", file_bytes, mimetype)
            mail.send(fail_silently=True)
            sent = True
        except Exception as exc:
            logger.warning("Fallback email Django échoué (%s): %s", to_email, exc)

    logger.debug("Email vers %s envoyé via SendGrid=%s fallback=%s", to_email, bool(sent and client), sent)
    return sent

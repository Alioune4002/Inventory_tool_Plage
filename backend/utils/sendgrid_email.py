"""SendGrid helpers shared across the backend."""

from __future__ import annotations

import base64
import logging
import re
from typing import Optional, Tuple

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

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


def _escape_html(text: str) -> str:
    if text is None:
        return ""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _looks_like_full_html(html: str) -> bool:
    if not html:
        return False
    return bool(re.search(r"<html\b|<!doctype\b", html, flags=re.IGNORECASE))


def _stockscan_html_template(
    *,
    title: str,
    intro: str,
    content_html: str,
    footer_note: str = "StockScan — Inventaires simples, propres, efficaces.",
    cta_label: str = "",
    cta_url: str = "",
) -> str:
    """
    HTML email compatible clients (table-based), style premium dark + card.
    content_html doit être déjà en HTML (peut contenir <p>, <ul>, etc.)
    """
    brand = getattr(settings, "EMAIL_BRAND_NAME", "StockScan")
    from_email = getattr(settings, "SENDGRID_FROM_EMAIL", "no-reply@stockscan.app")
    support_email = getattr(settings, "SUPPORT_EMAIL", "support@stockscan.app")
    year = getattr(settings, "EMAIL_FOOTER_YEAR", "")

    cta_block = ""
    if cta_label and cta_url:
        safe_label = _escape_html(cta_label)
        safe_url = _escape_html(cta_url)
        cta_block = f"""
          <tr>
            <td style="padding: 18px 0 6px 0;">
              <a href="{safe_url}"
                 style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;
                        padding:12px 16px;border-radius:14px;font-weight:700;font-size:14px;">
                {safe_label}
              </a>
            </td>
          </tr>
        """

    safe_title = _escape_html(title or brand)
    safe_intro = _escape_html(intro or "")
    safe_footer = _escape_html(footer_note or "")

    return f"""<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{safe_title}</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1220;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b1220;">
      <tr>
        <td align="center" style="padding: 28px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640"
                 style="max-width:640px;width:100%;">
            <tr>
              <td style="padding: 0 0 14px 0;">
                <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
                            color:#e5e7eb;font-weight:900;font-size:18px;letter-spacing:0.2px;">
                  {brand}
                </div>
                <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
                            color:#94a3b8;font-size:13px;margin-top:4px;">
                  Message automatique · {from_email}
                </div>
              </td>
            </tr>

            <tr>
              <td style="background: linear-gradient(135deg, #0f172a, #111827);
                         border:1px solid rgba(148,163,184,0.18);
                         border-radius: 20px;
                         padding: 22px 22px;">
                <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
                            color:#ffffff;font-size:18px;font-weight:900;line-height:1.2;">
                  {safe_title}
                </div>

                <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
                            color:#cbd5e1;font-size:14px;line-height:1.6;margin-top:10px;">
                  {safe_intro}
                </div>

                <div style="height: 14px;"></div>

                <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
                            color:#e5e7eb;font-size:14px;line-height:1.7;">
                  {content_html}
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  {cta_block}
                </table>

                <div style="height: 16px;"></div>

                <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
                            color:#94a3b8;font-size:12px;line-height:1.6;">
                  Besoin d’aide ? <a href="mailto:{_escape_html(support_email)}"
                    style="color:#93c5fd;text-decoration:none;">{_escape_html(support_email)}</a>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding: 14px 4px 0 4px;">
                <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
                            color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
                  {safe_footer} {f"© {year}" if year else ""}
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _summarize_sendgrid_exception(exc: Exception) -> Tuple[Optional[int], str]:
    status_code = getattr(exc, "status_code", None)
    body_snippet = ""

    try:
        body = getattr(exc, "body", None)
        if body is not None:
            if isinstance(body, (bytes, bytearray)):
                body = body.decode(errors="ignore")
            body_snippet = str(body)[:800]
    except Exception:
        pass

    return status_code, body_snippet


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
    """
    Envoie un email via SendGrid quand configuré, sinon fallback vers EmailMultiAlternatives.

    - Protection si SENDGRID_FROM_EMAIL contient par erreur plusieurs emails (virgule).
    - Support du Reply-To via settings.REPLY_TO_EMAIL (sinon SUPPORT_EMAIL).
    """
    if not to_email:
        logger.debug("Envoi email annulé : aucun destinataire.")
        return False

    from_email = getattr(settings, "SENDGRID_FROM_EMAIL", "no-reply@stockscan.app")
    support_email = getattr(settings, "SUPPORT_EMAIL", "")
    reply_to = getattr(settings, "REPLY_TO_EMAIL", "") or support_email

    if isinstance(from_email, str) and "," in from_email:
        from_email = from_email.split(",")[0].strip()

    brand = getattr(settings, "EMAIL_BRAND_NAME", "StockScan")

    # --- HTML premium (auto-wrap) ---
    if html_body:
        if _looks_like_full_html(html_body):
            final_html = html_body
        else:
            content = html_body.strip()
            if "<" not in content:
                content = f"<p style='margin:0'>{_escape_html(content)}</p>"
            final_html = _stockscan_html_template(
                title=subject or brand,
                intro="",
                content_html=content,
            )
    else:
        safe = _escape_html(text_body or "")
        safe = safe.replace("\n\n", "</p><p style='margin:0 0 10px 0;'>").replace("\n", "<br/>")
        final_html = _stockscan_html_template(
            title=subject or brand,
            intro="",
            content_html=f"<p style='margin:0 0 10px 0;'>{safe}</p>",
        )

    sent_via_sendgrid = False
    sent_via_django = False

    api_key = getattr(settings, "SENDGRID_API_KEY", None)

    # --- SendGrid ---
    if SendGridAPIClient and Mail and api_key:
        try:
            client = SendGridAPIClient(api_key)
            sg_mail = Mail(
                from_email=from_email,
                to_emails=[to_email],
                subject=subject,
                plain_text_content=text_body or "",
                html_content=final_html,
            )

            if reply_to:
                try:
                    sg_mail.reply_to = reply_to
                except Exception:
                    pass

            attachment = _build_sendgrid_attachment(filename, file_bytes or b"", mimetype)
            if attachment:
                sg_mail.attachment = attachment

            resp = client.send(sg_mail)
            status_code = getattr(resp, "status_code", None)

            if status_code and int(status_code) >= 400:
                logger.warning(
                    "SendGrid responded error: to=%s status=%s body=%s",
                    to_email,
                    status_code,
                    str(getattr(resp, "body", ""))[:800],
                )
                sent_via_sendgrid = False
            else:
                sent_via_sendgrid = True

        except Exception as exc:  # pragma: no cover
            status_code, body_snippet = _summarize_sendgrid_exception(exc)

            if status_code in (401, 403):
                logger.error(
                    "SendGrid AUTH error (%s) for %s. "
                    "Vérifie la variable SENDGRID_API_KEY sur Render + permissions de la clé (Mail Send). Body=%s",
                    status_code,
                    to_email,
                    body_snippet or str(exc),
                )
            else:
                logger.warning(
                    "SendGrid envoi échoué (%s) status=%s body=%s",
                    to_email,
                    status_code,
                    body_snippet or str(exc),
                )

            sent_via_sendgrid = False
    else:
        if not api_key:
            logger.warning("SendGrid non configuré: SENDGRID_API_KEY manquante.")
        if not SendGridAPIClient or not Mail:
            logger.warning("SendGrid SDK non disponible (sendgrid-python non installé).")

    # --- Django fallback ---
    if not sent_via_sendgrid and fallback_to_django:
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=(text_body or ""),
                from_email=from_email,
                to=[to_email],
                reply_to=[reply_to] if reply_to else None,
            )
            msg.attach_alternative(final_html, "text/html")
            if file_bytes:
                msg.attach(filename or "attachment", file_bytes, mimetype)

            # ✅ IMPORTANT: send() renvoie un int (nb envoyés)
            sent_count = msg.send(fail_silently=True) or 0
            sent_via_django = sent_count > 0

            if not sent_via_django:
                logger.warning("Django email fallback: 0 email envoyé (fail_silently=True).")
        except Exception as exc:
            logger.warning("Fallback email Django échoué (%s): %s", to_email, exc)
            sent_via_django = False

    sent = bool(sent_via_sendgrid or sent_via_django)

    logger.info(
        "Email send result: to=%s sendgrid=%s django_fallback=%s final=%s subject=%s",
        to_email,
        sent_via_sendgrid,
        sent_via_django,
        sent,
        subject,
    )

    return sent
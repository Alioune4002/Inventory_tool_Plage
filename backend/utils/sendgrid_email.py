"""SendGrid helpers shared across the backend."""

from __future__ import annotations

import base64
import logging
import re
from typing import Optional

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

    # CTA optionnel
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

    # Important : inline CSS only 
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

     AJOUTS:
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
    final_html = None
    if html_body:
        if _looks_like_full_html(html_body):
            final_html = html_body
        else:
            # Si l'appelant passe juste un message, on le transforme proprement
            content = html_body.strip()
            # si ce n'est pas déjà des balises, on le met en <p>
            if "<" not in content:
                content = f"<p style='margin:0'>{_escape_html(content)}</p>"
            final_html = _stockscan_html_template(
                title=subject or brand,
                intro="",
                content_html=content,
            )
    else:
        # Pas de html_body => on fabrique un HTML propre à partir du texte
        safe = _escape_html(text_body or "")
        safe = safe.replace("\n\n", "</p><p style='margin:0 0 10px 0;'>").replace("\n", "<br/>")
        final_html = _stockscan_html_template(
            title=subject or brand,
            intro="",
            content_html=f"<p style='margin:0 0 10px 0;'>{safe}</p>",
        )

    sent = False
    client = None

    # --- SendGrid ---
    if SendGridAPIClient and Mail and getattr(settings, "SENDGRID_API_KEY", None):
        try:
            client = SendGridAPIClient(settings.SENDGRID_API_KEY)
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

            client.send(sg_mail)
            sent = True
        except Exception as exc:  # pragma: no cover
            logger.warning("SendGrid envoi échoué (%s): %s", to_email, exc)
            sent = False

   
    if not sent and fallback_to_django:
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
            msg.send(fail_silently=True)
            sent = True
        except Exception as exc:
            logger.warning("Fallback email Django échoué (%s): %s", to_email, exc)

    logger.debug("Email vers %s envoyé via SendGrid=%s fallback=%s", to_email, bool(sent and client), sent)
    return sent
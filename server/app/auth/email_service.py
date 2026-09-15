import os
import logging
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Vibe Workflow")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
APP_URL = os.getenv("APP_URL", "http://localhost:5000")


async def send_email(to_email: str, subject: str, html_body: str):
    """Send an email via SMTP."""
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning(f"SMTP not configured. Would send email to {to_email}: {subject}")
        logger.info(f"Email body: {html_body}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL or SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            start_tls=True,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
        )
        logger.info(f"Email sent successfully to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        raise


async def send_verification_email(to_email: str, token: str):
    """Send email verification link."""
    verify_url = f"{APP_URL}/auth/verify-email?token={token}"
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #030303; color: #ffffff; margin: 0; padding: 0; }}
            .container {{ max-width: 500px; margin: 40px auto; padding: 40px; background: linear-gradient(135deg, #0a0a0a, #111111); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; }}
            .logo {{ font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 8px; }}
            .logo span {{ color: #3b82f6; }}
            .title {{ font-size: 20px; font-weight: 700; margin: 24px 0 12px; }}
            .text {{ color: #a1a1aa; line-height: 1.6; margin-bottom: 24px; }}
            .button {{ display: inline-block; background: #3b82f6; color: #ffffff !important; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }}
            .footer {{ margin-top: 32px; font-size: 12px; color: #52525b; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">Workflow<span>Pro</span></div>
            <div class="title">Подтвердите email</div>
            <div class="text">
                Нажмите на кнопку ниже, чтобы подтвердить ваш email адрес. Ссылка действительна 24 часа.
            </div>
            <a href="{verify_url}" class="button">Подтвердить email</a>
            <div class="footer">
                Если вы не регистрировались в Vibe Workflow, проигнорируйте это письмо.
            </div>
        </div>
    </body>
    </html>
    """
    await send_email(to_email, "Подтвердите ваш email — Vibe Workflow", html)


async def send_password_reset_email(to_email: str, token: str):
    """Send password reset link."""
    reset_url = f"{APP_URL}/auth/reset-password?token={token}"
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #030303; color: #ffffff; margin: 0; padding: 0; }}
            .container {{ max-width: 500px; margin: 40px auto; padding: 40px; background: linear-gradient(135deg, #0a0a0a, #111111); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; }}
            .logo {{ font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 8px; }}
            .logo span {{ color: #3b82f6; }}
            .title {{ font-size: 20px; font-weight: 700; margin: 24px 0 12px; }}
            .text {{ color: #a1a1aa; line-height: 1.6; margin-bottom: 24px; }}
            .button {{ display: inline-block; background: #ef4444; color: #ffffff !important; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }}
            .footer {{ margin-top: 32px; font-size: 12px; color: #52525b; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">Workflow<span>Pro</span></div>
            <div class="title">Сброс пароля</div>
            <div class="text">
                Вы запросили сброс пароля. Нажмите на кнопку ниже, чтобы установить новый пароль. Ссылка действительна 1 час.
            </div>
            <a href="{reset_url}" class="button">Сбросить пароль</a>
            <div class="footer">
                Если вы не запрашивали сброс пароля, проигнорируйте это письмо.
            </div>
        </div>
    </body>
    </html>
    """
    await send_email(to_email, "Сброс пароля — Vibe Workflow", html)

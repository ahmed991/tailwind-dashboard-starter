import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = "smtpout.secureserver.net"
SMTP_PORT = 465
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
BASE_URL  = os.environ.get("BASE_URL", "http://localhost:8000")

APPROVERS = ["ffbsgmbh@gmail.com", "gisffbs@gmail.com"]


def send_approval_request(user_email: str, full_name: str, organisation: str, role: str, token: str):
    approve_url = f"{BASE_URL}/auth/approve/{token}"

    body_html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a3a2a; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">New User Registration</h2>
        <p style="color: #a0c4a0; margin: 4px 0 0;">Fashion for Biodiversity Platform</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px 32px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <p>A new user has registered and is awaiting your approval:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; font-weight: bold; color: #555; width: 140px;">Name</td><td style="padding: 8px;">{full_name}</td></tr>
          <tr style="background:#f0f0f0;"><td style="padding: 8px; font-weight: bold; color: #555;">Email</td><td style="padding: 8px;">{user_email}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #555;">Organisation</td><td style="padding: 8px;">{organisation or "—"}</td></tr>
          <tr style="background:#f0f0f0;"><td style="padding: 8px; font-weight: bold; color: #555;">Role</td><td style="padding: 8px; text-transform: capitalize;">{role or "—"}</td></tr>
        </table>
        <div style="text-align: center; margin: 28px 0 16px;">
          <a href="{approve_url}"
             style="background: #2d7a4f; color: white; text-decoration: none; padding: 14px 32px;
                    border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">
            Approve Account
          </a>
        </div>
        <p style="color: #888; font-size: 12px; text-align: center;">
          This link can only be used once. If you did not expect this registration, you can ignore this email.
        </p>
      </div>
    </body></html>
    """

    body_plain = f"""New user registration pending approval:

Name:         {full_name}
Email:        {user_email}
Organisation: {organisation or "—"}
Role:         {role or "—"}

Click to approve: {approve_url}

This link can only be used once. If you did not expect this, ignore this email.
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[FFBS] Approve new user: {full_name}"
    msg["From"]    = SMTP_USER
    msg["To"]      = ", ".join(APPROVERS)
    msg.attach(MIMEText(body_plain, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as s:
        s.login(SMTP_USER, SMTP_PASS)
        s.sendmail(SMTP_USER, APPROVERS, msg.as_string())


def send_approval_confirmation(user_email: str, full_name: str):
    body_html = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a3a2a; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">Account Approved</h2>
        <p style="color: #a0c4a0; margin: 4px 0 0;">Fashion for Biodiversity Platform</p>
      </div>
      <div style="background: #f9f9f9; padding: 24px 32px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hi {full_name},</p>
        <p>Your account has been approved by an administrator. You can now log in to the FFBS platform.</p>
        <div style="text-align: center; margin: 28px 0 16px;">
          <a href="{BASE_URL.replace('8000', '5173') if 'localhost' in BASE_URL else BASE_URL}"
             style="background: #2d7a4f; color: white; text-decoration: none; padding: 14px 32px;
                    border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">
            Log In Now
          </a>
        </div>
      </div>
    </body></html>
    """

    body_plain = f"""Hi {full_name},

Your account has been approved. You can now log in to the FFBS platform.
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "[FFBS] Your account has been approved"
    msg["From"]    = SMTP_USER
    msg["To"]      = user_email
    msg.attach(MIMEText(body_plain, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as s:
        s.login(SMTP_USER, SMTP_PASS)
        s.sendmail(SMTP_USER, [user_email], msg.as_string())

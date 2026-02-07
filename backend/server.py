from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, status, Query, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import List, Optional
import os
import logging
import uuid
import aiofiles
import random
import string
import secrets
import asyncio
import re
import shutil
from bson import ObjectId
from dotenv import load_dotenv

# Load environment variables from .env file (override existing ones)
load_dotenv(override=True)

from models import (
    User, UserCreate, UserLogin, UserRole,
    Product, ProductCreate,
    Order, OrderCreate, OrderStatus,
    Invoice, Service, ServiceStatus, AccountType,
    Settings, XtreamSettings, SMTPSettings, PayPalSettings, StripeSettings,
    Ticket, TicketCreate, TicketStatus, TicketPriority, TicketMessage,
    EmailTemplate, EmailTemplateType, EmailTemplateUpdate,
    EmailLog, EmailStatus, EmailType,
    EmailUnsubscribe, UnsubscribeReason,
    ScheduledEmail,
    TemplateVersion,
    Referral, ReferralStatus, ReferralSettings,
    Coupon, CouponType, CouponUsage,
    CreditTransaction, CreditSettings,
    Refund, RefundStatus,
    AutoRenewal, RenewalStatus,
    PaymentRetry,
    LifecycleLog, LifecycleAction,
    Download, DownloadCategory, DownloadLog,
    License, LicenseStatus, LicenseValidation,
    ImportedUser
)
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_current_admin_user
)
from xtreamui_service import get_xtream_service, XtreamUIService
from xtream_session_client import XtreamUISessionClient
from email_service import get_email_service
from email_logger import EmailLogger
from unsubscribe_manager import UnsubscribeManager
from invoice_service import get_invoice_generator

# Import 2FA and reCAPTCHA services
from two_factor_service import TwoFactorService
from recaptcha_service import RecaptchaService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(title="IPTV Billing System", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/iptv_billing")
DB_NAME = os.getenv("DB_NAME", "test_database")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_collection = db.users
products_collection = db.products
orders_collection = db.orders
invoices_collection = db.invoices
services_collection = db.services
settings_collection = db.settings
tickets_collection = db.tickets
email_templates_collection = db.email_templates
email_logs_collection = db.email_logs
email_unsubscribes_collection = db.email_unsubscribes
scheduled_emails_collection = db.scheduled_emails
template_versions_collection = db.template_versions
referrals_collection = db.referrals
coupons_collection = db.coupons
coupon_usage_collection = db.coupon_usage
credit_transactions_collection = db.credit_transactions
refunds_collection = db.refunds
auto_renewals_collection = db.auto_renewals
payment_retries_collection = db.payment_retries
lifecycle_logs_collection = db.lifecycle_logs
downloads_collection = db.downloads
download_logs_collection = db.download_logs
licenses_collection = db.licenses
license_validations_collection = db.license_validations
imported_users_collection = db.imported_users


# Initialize email logger and unsubscribe manager
email_logger = EmailLogger(db)
unsubscribe_manager = UnsubscribeManager(db)

# Initialize business services (imports only)
from referral_service import ReferralService
from coupon_service import CouponService
from credit_service import CreditService
from refund_service import RefundService
from lifecycle_service import ServiceLifecycleManager
from license_manager import LicenseManager

# Global service instances (will be initialized after get_settings is defined)
referral_service = None
coupon_service = None
credit_service = None
refund_service = None
license_manager = None
lifecycle_manager = None
background_scheduler = None


# Helper functions


async def get_configured_email_service():
    """Get email service with logger and unsubscribe manager"""
    settings = await get_settings()
    smtp_settings = settings.get("smtp", {})
    branding = settings.get("branding", {})
    return get_email_service(smtp_settings, email_logger, unsubscribe_manager, db, branding)

def str_to_objectid(id_str: str) -> ObjectId:
    """Convert string ID to ObjectId"""
    try:
        return ObjectId(id_str)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID format")

def generate_username(length: int = 9) -> str:
    """Generate random username (alphanumeric, no confusing chars)"""
    # Exclude confusing characters: o, O, 0, i, I, l, L, 1
    characters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
    return ''.join(random.choices(characters, k=length))

def generate_password(length: int = 9) -> str:
    """Generate random password (alphanumeric, no confusing chars, no special chars)"""
    # Exclude confusing characters: o, O, 0, i, I, l, L, 1
    # No special characters
    characters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
    return ''.join(random.choices(characters, k=length))

async def get_settings() -> dict:
    """Get system settings"""
    settings = await settings_collection.find_one()
    if not settings:
        # Create default settings
        default_settings = Settings().dict()
        await settings_collection.insert_one(default_settings)
        return default_settings
    return settings

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize application"""
    logger.info("Starting IPTV Billing System...")
    
    # Create indexes
    await users_collection.create_index("email", unique=True)
    await products_collection.create_index("name")
    await orders_collection.create_index("user_id")
    await services_collection.create_index("user_id")
    
    # Create default admin user if not exists
    admin_exists = await users_collection.find_one({"role": "admin"})
    if not admin_exists:
        admin_user = {
            "email": "admin@example.com",
            "name": "Admin",
            "password": get_password_hash("admin123"),
            "role": "admin",
            "created_at": datetime.utcnow()
        }
        await users_collection.insert_one(admin_user)
        logger.info("Default admin created: admin@example.com / admin123")
    
    # Initialize business services (now that get_settings is available)
    global referral_service, coupon_service, credit_service, refund_service, license_manager
    referral_service = ReferralService(db, get_settings)
    coupon_service = CouponService(db)
    credit_service = CreditService(db, get_settings)
    refund_service = RefundService(db, credit_service)
    license_manager = LicenseManager(db)
    logger.info("Business services initialized")
    
    # Validate license on startup (check env var first, then settings)
    current_domain = license_manager.get_current_domain()
    logger.info(f"Current domain detected: {current_domain}")
    logger.info(f"BACKEND_PUBLIC_URL: {os.getenv('BACKEND_PUBLIC_URL', 'not set')}")
    
    license_key = os.getenv("LICENSE_KEY")
    
    # If not in env, check settings
    if not license_key:
        existing_settings = await get_settings()
        license_key = existing_settings.get("license_key", "")
    
    if license_key:
        logger.info(f"Validating license key: {license_key[:8]}...")
        validation = await license_manager.validate_license(license_key, current_domain)
        if validation["valid"]:
            logger.info(f"✓ License validated for domain: {current_domain}")
            logger.info(f"✓ Licensed to: {validation.get('customer_name', 'N/A')}")
        else:
            logger.warning(f"✗ License validation failed: {validation['reason']}")
            logger.warning(f"✗ Domain sent: {current_domain}")
            logger.warning("Application will run in DEMO mode with limitations")
    else:
        logger.warning("No LICENSE_KEY found in environment or settings. Running in DEMO mode.")
    
    # Create default products if none exist
    product_count = await products_collection.count_documents({})
    if product_count == 0:
        default_products = [
            {
                "name": "IPTV Subscriber - 1 Month",
                "description": "Monthly IPTV subscription with full channel access",
                "account_type": "subscriber",
                "bouquets": [1, 2, 3],
                "max_connections": 2,
                "reseller_credits": 0,
                "reseller_max_lines": 0,
                "trial_days": 0,
                "prices": {"1": 15.00},
                "active": True,
                "created_at": datetime.utcnow()
            },
            {
                "name": "IPTV Subscriber - 3 Months",
                "description": "3-month IPTV subscription with full channel access",
                "account_type": "subscriber",
                "bouquets": [1, 2, 3],
                "max_connections": 2,
                "reseller_credits": 0,
                "reseller_max_lines": 0,
                "trial_days": 0,
                "prices": {"3": 40.00},
                "active": True,
                "created_at": datetime.utcnow()
            },
            {
                "name": "IPTV Subscriber - 6 Months",
                "description": "6-month IPTV subscription with full channel access",
                "account_type": "subscriber",
                "bouquets": [1, 2, 3],
                "max_connections": 2,
                "reseller_credits": 0,
                "reseller_max_lines": 0,
                "trial_days": 0,
                "prices": {"6": 75.00},
                "active": True,
                "created_at": datetime.utcnow()
            },
            {
                "name": "IPTV Subscriber - 12 Months",
                "description": "Annual IPTV subscription with full channel access",
                "account_type": "subscriber",
                "bouquets": [1, 2, 3],
                "max_connections": 2,
                "reseller_credits": 0,
                "reseller_max_lines": 0,
                "trial_days": 0,
                "prices": {"12": 140.00},
                "active": True,
                "created_at": datetime.utcnow()
            },
            {
                "name": "IPTV Reseller Package",
                "description": "Reseller package with credit management",
                "account_type": "reseller",
                "bouquets": [],
                "max_connections": 0,
                "reseller_credits": 500.00,
                "reseller_max_lines": 50,
                "trial_days": 0,
                "prices": {"1": 200.00},
                "active": True,
                "created_at": datetime.utcnow()
            }
        ]
        await products_collection.insert_many(default_products)
        logger.info("Default products created")
    
    # Create default email templates if none exist
    template_count = await email_templates_collection.count_documents({})
    if template_count == 0:
        default_templates = [
            {
                "template_type": "order_confirmation",
                "name": "Order Confirmation",
                "subject": "Order Confirmed - {{order_id}}",
                "html_content": """
<h2>Thank you for your order!</h2>
<p>Hi {{customer_name}},</p>
<p>Your order <strong>#{{order_id}}</strong> has been confirmed and payment has been received.</p>

<div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0;">Order Details:</h3>
    <p><strong>Order ID:</strong> #{{order_id}}</p>
    <p><strong>Amount Paid:</strong> ${{amount}}</p>
    <p><strong>Service:</strong> {{product_name}}</p>
    <p><strong>Duration:</strong> {{duration}} month(s)</p>
</div>

<p>Your service credentials will be sent to you shortly.</p>
<p>If you have any questions, please don't hesitate to contact our support team.</p>
""",
                "text_content": "Thank you for your order! Order #{{order_id}} has been confirmed. Amount: ${{amount}}",
                "available_variables": ["customer_name", "order_id", "amount", "product_name", "duration"],
                "description": "Sent when an order payment is confirmed",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "template_type": "service_expiry_warning",
                "name": "Service Expiry Warning",
                "subject": "Your Service Expires Soon - {{days_remaining}} Days Left",
                "html_content": """
<h2>Service Expiry Notice</h2>
<p>Hi {{customer_name}},</p>
<p>This is a friendly reminder that your service will expire in <strong>{{days_remaining}} days</strong>.</p>

<div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
    <h3 style="margin-top: 0;">Service Details:</h3>
    <p><strong>Service:</strong> {{service_name}}</p>
    <p><strong>Expiry Date:</strong> {{expiry_date}}</p>
    <p><strong>Days Remaining:</strong> {{days_remaining}} days</p>
</div>

<p>To continue enjoying uninterrupted service, please renew before the expiry date.</p>
<p><a href="{{renewal_link}}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Renew Now</a></p>
""",
                "text_content": "Hi {{customer_name}}, your service expires in {{days_remaining}} days. Please renew to continue service.",
                "available_variables": ["customer_name", "service_name", "expiry_date", "days_remaining", "renewal_link"],
                "description": "Sent when a service is about to expire (7, 3, or 1 day before)",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "template_type": "service_expired",
                "name": "Service Expired",
                "subject": "Your Service Has Expired",
                "html_content": """
<h2>Service Expired</h2>
<p>Hi {{customer_name}},</p>
<p>Your service <strong>{{service_name}}</strong> has expired as of {{expiry_date}}.</p>

<div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
    <p><strong>Service:</strong> {{service_name}}</p>
    <p><strong>Expired On:</strong> {{expiry_date}}</p>
</div>

<p>To reactivate your service, please visit our website and place a new order.</p>
<p><a href="{{renewal_link}}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Reactivate Service</a></p>
""",
                "text_content": "Hi {{customer_name}}, your service has expired. Please renew to continue.",
                "available_variables": ["customer_name", "service_name", "expiry_date", "renewal_link"],
                "description": "Sent when a service has expired",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "template_type": "ticket_reply",
                "name": "Support Ticket Reply",
                "subject": "New Reply on Your Support Ticket #{{ticket_id}}",
                "html_content": """
<h2>Support Ticket Update</h2>
<p>Hi {{customer_name}},</p>
<p>You have received a new reply on your support ticket <strong>#{{ticket_id}}</strong>.</p>

<div style="background-color: #d1ecf1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
    <h3 style="margin-top: 0;">Ticket: {{ticket_subject}}</h3>
    <p><strong>Reply from:</strong> Support Team</p>
    <div style="background-color: white; padding: 15px; border-radius: 5px; margin-top: 10px;">
        {{reply_message}}
    </div>
</div>

<p><a href="{{ticket_link}}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">View Ticket</a></p>
""",
                "text_content": "Hi {{customer_name}}, you have a new reply on ticket #{{ticket_id}}.",
                "available_variables": ["customer_name", "ticket_id", "ticket_subject", "reply_message", "ticket_link"],
                "description": "Sent when support team replies to a customer ticket",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "template_type": "welcome",
                "name": "Welcome Email",
                "subject": "Welcome to {{company_name}}!",
                "html_content": """
<h2>Welcome Aboard!</h2>
<p>Hi {{customer_name}},</p>
<p>Thank you for registering with <strong>{{company_name}}</strong>! We're excited to have you as part of our community.</p>

<div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
    <h3 style="margin-top: 0;">Getting Started:</h3>
    <ul style="margin-bottom: 0;">
        <li>Browse our available services and products</li>
        <li>Create your first order</li>
        <li>Access your customer dashboard</li>
        <li>Contact support if you need any assistance</li>
    </ul>
</div>

<p><a href="{{dashboard_link}}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Go to Dashboard</a></p>
""",
                "text_content": "Welcome to {{company_name}}! We're excited to have you.",
                "available_variables": ["customer_name", "company_name", "dashboard_link"],
                "description": "Sent when a new user registers",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "template_type": "service_activated",
                "name": "Service Activated - Connection Details",
                "subject": "Your Streaming Service is Ready",
                "html_content": """
<h2>Welcome to Your Premium Streaming Service</h2>

<p>Hi {{customer_name}},</p>

<p>Thank you for choosing us! We are delighted to confirm that your streaming service account has been successfully set up and is ready for you to enjoy.</p>

<p>Your subscription includes access to thousands of channels and on-demand content. You can start watching immediately on up to {{max_connections}} devices at the same time.</p>

<div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0;">
    <h3 style="margin-top: 0; color: #212529;">Your Account Information</h3>
    
    <p style="margin-bottom: 15px;">Below are your personal login credentials. Please keep them safe and do not share with others.</p>
    
    <table style="width: 100%; margin-top: 15px;">
        <tr>
            <td style="padding: 10px 0; color: #495057; font-weight: 600;">Service Plan:</td>
            <td style="padding: 10px 0; color: #212529;">{{service_name}}</td>
        </tr>
        <tr>
            <td style="padding: 10px 0; color: #495057; font-weight: 600;">Account Username:</td>
            <td style="padding: 10px 0; color: #212529; font-family: monospace;">{{username}}</td>
        </tr>
        <tr>
            <td style="padding: 10px 0; color: #495057; font-weight: 600;">Account Passcode:</td>
            <td style="padding: 10px 0; color: #212529; font-family: monospace;">{{password}}</td>
        </tr>
        <tr>
            <td style="padding: 10px 0; color: #495057; font-weight: 600;">Server Address:</td>
            <td style="padding: 10px 0; color: #212529; font-size: 13px; word-break: break-all;">{{streaming_url}}</td>
        </tr>
        <tr>
            <td style="padding: 10px 0; color: #495057; font-weight: 600;">Concurrent Streams:</td>
            <td style="padding: 10px 0; color: #212529;">{{max_connections}} device(s)</td>
        </tr>
        <tr>
            <td style="padding: 10px 0; color: #495057; font-weight: 600;">Valid Until:</td>
            <td style="padding: 10px 0; color: #212529;">{{expiry_date}}</td>
        </tr>
    </table>
</div>

<h3 style="color: #212529;">Getting Started is Easy</h3>

<p>Follow these simple steps to begin watching:</p>

<ol style="line-height: 1.8; color: #495057;">
    <li>Download a compatible player application on your device (we recommend IPTV Smarters Pro, TiviMate, or VLC Media Player)</li>
    <li>Open the application and select the option to add a new connection or login</li>
    <li>Enter your account information from above (username, passcode, and server address)</li>
    <li>Save your settings and you are all set to start streaming</li>
</ol>

<div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
    <h4 style="margin-top: 0; color: #004085;">Important Information</h4>
    <ul style="margin: 0; line-height: 1.8; color: #004085;">
        <li>Your subscription is active until {{expiry_date}}</li>
        <li>You may connect up to {{max_connections}} devices simultaneously</li>
        <li>For security purposes, please keep your login credentials private</li>
        <li>You can manage your account and view all services anytime from your dashboard</li>
    </ul>
</div>

<p>If you need any assistance with setup or have questions about your service, our support team is here to help. Simply reply to this email or contact us through your account dashboard.</p>

<p style="margin-top: 25px;"><a href="{{dashboard_link}}" style="background-color: #007bff; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Access My Dashboard</a></p>

<p style="margin-top: 30px; color: #6c757d;">We appreciate your business and look forward to providing you with an excellent streaming experience.</p>

<p style="color: #6c757d;">Best regards,<br>The Support Team</p>
""",
                "text_content": "Your service is active! Username: {{username}}, Password: {{password}}, Streaming URL: {{streaming_url}}. Expires: {{expiry_date}}",
                "available_variables": ["customer_name", "service_name", "username", "password", "streaming_url", "max_connections", "expiry_date", "dashboard_link"],
                "description": "Sent when a service is activated with connection credentials",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "template_type": "payment_received",
                "name": "Payment Received",
                "subject": "Payment Received - ${{amount}}",
                "html_content": """
<h2>Payment Confirmation</h2>
<p>Hi {{customer_name}},</p>
<p>We have successfully received your payment of <strong>${{amount}}</strong>.</p>

<div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
    <h3 style="margin-top: 0;">Payment Details:</h3>
    <p><strong>Amount:</strong> ${{amount}}</p>
    <p><strong>Order ID:</strong> #{{order_id}}</p>
    <p><strong>Payment Method:</strong> {{payment_method}}</p>
    <p><strong>Date:</strong> {{payment_date}}</p>
</div>

<p>Thank you for your payment!</p>
""",
                "text_content": "Payment of ${{amount}} received for order #{{order_id}}. Thank you!",
                "available_variables": ["customer_name", "amount", "order_id", "payment_method", "payment_date"],
                "description": "Sent when a payment is successfully processed",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
,
            {
                "template_type": "reseller_activated",
                "name": "Reseller Panel Activated",
                "subject": "Your Reseller Panel is Ready - {{credits}} Credits",
                "html_content": """
<h2>🎉 Your Reseller Panel is Active!</h2>
<p>Hi {{customer_name}},</p>
<p>Your reseller panel has been successfully activated and is ready to use!</p>

<div style="background-color: #dbeafe; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
    <h3 style="margin-top: 0; color: #1e40af;">Reseller Panel Details</h3>
    <table style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #1e40af;">Panel URL:</td>
            <td style="padding: 8px 0; font-family: monospace; background-color: #f3f4f6; padding: 5px 10px; border-radius: 4px; word-break: break-all;">{{panel_url}}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #1e40af;">Username:</td>
            <td style="padding: 8px 0; font-family: monospace; background-color: #f3f4f6; padding: 5px 10px; border-radius: 4px;">{{username}}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #1e40af;">Password:</td>
            <td style="padding: 8px 0; font-family: monospace; background-color: #f3f4f6; padding: 5px 10px; border-radius: 4px;">{{password}}</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #1e40af;">Credits:</td>
            <td style="padding: 8px 0; font-weight: bold; font-size: 1.2em; color: #059669;">{{credits}} credits</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #1e40af;">Expiry Date:</td>
            <td style="padding: 8px 0;">{{expiry_date}}</td>
        </tr>
    </table>
</div>

<div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
    <h3 style="margin-top: 0; color: #92400e;">🚀 Getting Started</h3>
    <ol style="margin: 0; padding-left: 20px; color: #92400e;">
        <li style="margin-bottom: 10px;">Login to your reseller panel using the URL above</li>
        <li style="margin-bottom: 10px;">Enter your username and password</li>
        <li style="margin-bottom: 10px;">Start creating subscriber accounts for your customers</li>
        <li style="margin-bottom: 10px;">Each subscriber you create will deduct credits from your balance</li>
        <li>Manage your lines, monitor usage, and grow your business!</li>
    </ol>
</div>

<div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
    <h3 style="margin-top: 0; color: #065f46;">💡 Important Notes</h3>
    <ul style="margin: 0; padding-left: 20px; color: #065f46;">
        <li style="margin-bottom: 8px;">Your {{credits}} credits allow you to create subscriber accounts</li>
        <li style="margin-bottom: 8px;">Credits are deducted based on the package/duration you assign</li>
        <li style="margin-bottom: 8px;">Monitor your credit balance in the reseller panel</li>
        <li style="margin-bottom: 8px;">Purchase additional credit packages anytime to top up</li>
        <li>Need help? Contact our support team!</li>
    </ul>
</div>

<p><a href="{{dashboard_link}}" style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Go to Dashboard</a></p>
<p style="margin-top: 20px;">Start managing your IPTV business today! 🎬</p>
""",
                "text_content": "Your reseller panel is active! Panel: {{panel_url}}, Username: {{username}}, Password: {{password}}, Credits: {{credits}}",
                "available_variables": ["customer_name", "panel_url", "username", "password", "credits", "expiry_date", "dashboard_link"],
                "description": "Sent when a reseller panel is activated with credentials and credits",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "template_type": "email_verification",
                "name": "Email Verification",
                "subject": "Verify Your Email Address",
                "html_content": """
<h2>Welcome to IPTV Billing!</h2>
<p>Hi {{customer_name}},</p>
<p>Thank you for registering. Please verify your email address to activate your account.</p>
<p style="margin: 2rem 0;">
    <a href="{{verification_link}}" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
        Verify Email Address
    </a>
</p>
<p>Or copy this link:</p>
<p style="background: #f3f4f6; padding: 1rem; border-radius: 4px; word-break: break-all;">{{verification_link}}</p>
<p style="color: #6b7280; font-size: 0.875rem; margin-top: 2rem;">This link will expire in 24 hours.</p>
""",
                "text_content": "Verify your email: {{verification_link}}",
                "available_variables": ["customer_name", "verification_link"],
                "description": "Sent when a new user registers to verify their email",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "template_type": "service_renewed",
                "name": "Service Renewed",
                "subject": "Service Renewed Successfully",
                "html_content": """
<h2>Service Renewed!</h2>
<p>Hi {{customer_name}},</p>
<p>Your service has been successfully renewed.</p>

<div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
    <h3 style="margin-top: 0;">Renewal Details:</h3>
    <p><strong>Service:</strong> {{service_name}}</p>
    <p><strong>Username:</strong> {{username}}</p>
    <p><strong>New Expiry Date:</strong> {{new_expiry_date}}</p>
</div>

<p>Your existing credentials remain the same.</p>
<p>Thank you for renewing your service!</p>
""",
                "text_content": "Service {{service_name}} renewed. New expiry: {{new_expiry_date}}",
                "available_variables": ["customer_name", "service_name", "username", "new_expiry_date"],
                "description": "Sent when a service is renewed/extended",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "template_type": "credits_added",
                "name": "Credits Added to Reseller Panel",
                "subject": "{{credits}} Credits Added to Your Panel",
                "html_content": """
<h2>Credits Added!</h2>
<p>Hi {{customer_name}},</p>
<p>We have added <strong>{{credits}} credits</strong> to your reseller panel.</p>

<div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
    <h3 style="margin-top: 0;">Panel Details:</h3>
    <p><strong>Panel Username:</strong> {{username}}</p>
    <p><strong>Credits Added:</strong> {{credits}}</p>
</div>

<p>Login to your panel to see the updated credits and start creating subscriber accounts!</p>
<p>Thank you for your purchase!</p>
""",
                "text_content": "{{credits}} credits added to your reseller panel ({{username}})",
                "available_variables": ["customer_name", "username", "credits"],
                "description": "Sent when credits are added to an existing reseller panel",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

        ]
        await email_templates_collection.insert_many(default_templates)
        logger.info("Default email templates created")
    
    # Initialize lifecycle manager and background jobs
    global lifecycle_manager, background_scheduler
    
    # Get email service for lifecycle manager
    smtp_settings = (await get_settings()).get("smtp", {})
    branding = (await get_settings()).get("branding", {})
    email_svc = get_email_service(smtp_settings, email_logger, unsubscribe_manager, db, branding)
    xtream_svc = get_xtream_service({})  # Will be configured via settings
    
    lifecycle_manager = ServiceLifecycleManager(db, xtream_svc, email_svc)
    
    # Start background job scheduler
    try:
        from scheduler_init import init_scheduler
        background_scheduler = init_scheduler(db, lifecycle_manager, email_svc)
        logger.info("Background job scheduler started")
    except Exception as e:
        logger.error(f"Failed to start background jobs: {str(e)}")
    
    logger.info("IPTV Billing System started successfully!")

# Health check
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# ===== AUTH ROUTES =====

@app.post("/api/auth/register")
async def register(user_data: UserCreate):
    """Register new user with email verification"""
    # Check if email already exists
    existing_user = await users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate verification token
    verification_token = secrets.token_urlsafe(32)
    
    # Create user with email verification
    user_dict = {
        "email": user_data.email,
        "name": user_data.name,
        "password": get_password_hash(user_data.password),
        "role": "user",
        "email_verified": False,
        "verification_token": verification_token,
        "credit_balance": 0.0,
        "referral_code": None,
        "referred_by": user_data.referral_code.upper() if user_data.referral_code else None,
        "created_at": datetime.utcnow()
    }
    
    result = await users_collection.insert_one(user_dict)
    user_id = str(result.inserted_id)
    
    # Generate referral code
    new_user_code = await referral_service.create_referral_code_for_user(user_id)
    
    # Track referral
    if user_data.referral_code:
        await referral_service.track_referral(user_data.referral_code, user_data.email)
    
    # Send verification email
    # Use frontend route for verification to avoid redirect issues
    verification_link = f"{os.getenv('BACKEND_PUBLIC_URL', 'http://localhost:8001')}/verify-email?token={verification_token}"
    
    email_service = await get_configured_email_service()
    if email_service and email_service.enabled:
        await email_service.send_email_verification(
            customer_email=user_data.email,
            customer_name=user_data.name,
            verification_link=verification_link,
            customer_id=user_id
        )
    
    # Send Telegram notification
    await send_telegram_notification(
        "new_user_registration",
        f"🆕 *New User Registration*\n\nName: {user_data.name}\nEmail: {user_data.email}"
    )
    
    return {
        "message": "Registration successful! Please check your email to verify your account.",
        "email": user_data.email,
        "verification_required": True
    }

@app.get("/api/verify-email")
async def verify_email_api(token: str):
    """API endpoint for email verification"""
    user = await users_collection.find_one({"verification_token": token})
    
    if not user:
        raise HTTPException(status_code=404, detail="Invalid or expired verification token")
    
    # Check if already verified
    if user.get("email_verified"):
        return {"message": "Email already verified", "verified": True}
    
    # Verify email
    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "email_verified": True,
                "verification_token": None
            }
        }
    )
    
    # Send welcome email
    email_service = await get_configured_email_service()
    if email_service and email_service.enabled:
        await email_service.send_welcome_email(
            customer_email=user["email"],
            customer_name=user["name"],
            customer_id=str(user["_id"])
        )
    
    # Award signup bonus if referred
    if user.get("referred_by") and credit_service:
        settings = await get_settings()
        referred_reward = settings.get("referral", {}).get("referred_reward", 5.0)
        
        if referred_reward > 0:
            try:
                await credit_service.add_credits(
                    user_id=str(user["_id"]),
                    amount=referred_reward,
                    transaction_type="referral_signup",
                    description="Welcome bonus for using referral code"
                )
            except Exception as e:
                logger.error(f"Failed to award signup bonus: {e}")
    
    return {"message": "Email verified successfully", "verified": True}

@app.get("/verify-email")
async def verify_email(token: str):
    """Legacy redirect endpoint for email verification"""
    try:
        await verify_email_api(token)
        return RedirectResponse(url="/?message=email_verified")
    except:
        return RedirectResponse(url="/?error=invalid_token")

    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_dict["id"],
            "email": user_data.email,
            "name": user_data.name,
            "role": "user"
        }
    }

@app.post("/api/auth/login")
async def login(credentials: UserLogin):
    """Login user - requires email verification and optional reCAPTCHA"""
    # Step 1: Verify reCAPTCHA if enabled
    settings = await get_settings()
    recaptcha_settings = settings.get("recaptcha", {})
    
    if recaptcha_settings.get("enabled") and credentials.recaptcha_token:
        score_threshold = recaptcha_settings.get("customer_score_threshold", 0.5)
        secret_key = recaptcha_settings.get("secret_key")
        
        logger.info(f"reCAPTCHA verification attempt for {credentials.email}")
        logger.info(f"Score threshold: {score_threshold}, Has secret key: {bool(secret_key)}")
        
        if secret_key:
            success, score, response_data = await RecaptchaService.verify_token(
                credentials.recaptcha_token,
                secret_key,
                action="login",
                min_score=score_threshold
            )
            
            logger.info(f"reCAPTCHA result: success={success}, score={score}")
            
            # For development/testing: Allow 0.0 scores (common in test environments)
            # In production, you may want to be stricter
            if not success and score > 0.0:
                logger.warning(f"reCAPTCHA failed for {credentials.email}: score={score}, threshold={score_threshold}")
                raise HTTPException(
                    status_code=403,
                    detail=f"Security verification failed (score: {score}). Please try again."
                )
            elif score == 0.0:
                logger.warning(f"reCAPTCHA score 0.0 for {credentials.email} - allowing (test environment)")
        else:
            logger.warning("reCAPTCHA enabled but no secret key configured")
    elif recaptcha_settings.get("enabled") and not credentials.recaptcha_token:
        logger.warning(f"reCAPTCHA enabled but no token provided for {credentials.email}")
        raise HTTPException(
            status_code=403,
            detail="Security verification required. Please refresh and try again."
        )
    
    # Step 2: Verify credentials
    user = await users_collection.find_one({"email": credentials.email})
    
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Step 3: Check email verification (except for admin)
    if user.get("role") != "admin" and not user.get("email_verified", False):
        raise HTTPException(
            status_code=403, 
            detail="Email not verified. Please check your inbox for the verification link."
        )
    
    # Step 4: Check 2FA for admin users
    if user.get("role") == "admin" and user.get("totp_enabled"):
        if not credentials.totp_code:
            # Return special response indicating 2FA is required
            return {
                "requires_2fa": True,
                "message": "Two-factor authentication required",
                "temp_token": create_access_token(data={
                    "sub": str(user["_id"]),
                    "email": user["email"],
                    "temp": True
                }, expires_delta=timedelta(minutes=5))
            }
        
        # Verify TOTP code
        totp_secret = user.get("totp_secret")
        if not TwoFactorService.verify_totp(totp_secret, credentials.totp_code):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    # Step 5: Create access token
    access_token = create_access_token(data={
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user.get("role", "user")
    })
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "requires_2fa": False,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "user"),
            "email_verified": user.get("email_verified", False),
            "totp_enabled": user.get("totp_enabled", False)
        }
    }

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info"""
    user = await users_collection.find_one({"_id": str_to_objectid(current_user["sub"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user")
    }


# ===== 2FA ROUTES (Admin Only) =====

@app.post("/api/auth/2fa/setup")
async def setup_2fa(current_user: dict = Depends(get_current_admin_user)):
    """Setup 2FA for admin user - generates QR code"""
    user_id = current_user["sub"]
    user = await users_collection.find_one({"_id": str_to_objectid(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Generate new TOTP secret
    secret = TwoFactorService.generate_secret()
    
    # Generate QR code
    qr_code = TwoFactorService.generate_qr_code(
        secret,
        user["email"],
        issuer="IPTV Billing Admin"
    )
    
    # Store secret temporarily (not enabled yet)
    await users_collection.update_one(
        {"_id": str_to_objectid(user_id)},
        {"$set": {"totp_secret_pending": secret}}
    )
    
    return {
        "secret": secret,
        "qr_code": qr_code,
        "message": "Scan this QR code with Google Authenticator and verify to enable 2FA"
    }

@app.post("/api/auth/2fa/verify-setup")
async def verify_2fa_setup(
    totp_code: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Verify 2FA setup by checking TOTP code"""
    user_id = current_user["sub"]
    user = await users_collection.find_one({"_id": str_to_objectid(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    pending_secret = user.get("totp_secret_pending")
    if not pending_secret:
        raise HTTPException(status_code=400, detail="No pending 2FA setup found")
    
    # Verify the TOTP code
    if not TwoFactorService.verify_totp(pending_secret, totp_code):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    # Generate backup codes
    backup_codes = TwoFactorService.get_backup_codes(count=10)
    
    # Enable 2FA and move pending secret to active
    await users_collection.update_one(
        {"_id": str_to_objectid(user_id)},
        {
            "$set": {
                "totp_secret": pending_secret,
                "totp_enabled": True,
                "backup_codes": backup_codes
            },
            "$unset": {"totp_secret_pending": ""}
        }
    )
    
    return {
        "message": "2FA enabled successfully",
        "backup_codes": backup_codes
    }

@app.post("/api/auth/2fa/disable")
async def disable_2fa(
    password: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Disable 2FA for admin user (requires password confirmation)"""
    user_id = current_user["sub"]
    user = await users_collection.find_one({"_id": str_to_objectid(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify password
    if not verify_password(password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Disable 2FA
    await users_collection.update_one(
        {"_id": str_to_objectid(user_id)},
        {
            "$set": {"totp_enabled": False},
            "$unset": {"totp_secret": "", "backup_codes": ""}
        }
    )
    
    return {"message": "2FA disabled successfully"}

@app.get("/api/auth/2fa/status")
async def get_2fa_status(current_user: dict = Depends(get_current_admin_user)):
    """Get 2FA status for current admin user"""
    user_id = current_user["sub"]
    user = await users_collection.find_one({"_id": str_to_objectid(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "enabled": user.get("totp_enabled", False),
        "has_backup_codes": bool(user.get("backup_codes"))
    }

# ===== RECAPTCHA SETTINGS ROUTES =====

@app.get("/api/recaptcha/sitekey")
async def get_recaptcha_sitekey():
    """Get reCAPTCHA site key (public endpoint)"""
    settings = await get_settings()
    recaptcha = settings.get("recaptcha", {})
    
    return {
        "site_key": recaptcha.get("site_key", ""),
        "enabled": recaptcha.get("enabled", False)
    }


# ===== PRODUCT ROUTES =====

@app.get("/api/products")
async def get_products():
    """Get all active products sorted by display_order"""
    products = []
    async for product in products_collection.find({"active": True}).sort([("display_order", 1), ("created_at", 1)]):
        product["id"] = str(product["_id"])
        del product["_id"]
        products.append(product)
    return products

@app.get("/api/products/{product_id}")
async def get_product(product_id: str):
    """Get single product"""
    product = await products_collection.find_one({"_id": str_to_objectid(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product["id"] = str(product["_id"])
    del product["_id"]
    return product

# ===== ORDER ROUTES =====



# ===== PAYPAL ROUTES =====

@app.post("/api/orders/{order_id}/pay/paypal")
async def create_paypal_payment(order_id: str, origin: dict, current_user: dict = Depends(get_current_user)):
    """Create PayPal payment for order"""
    user_id = current_user["sub"]
    
    # Get order
    order = await orders_collection.find_one({
        "_id": str_to_objectid(order_id),
        "user_id": user_id
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    # Get PayPal settings
    settings = await get_settings()
    paypal_settings = settings.get("paypal", {})
    
    if not paypal_settings.get("enabled"):
        raise HTTPException(status_code=400, detail="PayPal not enabled")
    
    from paypal_service import get_paypal_service
    paypal = get_paypal_service(paypal_settings)
    
    if not paypal:
        raise HTTPException(status_code=500, detail="PayPal service not available")
    
    # Get frontend URL from origin
    frontend_url = origin.get("origin", "http://localhost:3000")
    
    # Create payment with frontend URLs
    result = paypal.create_order(
        amount=order["total"],
        return_url=f"{frontend_url}/payment/paypal/success?order_id={order_id}",
        cancel_url=f"{frontend_url}/checkout?payment=cancelled",
        order_id=order_id
    )
    
    if result["success"]:
        return {"success": True, "order_id": result["order_id"]}  # Return EC-XXX token
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Payment creation failed"))


@app.post("/api/orders/paypal/capture")
async def capture_paypal_order(data: dict, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Capture PayPal order after approval"""
    order_id = data.get("order_id")
    paypal_order_id = data.get("paypal_order_id")
    
    # Get PayPal settings
    settings = await get_settings()
    paypal_settings = settings.get("paypal", {})
    
    from paypal_service import get_paypal_service
    paypal = get_paypal_service(paypal_settings)
    
    if not paypal:
        raise HTTPException(status_code=500, detail="PayPal service not available")
    
    # Capture payment
    result = paypal.capture_order(paypal_order_id)
    
    if result["success"] and result["status"] == "COMPLETED":
        # Get order
        order = await orders_collection.find_one({"_id": str_to_objectid(order_id)})
        
        if order and order["status"] != "paid":
            # Mark order as paid
            await orders_collection.update_one(
                {"_id": str_to_objectid(order_id)},
                {"$set": {"status": "paid", "paid_at": datetime.utcnow(), "payment_method": "paypal", "payment_id": paypal_order_id}}
            )
            
            # Update invoice
            await invoices_collection.update_one(
                {"order_id": order_id},
                {"$set": {"status": "paid", "paid_date": datetime.utcnow()}}
            )
            
            # Get user
            user = await users_collection.find_one({"_id": str_to_objectid(order["user_id"])})
            
            # Provision services
            background_tasks.add_task(provision_order_services, order_id, order, user)
            
            return {"success": True, "message": "Payment captured successfully"}
    
    raise HTTPException(status_code=500, detail="Payment capture failed")

@app.get("/api/orders/{order_id}/pay/paypal/success")
async def paypal_success(order_id: str, paymentId: str, PayerID: str, background_tasks: BackgroundTasks):
    """Handle PayPal payment success"""
    settings = await get_settings()
    paypal_settings = settings.get("paypal", {})
    
    from paypal_service import get_paypal_service
    paypal = get_paypal_service(paypal_settings)
    
    if not paypal:
        return {"error": "PayPal not configured"}
    
    # Execute payment
    result = paypal.execute_payment(paymentId, PayerID)
    
    if result["success"] and result["state"] == "approved":
        # Get order
        order = await orders_collection.find_one({"_id": str_to_objectid(order_id)})
        
        if order:
            # Mark order as paid
            await orders_collection.update_one(
                {"_id": str_to_objectid(order_id)},
                {"$set": {"status": "paid", "paid_at": datetime.utcnow(), "payment_method": "paypal", "payment_id": paymentId}}
            )
            
            # Update invoice
            await invoices_collection.update_one(
                {"order_id": order_id},
                {"$set": {"status": "paid", "paid_date": datetime.utcnow()}}
            )
            
            # Get user
            user = await users_collection.find_one({"_id": str_to_objectid(order["user_id"])})
            
            # Provision services
            background_tasks.add_task(provision_order_services, order_id, order, user)
            
            # Redirect to success page
            frontend_url = os.getenv("REACT_APP_BACKEND_URL", "http://localhost:3000").replace(":8001", ":3000")
            return RedirectResponse(url=f"{frontend_url}/orders?payment=success")
    
    return {"error": "Payment failed"}

@app.get("/api/orders/{order_id}/pay/paypal/cancel")
async def paypal_cancel(order_id: str):
    """Handle PayPal payment cancellation"""
    frontend_url = os.getenv("REACT_APP_BACKEND_URL", "http://localhost:3000").replace(":8001", ":3000")
    return RedirectResponse(url=f"{frontend_url}/orders?payment=cancelled")

@app.post("/api/webhooks/paypal")
async def paypal_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle PayPal webhooks"""
    data = await request.json()
    logger.info(f"PayPal webhook received: {data.get('event_type')}")


# ===== STRIPE/CRYPTO ROUTES =====

@app.post("/api/orders/{order_id}/pay/stripe")
async def create_stripe_payment(order_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Create Stripe/Crypto payment session for order"""
    user_id = current_user["sub"]
    
    # Get order
    order = await orders_collection.find_one({
        "_id": str_to_objectid(order_id),
        "user_id": user_id
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    # Get Stripe settings
    settings = await get_settings()
    stripe_settings = settings.get("stripe", {})
    
    if not stripe_settings.get("enabled"):
        raise HTTPException(status_code=400, detail="Stripe not enabled")
    
    # Get base URL from request
    base_url = str(request.base_url).rstrip('/')
    webhook_url = f"{base_url}/api/webhooks/stripe"
    
    from stripe_service import get_stripe_service
    stripe = get_stripe_service(stripe_settings, webhook_url)
    
    if not stripe:
        raise HTTPException(status_code=500, detail="Stripe service not available")
    
    # Get frontend URL for redirects
    frontend_url = base_url.replace(':8001', ':3000') if ':8001' in base_url else base_url
    
    # Create payment session
    # Note: {CHECKOUT_SESSION_ID} is a Stripe placeholder that gets replaced with actual session ID
    result = await stripe.create_payment_session(
        amount=order["total"],
        order_id=order_id,
        success_url=f"{frontend_url}/checkout?payment=success&session_id={{CHECKOUT_SESSION_ID}}&order_id={order_id}",
        cancel_url=f"{frontend_url}/checkout?payment=cancelled",
        crypto_enabled=stripe_settings.get("crypto_enabled", True)
    )
    
    if result["success"]:
        # Store payment transaction for tracking
        await db.payment_transactions.insert_one({
            "order_id": order_id,
            "user_id": user_id,
            "gateway": "stripe",
            "session_id": result["session_id"],
            "amount": order["total"],
            "currency": "usd",
            "payment_status": "pending",
            "created_at": datetime.utcnow()
        })
        return {"success": True, "session_id": result["session_id"], "checkout_url": result["checkout_url"]}
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Payment creation failed"))

@app.get("/api/payments/stripe/success")
async def stripe_payment_success(session_id: str, order_id: str, background_tasks: BackgroundTasks):
    """Handle Stripe payment success - check status and redirect"""
    settings = await get_settings()
    stripe_settings = settings.get("stripe", {})
    
    base_url = os.getenv("REACT_APP_BACKEND_URL", "http://localhost:8001")
    webhook_url = f"{base_url}/api/webhooks/stripe"
    frontend_url = base_url.replace(':8001', ':3000') if ':8001' in base_url else base_url
    
    from stripe_service import get_stripe_service
    stripe = get_stripe_service(stripe_settings, webhook_url)
    
    if stripe:
        result = await stripe.get_payment_status(session_id)
        
        if result["success"] and result["payment_status"] == "paid":
            # Mark order as paid
            order = await orders_collection.find_one({"_id": str_to_objectid(order_id)})
            
            if order and order["status"] != "paid":
                await orders_collection.update_one(
                    {"_id": str_to_objectid(order_id)},
                    {"$set": {"status": "paid", "paid_at": datetime.utcnow(), "payment_method": "stripe", "payment_id": session_id}}
                )
                
                await invoices_collection.update_one(
                    {"order_id": order_id},
                    {"$set": {"status": "paid", "paid_date": datetime.utcnow()}}
                )
                
                user = await users_collection.find_one({"_id": str_to_objectid(order["user_id"])})
                background_tasks.add_task(provision_order_services, order_id, order, user)
    
    # Redirect to orders page
    return RedirectResponse(url=f"{frontend_url}/orders?payment=success")

@app.get("/api/payments/stripe/status/{session_id}")
async def check_stripe_payment_status(session_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Check Stripe payment status"""
    settings = await get_settings()
    stripe_settings = settings.get("stripe", {})
    
    base_url = os.getenv("REACT_APP_BACKEND_URL", "http://localhost:8001")
    webhook_url = f"{base_url}/api/webhooks/stripe"
    
    from stripe_service import get_stripe_service
    stripe = get_stripe_service(stripe_settings, webhook_url)
    
    if not stripe:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Get payment status
    result = await stripe.get_payment_status(session_id)
    
    if result["success"] and result["payment_status"] == "paid":
        # Find payment transaction
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        
        if transaction and transaction.get("payment_status") != "completed":
            # Mark as completed (idempotent)
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "completed", "updated_at": datetime.utcnow()}}
            )
            
            # Get order
            order_id = transaction["order_id"]
            order = await orders_collection.find_one({"_id": str_to_objectid(order_id)})
            
            if order and order["status"] != "paid":
                # Mark order as paid
                await orders_collection.update_one(
                    {"_id": str_to_objectid(order_id)},
                    {"$set": {"status": "paid", "paid_at": datetime.utcnow(), "payment_method": "stripe", "payment_id": session_id}}
                )
                
                # Update invoice
                await invoices_collection.update_one(
                    {"order_id": order_id},
                    {"$set": {"status": "paid", "paid_date": datetime.utcnow()}}
                )
                
                # Get user
                user = await users_collection.find_one({"_id": str_to_objectid(order["user_id"])})
                
                # Provision services
                background_tasks.add_task(provision_order_services, order_id, order, user)
    
    return result

@app.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request, background_tasks: BackgroundTasks):
    """Handle Stripe webhooks"""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    
    settings = await get_settings()
    stripe_settings = settings.get("stripe", {})
    
    base_url = str(request.base_url).rstrip('/')


# ===== SQUARE ROUTES =====

@app.post("/api/orders/{order_id}/pay/square")
async def create_square_payment(order_id: str, data: dict, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Create Square payment for order"""
    user_id = current_user["sub"]
    source_id = data.get("source_id")  # Square payment token
    
    if not source_id:
        raise HTTPException(status_code=400, detail="Payment token required")
    
    # Get order
    order = await orders_collection.find_one({
        "_id": str_to_objectid(order_id),
        "user_id": user_id
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    # Get user
    user = await users_collection.find_one({"_id": str_to_objectid(user_id)})
    
    # Get Square settings
    settings = await get_settings()
    square_settings = settings.get("square", {})
    
    if not square_settings.get("enabled"):
        raise HTTPException(status_code=400, detail="Square not enabled")
    
    from square_service import get_square_service
    square = get_square_service(square_settings)
    
    if not square:
        raise HTTPException(status_code=500, detail="Square service not available")
    
    # Create payment
    result = await square.create_payment(
        amount=order["total"],
        source_id=source_id,
        order_id=order_id,
        customer_email=user.get("email", "")
    )
    
    if result["success"] and result["status"] == "COMPLETED":
        # Mark order as paid
        await orders_collection.update_one(
            {"_id": str_to_objectid(order_id)},
            {"$set": {"status": "paid", "paid_at": datetime.utcnow(), "payment_method": "square", "payment_id": result["payment_id"]}}
        )
        
        # Update invoice
        await invoices_collection.update_one(
            {"order_id": order_id},
            {"$set": {"status": "paid", "paid_date": datetime.utcnow()}}
        )
        
        # Provision services
        background_tasks.add_task(provision_order_services, order_id, order, user)
        
        return {"success": True, "payment_id": result["payment_id"], "receipt_url": result.get("receipt_url")}
    
    raise HTTPException(status_code=500, detail=result.get("error", "Payment failed"))

# ===== BLOCKONOMICS (BITCOIN) ROUTES =====

@app.post("/api/orders/{order_id}/pay/blockonomics")
async def create_blockonomics_payment(order_id: str, current_user: dict = Depends(get_current_user)):
    """Create Bitcoin payment via Blockonomics for order"""
    user_id = current_user["sub"]
    
    # Get order
    order = await orders_collection.find_one({
        "_id": str_to_objectid(order_id),
        "user_id": user_id
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    # Get Blockonomics settings
    settings = await get_settings()
    blockonomics_settings = settings.get("blockonomics", {})
    
    if not blockonomics_settings.get("enabled"):
        raise HTTPException(status_code=400, detail="Bitcoin payments not enabled")
    
    # Build callback URL for webhook - use PUBLIC_URL for production
    public_url = os.getenv("PUBLIC_URL", "https://iptv-panel-9.preview.emergentagent.com")
    callback_url = f"{public_url}/api/webhooks/blockonomics"
    
    from blockonomics_service import get_blockonomics_service
    blockonomics = get_blockonomics_service(blockonomics_settings, callback_url)
    
    if not blockonomics:
        raise HTTPException(status_code=500, detail="Blockonomics service not available")
    
    # Get current BTC price
    price_result = await blockonomics.get_btc_price("USD")
    if not price_result.get("success"):
        raise HTTPException(status_code=500, detail="Failed to fetch BTC price")
    
    btc_price = price_result["price"]
    
    # Convert USD to satoshis
    amount_satoshis = blockonomics.convert_usd_to_satoshis(order["total"], btc_price)
    amount_btc = blockonomics.convert_satoshis_to_btc(amount_satoshis)
    
    # Get new Bitcoin address
    address_result = await blockonomics.get_new_address()
    if not address_result.get("success"):
        error_msg = address_result.get("error", "Failed to generate Bitcoin address")
        # Provide helpful error message for common setup issues
        if "match_callback" in error_msg.lower() or "store" in error_msg.lower():
            error_msg = "Blockonomics setup incomplete. Please create a Store in your Blockonomics dashboard and set the HTTP Callback URL to: " + callback_url
        raise HTTPException(status_code=500, detail=error_msg)
    
    btc_address = address_result["address"]
    
    # Store payment transaction
    await db.payment_transactions.insert_one({
        "order_id": order_id,
        "user_id": user_id,
        "gateway": "blockonomics",
        "btc_address": btc_address,
        "amount_usd": order["total"],
        "amount_satoshis": amount_satoshis,
        "amount_btc": amount_btc,
        "btc_price_at_creation": btc_price,
        "payment_status": "pending",
        "confirmations": 0,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=30)
    })
    
    logger.info(f"Blockonomics payment created: {btc_address} for order {order_id}, amount: {amount_btc} BTC")
    
    return {
        "success": True,
        "btc_address": btc_address,
        "amount_satoshis": amount_satoshis,
        "amount_btc": amount_btc,
        "amount_usd": order["total"],
        "btc_price": btc_price,
        "expires_in_minutes": 30,
        "qr_data": f"bitcoin:{btc_address}?amount={amount_btc}"
    }

@app.get("/api/payments/blockonomics/status/{order_id}")
async def check_blockonomics_payment_status(order_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Check Bitcoin payment status for an order"""
    user_id = current_user["sub"]
    
    # Find payment transaction
    transaction = await db.payment_transactions.find_one({
        "order_id": order_id,
        "gateway": "blockonomics"
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Get Blockonomics settings
    settings = await get_settings()
    blockonomics_settings = settings.get("blockonomics", {})
    confirmations_required = blockonomics_settings.get("confirmations_required", 1)
    
    # Build callback URL for webhook - use PUBLIC_URL for production
    public_url = os.getenv("PUBLIC_URL", "https://iptv-panel-9.preview.emergentagent.com")
    callback_url = f"{public_url}/api/webhooks/blockonomics"
    
    from blockonomics_service import get_blockonomics_service
    blockonomics = get_blockonomics_service(blockonomics_settings, callback_url)
    
    if not blockonomics:
        raise HTTPException(status_code=500, detail="Blockonomics service not available")
    
    btc_address = transaction["btc_address"]
    
    # Check address balance
    balance_result = await blockonomics.get_address_balance(btc_address)
    
    confirmed_satoshis = balance_result.get("confirmed", 0)
    unconfirmed_satoshis = balance_result.get("unconfirmed", 0)
    total_received = confirmed_satoshis + unconfirmed_satoshis
    
    # Get transaction history for confirmations
    history_result = await blockonomics.get_address_history(btc_address)
    transactions = history_result.get("transactions", [])
    
    # Determine payment status
    expected_satoshis = transaction["amount_satoshis"]
    payment_status = "pending"
    confirmations = 0
    txid = None
    
    if transactions:
        # Get the latest transaction
        latest_tx = transactions[0] if transactions else None
        if latest_tx:
            txid = latest_tx.get("txid")
            confirmations = 1 if latest_tx.get("status") == "confirmed" else 0
    
    # Check if we received enough (allowing 2% variance for network fees)
    if total_received >= expected_satoshis * 0.98:
        if confirmed_satoshis >= expected_satoshis * 0.98:
            payment_status = "confirmed"
            confirmations = max(confirmations, 1)
        else:
            payment_status = "unconfirmed"
    
    # Update transaction record
    await db.payment_transactions.update_one(
        {"_id": transaction["_id"]},
        {"$set": {
            "payment_status": payment_status,
            "confirmations": confirmations,
            "received_satoshis": total_received,
            "txid": txid,
            "updated_at": datetime.utcnow()
        }}
    )
    
    # If payment is confirmed with enough confirmations, mark order as paid
    if payment_status == "confirmed" and confirmations >= confirmations_required:
        order = await orders_collection.find_one({"_id": str_to_objectid(order_id)})
        
        if order and order["status"] != "paid":
            await orders_collection.update_one(
                {"_id": str_to_objectid(order_id)},
                {"$set": {
                    "status": "paid",
                    "paid_at": datetime.utcnow(),
                    "payment_method": "blockonomics",
                    "payment_id": txid
                }}
            )
            
            # Update invoice
            await invoices_collection.update_one(
                {"order_id": order_id},
                {"$set": {"status": "paid", "paid_date": datetime.utcnow()}}
            )
            
            # Provision services
            user = await users_collection.find_one({"_id": str_to_objectid(order["user_id"])})
            background_tasks.add_task(provision_order_services, order_id, order, user)
            
            logger.info(f"Blockonomics payment confirmed for order {order_id}, txid: {txid}")
    
    return {
        "success": True,
        "payment_status": payment_status,
        "confirmations": confirmations,
        "confirmations_required": confirmations_required,
        "amount_expected_satoshis": expected_satoshis,
        "amount_received_satoshis": total_received,
        "amount_expected_btc": transaction["amount_btc"],
        "amount_received_btc": blockonomics.convert_satoshis_to_btc(total_received) if blockonomics else 0,
        "btc_address": btc_address,
        "txid": txid
    }

@app.post("/api/webhooks/blockonomics")
async def blockonomics_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Handle Blockonomics payment webhooks.
    Blockonomics sends: status (0=unconfirmed, 1=partially confirmed, 2=confirmed), addr, value, txid
    """
    try:
        # Get webhook data (can be form data or JSON)
        content_type = request.headers.get("content-type", "")
        
        if "application/json" in content_type:
            payload = await request.json()
        else:
            form = await request.form()
            payload = dict(form)
        
        btc_address = payload.get("addr")
        status_code = int(payload.get("status", -1))
        txid = payload.get("txid")
        value_satoshis = int(payload.get("value", 0))
        
        logger.info(f"Blockonomics webhook: address={btc_address}, status={status_code}, value={value_satoshis}, txid={txid}")
        
        if not btc_address:
            return {"status": "error", "message": "Missing address"}
        
        # Find payment transaction by address
        transaction = await db.payment_transactions.find_one({
            "btc_address": btc_address,
            "gateway": "blockonomics"
        })
        
        if not transaction:
            logger.warning(f"Blockonomics webhook: Payment not found for address {btc_address}")
            return {"status": "ok", "message": "Payment not found"}
        
        order_id = transaction["order_id"]
        
        # Determine payment status
        # Status codes: 0=unconfirmed, 1=partial confirm, 2=confirmed (2+ confirmations)
        payment_status = "pending"
        if status_code == 0:
            payment_status = "unconfirmed"
        elif status_code >= 1:
            payment_status = "confirmed"
        
        # Update transaction
        await db.payment_transactions.update_one(
            {"_id": transaction["_id"]},
            {"$set": {
                "payment_status": payment_status,
                "confirmations": status_code,
                "received_satoshis": value_satoshis,
                "txid": txid,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Get settings for confirmation threshold
        settings = await get_settings()
        blockonomics_settings = settings.get("blockonomics", {})
        confirmations_required = blockonomics_settings.get("confirmations_required", 1)
        
        # If payment confirmed, mark order as paid
        if status_code >= confirmations_required:
            order = await orders_collection.find_one({"_id": str_to_objectid(order_id)})
            
            if order and order["status"] != "paid":
                # Check amount received is sufficient
                expected_satoshis = transaction["amount_satoshis"]
                if value_satoshis >= expected_satoshis * 0.98:  # Allow 2% variance
                    await orders_collection.update_one(
                        {"_id": str_to_objectid(order_id)},
                        {"$set": {
                            "status": "paid",
                            "paid_at": datetime.utcnow(),
                            "payment_method": "blockonomics",
                            "payment_id": txid
                        }}
                    )
                    
                    await invoices_collection.update_one(
                        {"order_id": order_id},
                        {"$set": {"status": "paid", "paid_date": datetime.utcnow()}}
                    )
                    
                    # Provision services
                    user = await users_collection.find_one({"_id": str_to_objectid(order["user_id"])})
                    background_tasks.add_task(provision_order_services, order_id, order, user)
                    
                    logger.info(f"Blockonomics webhook: Order {order_id} marked as paid, txid: {txid}")
                else:
                    logger.warning(f"Blockonomics webhook: Insufficient payment for order {order_id}. Expected: {expected_satoshis}, Received: {value_satoshis}")
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Blockonomics webhook error: {e}")
        return {"status": "error", "message": str(e)}

    webhook_url = f"{base_url}/api/webhooks/stripe"
    
    from stripe_service import get_stripe_service
    stripe = get_stripe_service(stripe_settings, webhook_url)
    
    if stripe:
        result = await stripe.handle_webhook(body, signature)
        
        if result["success"] and result["payment_status"] == "paid":
            session_id = result["session_id"]
            # Process payment (same as status check above)
            # ...
    
    return {"status": "received"}

    
    # Handle payment capture completion
    if data.get("event_type") == "PAYMENT.CAPTURE.COMPLETED":
        # Extract order info and process
        pass
    
    return {"status": "received"}

@app.post("/api/orders")
async def create_order(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
    """Create new order with coupon and credit support"""
    user_id = current_user["sub"]
    
    # Calculate pricing
    subtotal = order_data.total
    discount_amount = 0.0
    credits_used = 0.0
    
    # Apply coupon if provided
    if order_data.coupon_code:
        product_ids = [item.product_id for item in order_data.items]
        coupon_result = await coupon_service.validate_coupon(
            order_data.coupon_code,
            subtotal,
            product_ids
        )
        
        if not coupon_result["valid"]:
            raise HTTPException(status_code=400, detail=coupon_result["error"])
        
        discount_amount = coupon_result["discount"]
    
    # Calculate total after discount
    total_after_discount = subtotal - discount_amount
    
    # Apply credits if requested
    if order_data.use_credits > 0:
        user_balance = await credit_service.get_balance(user_id)
        
        # Can't use more credits than available or more than order total
        credits_to_use = min(order_data.use_credits, user_balance, total_after_discount)
        credits_used = credits_to_use
    
    # Final total
    final_total = max(0, total_after_discount - credits_used)
    
    # Create order
    order_dict = {
        "user_id": user_id,
        "items": [item.dict() for item in order_data.items],
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "coupon_code": order_data.coupon_code.upper() if order_data.coupon_code else None,
        "credits_used": credits_used,
        "total": final_total,
        "reseller_credentials": order_data.reseller_credentials,  # Save custom credentials
        "status": "pending",
        "payment_method": "manual",
        "created_at": datetime.utcnow(),
        "paid_at": None
    }
    
    result = await orders_collection.insert_one(order_dict)
    order_id = str(result.inserted_id)
    
    # Record coupon usage
    if order_data.coupon_code and discount_amount > 0:
        await coupon_service.apply_coupon(
            order_data.coupon_code,
            user_id,
            order_id,
            discount_amount
        )
    
    # Deduct credits if used
    if credits_used > 0:
        await credit_service.deduct_credits(
            user_id=user_id,
            amount=credits_used,
            transaction_type="order_payment",
            description=f"Credits used for order #{order_id[:8]}",
            order_id=order_id
        )
    
    # Create invoice
    invoice_dict = {
        "order_id": order_id,
        "user_id": user_id,
        "invoice_number": f"INV-{datetime.utcnow().strftime('%Y%m%d')}-{random.randint(1000, 9999)}",
        "total": final_total,
        "status": "unpaid" if final_total > 0 else "paid",  # If fully paid with credits
        "due_date": datetime.utcnow() + timedelta(days=7),
        "paid_date": datetime.utcnow() if final_total == 0 else None,
        "pdf_path": None,
        "created_at": datetime.utcnow()
    }
    
    invoice_result = await invoices_collection.insert_one(invoice_dict)
    invoice_id = str(invoice_result.inserted_id)
    
    # Send "New Order" Telegram notification
    user = await users_collection.find_one({"_id": str_to_objectid(user_id)})
    order_items_text = "\n".join([f"- {item.product_name} (${item.price})" for item in order_data.items])
    await send_telegram_notification(
        "new_order",
        f"🛒 *New Order Created*\n\nCustomer: {user.get('name', 'Unknown')}\nEmail: {user.get('email', 'N/A')}\nTotal: ${final_total:.2f}\n\nItems:\n{order_items_text}"
    )
    
    # If fully paid with credits, mark order as paid and provision service
    if final_total == 0:
        await orders_collection.update_one(
            {"_id": str_to_objectid(order_id)},
            {"$set": {"status": "paid", "paid_at": datetime.utcnow()}}
        )
        
        # TODO: Auto-provision service
        logger.info(f"Order {order_id} fully paid with credits - auto-provisioning")
    
    return {
        "order_id": order_id,
        "invoice_id": invoice_id,
        "status": "paid" if final_total == 0 else "pending",
        "subtotal": subtotal,
        "discount": discount_amount,
        "credits_used": credits_used,
        "total": final_total,
        "message": "Order created successfully." + (" Paid with credits!" if final_total == 0 else " Please proceed to payment.")
    }

@app.get("/api/orders")
async def get_orders(current_user: dict = Depends(get_current_user)):
    """Get user orders"""
    user_id = current_user["sub"]
    orders = []
    
    async for order in orders_collection.find({"user_id": user_id}).sort("created_at", -1):
        order["id"] = str(order["_id"])
        del order["_id"]
        orders.append(order)
    
    return orders

@app.get("/api/orders/{order_id}")
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Get single order"""
    user_id = current_user["sub"]
    order = await orders_collection.find_one({
        "_id": str_to_objectid(order_id),
        "user_id": user_id
    })
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order["id"] = str(order["_id"])
    del order["_id"]
    return order

# ===== SERVICE ROUTES =====

@app.get("/api/services")
async def get_services(current_user: dict = Depends(get_current_user)):
    """Get user services with product setup instructions"""
    user_id = current_user["sub"]
    services = []
    
    async for service in services_collection.find({"user_id": user_id}).sort("created_at", -1):
        service["id"] = str(service["_id"])
        del service["_id"]
        
        # Get product details to include setup instructions
        if service.get("product_id"):
            product = await products_collection.find_one({"_id": str_to_objectid(service["product_id"])})
            if product:
                service["setup_instructions"] = product.get("setup_instructions", "")
        
        services.append(service)
    
    return services

@app.get("/api/services/{service_id}")
async def get_service(service_id: str, current_user: dict = Depends(get_current_user)):
    """Get single service"""
    user_id = current_user["sub"]
    service = await services_collection.find_one({
        "_id": str_to_objectid(service_id),
        "user_id": user_id
    })
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    service["id"] = str(service["_id"])
    del service["_id"]
    return service

# ===== INVOICE ROUTES =====

@app.get("/api/invoices")
async def get_invoices(current_user: dict = Depends(get_current_user)):
    """Get user invoices"""
    user_id = current_user["sub"]
    invoices = []
    
    async for invoice in invoices_collection.find({"user_id": user_id}).sort("created_at", -1):
        invoice["id"] = str(invoice["_id"])
        del invoice["_id"]
        invoices.append(invoice)
    
    return invoices

@app.get("/api/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: str, current_user: dict = Depends(get_current_user)):
    """Download invoice PDF"""
    user_id = current_user["sub"]
    is_admin = current_user.get("role") == "admin"
    
    # Build query - admin can access any invoice, users only their own
    query = {"_id": str_to_objectid(invoice_id)}
    if not is_admin:
        query["user_id"] = user_id
    
    invoice = await invoices_collection.find_one(query)
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Generate PDF if not exists
    if not invoice.get("pdf_path") or not os.path.exists(invoice["pdf_path"]):
        # Get order and user info (use invoice's user_id, not current user)
        order = await orders_collection.find_one({"_id": str_to_objectid(invoice["order_id"])})
        user = await users_collection.find_one({"_id": str_to_objectid(invoice["user_id"])})
        settings = await get_settings()
        
        invoice_data = {
            "invoice_number": invoice["invoice_number"],
            "created_at": invoice["created_at"].strftime("%Y-%m-%d"),
            "due_date": invoice["due_date"].strftime("%Y-%m-%d"),
            "order_id": invoice["order_id"],
            "status": invoice["status"],
            "customer_name": user["name"],
            "customer_email": user["email"],
            "items": order["items"],
            "total": invoice["total"],
            "company_name": settings.get("company_name", "IPTV Billing"),
            "company_email": settings.get("company_email", "support@example.com")
        }
        
        invoice_generator = get_invoice_generator()
        pdf_path = invoice_generator.generate_invoice(invoice_data)
        
        # Update invoice with PDF path
        await invoices_collection.update_one(
            {"_id": str_to_objectid(invoice_id)},
            {"$set": {"pdf_path": pdf_path}}
        )
    else:
        pdf_path = invoice["pdf_path"]
    
    # Return the PDF file
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"invoice_{invoice['invoice_number']}.pdf")


# ===== TICKET ROUTES =====

@app.post("/api/tickets")
async def create_ticket(ticket_data: TicketCreate, current_user: dict = Depends(get_current_user)):
    """Create a support ticket"""
    user_id = current_user["sub"]
    
    # Get service name if service_id provided
    service_name = None
    if ticket_data.service_id:
        service = await services_collection.find_one({"_id": str_to_objectid(ticket_data.service_id)})
        if service:
            service_name = service.get("product_name")
    
    ticket_dict = {
        "user_id": user_id,
        "subject": ticket_data.subject,
        "status": "open",
        "priority": ticket_data.priority,
        "service_id": ticket_data.service_id,
        "service_name": service_name,
        "messages": [{
            "message": ticket_data.message,
            "is_admin": False,
            "created_at": datetime.utcnow()
        }],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await tickets_collection.insert_one(ticket_dict)
    ticket_dict["id"] = str(result.inserted_id)
    
    # Get user info for notification
    user = await users_collection.find_one({"_id": str_to_objectid(user_id)})
    
    # Send "New Support Ticket" Telegram notification
    await send_telegram_notification(
        "new_support_ticket",
        f"🎫 *New Support Ticket*\n\nFrom: {user.get('name', 'Unknown')}\nEmail: {user.get('email', 'N/A')}\nSubject: {ticket_data.subject}\nPriority: {ticket_data.priority}\n\nMessage:\n{ticket_data.message[:200]}..."
    )
    
    return {"message": "Ticket created successfully", "ticket_id": ticket_dict["id"]}

@app.get("/api/tickets")
async def get_tickets(current_user: dict = Depends(get_current_user)):
    """Get user's tickets"""
    user_id = current_user["sub"]
    tickets = []
    
    async for ticket in tickets_collection.find({"user_id": user_id}).sort("created_at", -1):
        ticket["id"] = str(ticket["_id"])
        del ticket["_id"]
        tickets.append(ticket)
    
    return tickets

@app.get("/api/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    """Get single ticket"""
    user_id = current_user["sub"]
    ticket = await tickets_collection.find_one({
        "_id": str_to_objectid(ticket_id),
        "user_id": user_id
    })
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket["id"] = str(ticket["_id"])
    del ticket["_id"]
    return ticket

@app.get("/api/admin/tickets")
async def get_all_tickets(current_user: dict = Depends(get_current_admin_user)):
    """Get all support tickets"""
    tickets = []
    
    async for ticket in tickets_collection.find().sort("created_at", -1):
        user = await users_collection.find_one({"_id": str_to_objectid(ticket["user_id"])})
        
        ticket["id"] = str(ticket["_id"])
        ticket["customer_name"] = user["name"] if user else "Unknown"
        ticket["customer_email"] = user["email"] if user else "Unknown"
        del ticket["_id"]
        tickets.append(ticket)
    
    return tickets

@app.post("/api/admin/tickets/{ticket_id}/reply")
async def reply_to_ticket(ticket_id: str, reply: dict, current_user: dict = Depends(get_current_admin_user)):
    """Add admin reply to ticket"""
    ticket = await tickets_collection.find_one({"_id": str_to_objectid(ticket_id)})
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    new_message = {
        "message": reply["message"],
        "is_admin": True,
        "created_at": datetime.utcnow()
    }
    
    new_status = reply.get("status", ticket.get("status", "in_progress"))
    
    await tickets_collection.update_one(
        {"_id": str_to_objectid(ticket_id)},
        {
            "$push": {"messages": new_message},
            "$set": {
                "status": new_status,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Get customer info for notification
    user = await users_collection.find_one({"_id": str_to_objectid(ticket["user_id"])})
    
    # Send "Ticket Reply" Telegram notification
    await send_telegram_notification(
        "ticket_reply",
        f"💬 *Ticket Reply*\n\nTicket: #{ticket_id[:8]}...\nSubject: {ticket.get('subject', 'N/A')}\nCustomer: {user.get('name', 'Unknown') if user else 'Unknown'}\n\nAdmin replied:\n{reply['message'][:200]}..."
    )
    
    return {"message": "Ticket status updated"}


@app.post("/api/admin/customers/{customer_id}/change-password")
async def admin_change_customer_password(
    customer_id: str,
    new_password: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Admin changes a customer's password"""
    user = await users_collection.find_one({"_id": str_to_objectid(customer_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Hash the new password
    hashed_password = get_password_hash(new_password)
    
    # Update password
    await users_collection.update_one(
        {"_id": str_to_objectid(customer_id)},
        {"$set": {"password": hashed_password}}
    )
    
    logger.info(f"Admin {current_user['sub']} changed password for user {customer_id}")
    
    return {"message": "Password changed successfully"}



class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@app.post("/api/admin/change-password")
async def admin_change_own_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_admin_user)
):
    """Admin changes their own password"""
    admin_id = current_user["sub"]
    
    # Get admin user
    admin = await users_collection.find_one({"_id": str_to_objectid(admin_id)})
    
    if not admin:
        raise HTTPException(status_code=404, detail="Admin user not found")
    
    # Verify current password
    if not verify_password(request.current_password, admin["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password
    hashed_password = get_password_hash(request.new_password)
    
    # Update password
    await users_collection.update_one(
        {"_id": str_to_objectid(admin_id)},
        {"$set": {"password": hashed_password}}
    )
    
    logger.info(f"Admin {admin_id} changed their own password")
    
    return {"message": "Password changed successfully. Please login again."}

@app.put("/api/admin/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, status_update: dict, current_user: dict = Depends(get_current_admin_user)):
    """Update ticket status"""
    ticket = await tickets_collection.find_one({"_id": str_to_objectid(ticket_id)})
    
    await tickets_collection.update_one(
        {"_id": str_to_objectid(ticket_id)},
        {"$set": {"status": status_update["status"], "updated_at": datetime.utcnow()}}
    )
    
    # Send email if ticket is closed
    if status_update["status"] == "closed" and ticket:
        try:
            user = await users_collection.find_one({"_id": str_to_objectid(ticket["user_id"])})
            if user:
                settings = await get_settings()
                smtp_settings = settings.get("smtp", {})
                email_service = get_email_service(smtp_settings)
                if email_service and email_service.enabled:
                    await email_service.send_ticket_closed(
                        user["email"],
                        user["name"],
                        ticket_id,
                        ticket["subject"]
                    )
        except Exception as e:
            logger.error(f"Failed to send ticket closed email: {e}")
    
    return {"message": "Ticket status updated"}

# ===== ADMIN ROUTES =====

@app.get("/api/admin/stats")
async def get_admin_stats(current_user: dict = Depends(get_current_admin_user)):
    """Get admin dashboard statistics"""
    # Count stats
    total_customers = await users_collection.count_documents({"role": "user"})
    total_orders = await orders_collection.count_documents({})
    paid_orders = await orders_collection.count_documents({"status": "paid"})
    pending_orders = await orders_collection.count_documents({"status": "pending"})
    total_services = await services_collection.count_documents({})
    active_services = await services_collection.count_documents({"status": "active"})
    pending_tickets = await tickets_collection.count_documents({"status": {"$in": ["open", "in_progress"]}})
    
    # Ticket status breakdown
    awaiting_reply_tickets = await tickets_collection.count_documents({"status": "open"})
    open_tickets = await tickets_collection.count_documents({"status": "open"})
    in_progress_tickets = await tickets_collection.count_documents({"status": "in_progress"})
    closed_tickets = await tickets_collection.count_documents({"status": "closed"})
    
    # Revenue stats
    revenue_pipeline = [
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$total"}}}
    ]
    revenue_result = await orders_collection.aggregate(revenue_pipeline).to_list(length=1)
    total_revenue = revenue_result[0]["total_revenue"] if revenue_result else 0
    
    # 7-day revenue data for chart
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    revenue_by_day = []
    for i in range(7):
        day_start = seven_days_ago + timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        day_revenue_pipeline = [
            {
                "$match": {
                    "status": "paid",
                    "paid_at": {
                        "$gte": day_start,
                        "$lt": day_end
                    }
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$total"}}}
        ]
        day_result = await orders_collection.aggregate(day_revenue_pipeline).to_list(length=1)
        day_total = day_result[0]["total"] if day_result else 0
        
        revenue_by_day.append({
            "date": day_start.strftime("%b %d"),
            "revenue": round(day_total, 2)
        })
    
    # Recent orders
    recent_orders = []
    async for order in orders_collection.find().sort("created_at", -1).limit(10):
        user = await users_collection.find_one({"_id": str_to_objectid(order["user_id"])})
        order["id"] = str(order["_id"])
        order["customer_name"] = user["name"] if user else "Unknown"
        order["customer_email"] = user["email"] if user else "Unknown"
        del order["_id"]
        recent_orders.append(order)
    
    return {
        "total_customers": total_customers,
        "total_orders": total_orders,
        "paid_orders": paid_orders,
        "pending_orders": pending_orders,
        "total_services": total_services,
        "active_services": active_services,
        "pending_tickets": pending_tickets,
        "total_revenue": total_revenue,
        "ticket_status": {
            "awaiting_reply": awaiting_reply_tickets,
            "open": open_tickets,
            "in_progress": in_progress_tickets,
            "closed": closed_tickets
        },
        "revenue_data": revenue_by_day,
        "recent_orders": recent_orders
    }

# Pydantic model for creating customers
class CreateCustomerRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


@app.post("/api/admin/customers/create")
async def create_customer(data: CreateCustomerRequest, current_user: dict = Depends(get_current_admin_user)):
    """Create a new customer account"""
    
    # Check if email already exists
    existing_user = await users_collection.find_one({"email": data.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate password
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Hash password
    hashed_password = get_password_hash(data.password)
    
    # Generate referral code
    import secrets
    referral_code = secrets.token_urlsafe(6).upper()[:8]
    
    # Create user document
    user_doc = {
        "email": data.email.lower(),
        "password": hashed_password,
        "name": data.name,
        "role": "user",
        "email_verified": True,  # Admin-created accounts are pre-verified
        "credit_balance": 0.0,
        "referral_code": referral_code,
        "created_at": datetime.utcnow()
    }
    
    result = await users_collection.insert_one(user_doc)
    
    logger.info(f"Admin {current_user.get('email')} created customer account: {data.email}")
    
    return {
        "success": True,
        "message": f"Customer '{data.name}' created successfully",
        "customer": {
            "id": str(result.inserted_id),
            "name": data.name,
            "email": data.email.lower(),
            "referral_code": referral_code
        }
    }


@app.get("/api/admin/customers")
async def get_all_customers(current_user: dict = Depends(get_current_admin_user)):
    """Get all customers"""
    customers = []
    async for user in users_collection.find({"role": "user"}).sort("created_at", -1):
        # Get user's services count
        services_count = await services_collection.count_documents({"user_id": str(user["_id"])})
        orders_count = await orders_collection.count_documents({"user_id": str(user["_id"])})
        
        user["id"] = str(user["_id"])
        user["services_count"] = services_count
        user["orders_count"] = orders_count
        del user["_id"]
        del user["password"]
        customers.append(user)
    
    return customers

@app.get("/api/admin/customers/{customer_id}")
async def get_customer_details(customer_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Get detailed customer information"""
    user = await users_collection.find_one({"_id": str_to_objectid(customer_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get customer's services
    services = []
    async for service in services_collection.find({"user_id": customer_id}).sort("created_at", -1):
        service["id"] = str(service["_id"])
        del service["_id"]
        services.append(service)
    
    # Get customer's orders
    orders = []
    async for order in orders_collection.find({"user_id": customer_id}).sort("created_at", -1):
        order["id"] = str(order["_id"])
        del order["_id"]
        orders.append(order)
    
    # Get customer's invoices
    invoices = []
    async for invoice in invoices_collection.find({"user_id": customer_id}).sort("created_at", -1):
        invoice["id"] = str(invoice["_id"])
        del invoice["_id"]
        invoices.append(invoice)
    
    user["id"] = str(user["_id"])
    del user["_id"]
    del user["password"]
    
    return {
        "customer": user,
        "services": services,
        "orders": orders,
        "invoices": invoices
    }

@app.put("/api/admin/customers/{customer_id}")
async def update_customer(customer_id: str, update_data: dict, current_user: dict = Depends(get_current_admin_user)):
    """Update customer information"""
    user = await users_collection.find_one({"_id": str_to_objectid(customer_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Prepare update data
    update_fields = {}
    if "name" in update_data:
        update_fields["name"] = update_data["name"]


@app.get("/api/refunds/enabled")
async def check_refunds_enabled():
    """Public endpoint to check if refunds are enabled (no auth required)"""
    settings = await get_settings()
    return {"enabled": settings.get("refunds_enabled", True)}

    if "email" in update_data:
        # Check if new email already exists
        existing = await users_collection.find_one({"email": update_data["email"], "_id": {"$ne": str_to_objectid(customer_id)}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_fields["email"] = update_data["email"]
    
    if update_fields:
        await users_collection.update_one(
            {"_id": str_to_objectid(customer_id)},
            {"$set": update_fields}
        )
    
    return {"message": "Customer updated successfully"}

@app.delete("/api/admin/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Delete customer and all associated data"""
    user = await users_collection.find_one({"_id": str_to_objectid(customer_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Delete customer's orders, invoices, and services
    await orders_collection.delete_many({"user_id": customer_id})
    await invoices_collection.delete_many({"user_id": customer_id})
    await services_collection.delete_many({"user_id": customer_id})
    
    # Delete customer
    await users_collection.delete_one({"_id": str_to_objectid(customer_id)})
    
    return {"message": "Customer and all associated data deleted successfully"}


@app.get("/api/admin/orders")
async def get_all_orders(current_user: dict = Depends(get_current_admin_user)):
    """Get all orders"""
    orders = []
    
    async for order in orders_collection.find().sort("created_at", -1):
        user = await users_collection.find_one({"_id": str_to_objectid(order["user_id"])})
        order["id"] = str(order["_id"])
        order["customer_name"] = user["name"] if user else "Unknown"
        order["customer_email"] = user["email"] if user else "Unknown"
        del order["_id"]
        orders.append(order)
    
    return orders


@app.get("/api/payment/config")
async def get_payment_config():
    """Get public payment configuration (no auth required)"""
    settings = await get_settings()
    
    return {
        "paypal": {
            "enabled": settings.get("paypal", {}).get("enabled", False),
            "client_id": settings.get("paypal", {}).get("client_id", ""),
            "mode": settings.get("paypal", {}).get("mode", "sandbox")
        },
        "stripe": {
            "enabled": settings.get("stripe", {}).get("enabled", False),
            "crypto_enabled": settings.get("stripe", {}).get("crypto_enabled", True),
            "mode": settings.get("stripe", {}).get("mode", "test")
        },
        "square": {
            "enabled": settings.get("square", {}).get("enabled", False),
            "application_id": settings.get("square", {}).get("application_id", ""),
            "location_id": settings.get("square", {}).get("location_id", ""),
            "environment": settings.get("square", {}).get("environment", "sandbox")
        },
        "blockonomics": {
            "enabled": settings.get("blockonomics", {}).get("enabled", False)
        },
        "manual": {
            "enabled": True
        },
        "payment_method_order": settings.get("payment_method_order", ["manual", "stripe", "paypal", "square", "blockonomics"])
    }

@app.post("/api/admin/orders/{order_id}/mark-paid")
async def mark_order_paid(order_id: str, background_tasks: BackgroundTasks, 
                          current_user: dict = Depends(get_current_admin_user)):
    """Mark order as paid and provision services"""
    order = await orders_collection.find_one({"_id": str_to_objectid(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    # Update order status
    await orders_collection.update_one(
        {"_id": str_to_objectid(order_id)},
        {"$set": {"status": "paid", "paid_at": datetime.utcnow()}}
    )
    
    # Update invoice status
    await invoices_collection.update_one(
        {"order_id": order_id},
        {"$set": {"status": "paid", "paid_date": datetime.utcnow()}}
    )
    
    # Get user
    user = await users_collection.find_one({"_id": str_to_objectid(order["user_id"])})
    
    # Check if this is a referral completion (first purchase from referred user)
    if user.get("referred_by"):
        # Check if this is their first paid order
        first_order = await orders_collection.count_documents({
            "user_id": order["user_id"],
            "status": "paid"
        })
        
        if first_order == 1:  # This is their first paid order
            await referral_service.complete_referral(order["user_id"], order_id)
            logger.info(f"Referral completed for user {order['user_id']}")
    
    # Send payment received email
    email_service = await get_configured_email_service()
    if email_service and email_service.enabled:
        await email_service.send_payment_received(
            user_email=user["email"],
            user_name=user["name"],
            order_id=order_id,
            total=order["total"]
        )
    
    # Send "Payment Received" Telegram notification
    order_items_text = "\n".join([f"- {item['product_name']}" for item in order.get('items', [])])
    await send_telegram_notification(
        "payment_received",
        f"💰 *Payment Received*\n\nCustomer: {user.get('name', 'Unknown')}\nEmail: {user.get('email', 'N/A')}\nAmount: ${order['total']:.2f}\n\nItems:\n{order_items_text}"
    )
    
    # Provision services
    background_tasks.add_task(provision_order_services, order_id, order, user)
    
    return {"message": "Order marked as paid, provisioning services..."}

@app.post("/api/admin/orders/{order_id}/cancel")
async def cancel_order(order_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Cancel a pending order"""
    order = await orders_collection.find_one({"_id": str_to_objectid(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] == "paid":
        raise HTTPException(status_code=400, detail="Cannot cancel a paid order")
    
    if order["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Order already cancelled")
    
    # Update order status to cancelled
    await orders_collection.update_one(
        {"_id": str_to_objectid(order_id)},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.utcnow()}}
    )
    
    # Update invoice status
    await invoices_collection.update_one(
        {"order_id": order_id},
        {"$set": {"status": "cancelled"}}
    )
    
    # Delete any pending payment transactions
    await db.payment_transactions.delete_many({
        "order_id": order_id,
        "payment_status": "pending"
    })
    
    # Send cancellation email
    try:
        user = await users_collection.find_one({"_id": str_to_objectid(order["user_id"])})
        if user:
            email_service = await get_configured_email_service()
            if email_service and email_service.enabled:
                await email_service.send_order_cancelled(
                    user["email"], 
                    user["name"], 
                    order_id,
                    "Order cancelled by administrator"
                )
    except Exception as e:
        logger.error(f"Failed to send cancellation email: {e}")
    
    logger.info(f"Order {order_id} cancelled by admin {current_user['sub']}")
    
    return {"message": "Order cancelled successfully"}

async def provision_order_services(order_id: str, order: dict, user: dict):
    """Provision services (XtreamUI or XuiOne) for paid order"""
    try:
        settings = await get_settings()
        
        # Get configured email service with all required params
        email_service = await get_configured_email_service()
        
        for item in order["items"]:
            # Get product details to determine which panel to use
            product = await products_collection.find_one({"_id": str_to_objectid(item["product_id"])})
            
            if not product:
                logger.error(f"Product {item['product_id']} not found")
                continue
            
            # Get panel type and index from product
            panel_type = product.get("panel_type", "xtream")
            panel_index = product.get("panel_index", 0)
            
            logger.info(f"Provisioning service for product: {product.get('name')} (Panel: {panel_type}, Index: {panel_index})")
            
            # Route to correct panel type
            if panel_type == "xuione":
                await provision_xuione_service(order_id, order, user, item, product, settings, email_service)
            else:
                await provision_xtream_service(order_id, order, user, item, product, settings, email_service)
                
    except Exception as e:
        logger.error(f"Provisioning error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

async def provision_xtream_service(order_id: str, order: dict, user: dict, item: dict, product: dict, settings: dict, email_service):
    """Provision XtreamUI service"""
    try:
        xtream_settings = settings.get("xtream", {})
        panels = xtream_settings.get("panels", [])
        
        if not panels or len(panels) == 0:
            logger.warning("XtreamUI not configured, skipping provisioning")
            return
        
        # Get panel index from product (default to 0 if not set)
        panel_index = product.get("panel_index", 0)
        
        # Validate panel index
        if panel_index >= len(panels):
            logger.error(f"Product references panel {panel_index} but only {len(panels)} panels exist. Using first panel.")
            panel_index = 0
        
        panel = panels[panel_index]
        
        # Get panel name for display
        panel_name = panel.get("name", f"Server {panel_index + 1}")
        
        # Initialize XtreamUI service for this specific panel
        xtream_service = XtreamUIService(
            panel_url=panel["panel_url"],
            admin_username=panel["admin_username"],
            admin_password=panel["admin_password"],
            ssl_verify=panel.get("ssl_verify", False)
        )
        
        # Generate or use custom credentials
        if item["account_type"] == "reseller" and order.get("reseller_credentials"):
            # Use customer's chosen credentials for reseller
            username = order["reseller_credentials"].get("username", generate_username())
            password = order["reseller_credentials"].get("password", generate_password())
            logger.info(f"Using custom reseller credentials: {username}")
        else:
            # Auto-generate for subscribers or if not provided
            username = generate_username()
            password = generate_password()
        
        # Calculate expiry date
        term_months = item["term_months"]
        expiry_date = datetime.utcnow() + timedelta(days=term_months * 30)
        expiry_timestamp = int(expiry_date.timestamp())
        
        # Check if item has action_type and renewal_service_id from cart
        action_type = item.get("action_type", "create_new")  # Default to create_new
        renewal_service_id = item.get("renewal_service_id")
        
        # For subscribers, check if they're renewing
        existing_subscriber = None
        if item["account_type"] == "subscriber":
            if renewal_service_id:
                # Customer explicitly chose to extend a specific service
                existing_subscriber = await services_collection.find_one({
                    "_id": str_to_objectid(renewal_service_id),
                    "user_id": order["user_id"],
                    "status": "active"
                })
                if existing_subscriber:
                    logger.info(f"Customer chose to extend service: {existing_subscriber['xtream_username']}")
            elif action_type == "extend":
                    # Legacy: find any active service with same product (only if explicitly set to extend)
                    existing_subscriber = await services_collection.find_one({
                        "user_id": order["user_id"],
                        "product_id": item["product_id"],
                        "status": "active"
                    })
                    if existing_subscriber:
                        logger.info(f"Legacy extend mode: extending {existing_subscriber['xtream_username']}")
                # If action_type is "create_new" or not set, existing_subscriber remains None
            
            # For resellers, check if user already has a reseller account (to add credits instead)
            existing_reseller = None
            if item["account_type"] == "reseller":
                existing_reseller = await services_collection.find_one({
                    "user_id": order["user_id"],
                    "account_type": "reseller",
                    "status": "active",
                    "panel_index": panel_index
                })
            
            # Create service record
            service_dict = {
                "user_id": order["user_id"],
                "order_id": order_id,
                "product_id": item["product_id"],
                "product_name": item["product_name"],
                "account_type": item["account_type"],
                "term_months": term_months,
                "xtream_username": existing_reseller["xtream_username"] if existing_reseller else (existing_subscriber["xtream_username"] if existing_subscriber else username),
                "xtream_password": existing_reseller["xtream_password"] if existing_reseller else (existing_subscriber["xtream_password"] if existing_subscriber else password),
                "status": "pending",
                "panel_index": panel_index,
                "panel_name": panel_name,  # Add panel name for display
                "created_at": datetime.utcnow()
            }
            
            if item["account_type"] == "subscriber":
                # Check if this is a renewal (existing subscriber)
                if existing_subscriber:
                    # Renewal - extend existing service in XtreamUI
                    logger.info(f"Renewal: Extending XtreamUI line for {existing_subscriber['xtream_username']}")
                    
                    # Get package ID from product
                    package_id = product.get("xtream_package_id", 52)
                    
                    # Extend in XtreamUI with complete data
                    extend_result = xtream_service.extend_subscriber(
                        username=existing_subscriber["xtream_username"],
                        password=existing_subscriber["xtream_password"],  # Subscriber's password!
                        package_id=package_id,
                        bouquets=product["bouquets"],
                        max_connections=product["max_connections"],
                        reseller_notes=f"Renewal: Order {order_id}"
                    )
                    
                    if extend_result.get("success"):
                        logger.info(f"✓ XtreamUI line extended")
                    else:
                        logger.warning(f"XtreamUI extend failed: {extend_result.get('error')}")
                    
                    # Calculate new expiry in our database
                    extend_days = term_months * 30  # Calculate from term
                    current_expiry = existing_subscriber.get("expiry_date", datetime.utcnow())
                    if current_expiry < datetime.utcnow():
                        # Expired, start from now
                        new_expiry = datetime.utcnow() + timedelta(days=extend_days)
                    else:
                        # Active, extend from current expiry
                        new_expiry = current_expiry + timedelta(days=extend_days)
                    
                    # Update existing service expiry in our database
                    await services_collection.update_one(
                        {"_id": existing_subscriber["_id"]},
                        {"$set": {
                            "expiry_date": new_expiry,
                            "status": "active"
                        }}
                    )
                    
                    logger.info(f"Existing service updated with new expiry: {new_expiry}")
                    
                    # Send renewal email
                    if email_service:
                        await email_service.send_service_renewed(
                            customer_email=user["email"],
                            customer_name=user["name"],
                            service_name=item["product_name"],
                            username=existing_subscriber["xtream_username"],
                            new_expiry_date=new_expiry.strftime("%Y-%m-%d"),
                            customer_id=order["user_id"]
                        )
                    
                    logger.info(f"Service renewed and extended to {new_expiry}")
                    # Renewal complete, return (service updated)
                    return
                    
                else:
                    # New subscription - create XtreamUI account
                    # Get XtreamUI package ID from product
                    package_id = product.get("xtream_package_id", 52)
                    
                    # Create subscriber via form POST
                    result = xtream_service.create_subscriber_via_form(
                        username=username,
                        password=password,
                        package_id=package_id,
                        bouquets=product["bouquets"],
                        customer_name=user["name"]
                    )
                    
                    if result["success"]:
                        # Extract user ID from result if available
                        xtream_user_id = result.get("user_id")
                        
                        service_dict.update({
                            "bouquets": product["bouquets"],
                            "max_connections": product["max_connections"],
                            "status": "active",
                            "start_date": datetime.utcnow(),
                            "expiry_date": expiry_date,
                            "dedicatedip": xtream_user_id  # Store XtreamUI user ID for suspend/terminate
                        })
                    
                    # Insert service
                    await services_collection.insert_one(service_dict)
                    
                    # Send activation email
                    if email_service:
                        await email_service.send_service_activated(
                            customer_email=user["email"],
                            customer_name=user["name"],
                            service_name=item["product_name"],
                            username=username,
                            password=password,
                            streaming_url=panel.get("streaming_url", panel["panel_url"]),
                            max_connections=product["max_connections"],
                            expiry_date=expiry_date.strftime("%Y-%m-%d"),
                            customer_id=order["user_id"]
                        )
                        
                        # Send "Service Activated" Telegram notification  
                        await send_telegram_notification(
                            "service_activated",
                            f"✅ *Service Activated*\n\nCustomer: {user.get('name', 'Unknown')}\nEmail: {user.get('email', 'N/A')}\nService: {item['product_name']}\nPanel: {panel_name} (XtreamUI)\nUsername: {username}\nExpiry: {expiry_date.strftime('%Y-%m-%d')}"
                        )
                        
                        logger.info(f"Subscriber provisioned: {username}")
                    else:
                        logger.error(f"Failed to provision subscriber: {result.get('error')}")
                        service_dict["status"] = "failed"
                        await services_collection.insert_one(service_dict)
                    
            else:  # reseller
                if existing_reseller:
                    # User already has a reseller panel - add credits to XtreamUI
                    logger.info(f"Adding {product['reseller_credits']} credits to existing reseller {existing_reseller['xtream_username']}")
                    
                    # Use the same xtream_service that's already configured with panel details
                    # (panel variable is already retrieved above)
                    if xtream_service:
                        # Add credits via XtreamUI API
                        credits_result = xtream_service.add_credits(
                            username=existing_reseller["xtream_username"],
                            email=user["email"],
                            credits=product["reseller_credits"]
                        )
                        
                        if credits_result.get("success"):
                            logger.info(f"✓ Credits added to existing reseller in XtreamUI")
                        else:
                            logger.error(f"Failed to add credits: {credits_result.get('error')}")
                    else:
                        logger.warning("XtreamUI service not available")
                    
                    # Create service record for the credit addition
                    service_dict.update({
                        "reseller_credits": product["reseller_credits"],
                        "reseller_max_lines": 0,
                        "panel_url": product.get("custom_panel_url", ""),  # Use custom URL only
                        "status": "active",
                        "start_date": datetime.utcnow(),
                        "expiry_date": expiry_date,
                        "is_credit_addon": True  # Flag to indicate this is credit addition
                    })
                    
                    await services_collection.insert_one(service_dict)
                    
                    # Send email about credit addition
                    if email_service:
                        await email_service.send_credits_added(
                            customer_email=user["email"],
                            customer_name=user["name"],
                            username=existing_reseller["xtream_username"],
                            credits=product["reseller_credits"],
                            customer_id=order["user_id"]
                        )
                    
                    logger.info(f"Credits added to existing reseller panel")
                else:
                    # Create new reseller panel
                    result = xtream_service.create_reseller(
                        username=username,
                        password=password,
                        credits=product["reseller_credits"],
                        email=user["email"],  # Pass customer email
                        member_group_id=2  # 2 for reseller (typically)
                    )
                    
                    if result["success"]:
                        # Wait for account to be created in XtreamUI
                        logger.info("Waiting 10 seconds for account creation to complete...")
                        await asyncio.sleep(10)
                        
                        # Add credits to newly created reseller
                        if product["reseller_credits"] > 0:
                            logger.info(f"Adding {product['reseller_credits']} credits to {username}")
                            credits_result = xtream_service.add_credits(
                                username=username,
                                email=user["email"],
                                credits=product["reseller_credits"]
                            )
                            if credits_result.get("success"):
                                logger.info(f"✓ Credits added successfully")
                            else:
                                logger.warning(f"Failed to add credits: {credits_result.get('error')}")
                                # Log the error but don't fail the whole provisioning
                        
                        service_dict.update({
                            "reseller_credits": product["reseller_credits"],
                            "reseller_max_lines": product["reseller_max_lines"],
                            "panel_url": product.get("custom_panel_url", ""),  # Use custom URL only, empty if not set
                            "status": "active",
                            "start_date": datetime.utcnow(),
                            "expiry_date": expiry_date
                        })
                        
                        # Insert service
                        await services_collection.insert_one(service_dict)
                        
                        logger.info(f"Reseller service created in database")
                        
                        # Send activation email (reseller-specific)
                        if email_service:
                            logger.info(f"Sending reseller activation email to {user['email']}")
                            panel_url_for_email = product.get("custom_panel_url", "")
                            logger.info(f"Panel URL for email: {panel_url_for_email}")
                            if panel_url_for_email:
                                result = await email_service.send_reseller_activated(
                                    customer_email=user["email"],
                                    customer_name=user["name"],
                                    service_name=item["product_name"],
                                    username=username,
                                    password=password,
                                    panel_url=panel_url_for_email,
                                    credits=product["reseller_credits"],
                                    expiry_date=expiry_date.strftime("%Y-%m-%d"),
                                    customer_id=order["user_id"]
                                )
                                if result:
                                    logger.info(f"✓ Reseller activation email sent successfully")
                                else:
                                    logger.error(f"✗ Reseller activation email failed to send")
                            else:
                                logger.warning("No custom panel URL set - email not sent")
                        else:
                            logger.warning("Email service not available - email not sent")
                        
                        logger.info(f"Reseller provisioned: {username}")
                    else:
                        logger.error(f"Failed to provision reseller: {result.get('error')}")
                        service_dict["status"] = "failed"
                        await services_collection.insert_one(service_dict)
        
    except Exception as e:
        logger.error(f"Provisioning error: {str(e)}")



async def extend_xuione_line(xuione_service, existing_service: dict, item: dict, product: dict, order: dict, order_id: str, user: dict, email_service):
    """Extend/renew an existing XuiOne line using edit_line API"""
    try:
        logger.info(f"Extending XuiOne line: {existing_service.get('xtream_username')}")
        
        # Login first to get session cookie
        if not xuione_service.logged_in:
            if not xuione_service.login():
                logger.error("XuiOne: Login failed for extension")
                return
        
        # Get the line ID from the existing service (stored in dedicatedip or xuione_line_id)
        line_id = existing_service.get("dedicatedip") or existing_service.get("xuione_line_id")
        
        if not line_id:
            logger.error(f"No line ID found for service {existing_service.get('_id')}")
            return
        
        # Calculate new expiry date (extend from current expiry if not expired, otherwise from now)
        extend_days = item["term_months"] * 30
        current_expiry = existing_service.get("expiry_date", datetime.utcnow())
        
        if current_expiry < datetime.utcnow():
            # Expired, start from now
            new_expiry = datetime.utcnow() + timedelta(days=extend_days)
        else:
            # Active, extend from current expiry
            new_expiry = current_expiry + timedelta(days=extend_days)
        
        new_expiry_str = new_expiry.strftime("%Y-%m-%d")
        
        # Prepare edit_line request data
        request_data = {
            'id': str(line_id),
            'package': str(product.get('xtream_package_id', '')),
            'trial': '1' if product.get('is_trial') else '0',
            'reseller_notes': f'Renewal - Order {order_id}',
            'is_isplock': '0'
        }
        
        logger.info(f"Extending line {line_id} to {new_expiry_str}")
        
        # Get API URL
        api_url = xuione_service.get_api_url()
        
        # Make API request to edit_line
        import requests
        response = xuione_service.session.post(
            api_url,
            params={
                'api_key': xuione_service.api_key,
                'action': 'edit_line'
            },
            data=request_data,
            headers={
                'User-Agent': 'IPTV-Billing-System/1.0',
                'Accept': '*/*'
            },
            timeout=30
        )
        
        logger.info(f"XuiOne edit_line response: status={response.status_code}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                logger.info(f"XuiOne edit_line result: {result}")
                
                if result.get('status') == 'STATUS_SUCCESS':
                    logger.info(f"✓ XuiOne line extended successfully")
                    
                    # Update existing service expiry in our database
                    await services_collection.update_one(
                        {"_id": existing_service["_id"]},
                        {"$set": {
                            "expiry_date": new_expiry,
                            "status": "active"
                        }}
                    )
                    
                    # Send renewal email
                    if email_service:
                        await email_service.send_service_renewed(
                            customer_email=user["email"],
                            customer_name=user["name"],
                            service_name=item["product_name"],
                            username=existing_service["xtream_username"],
                            new_expiry_date=new_expiry_str,
                            customer_id=order["user_id"]
                        )
                    
                    logger.info(f"Service renewed and extended to {new_expiry}")
                else:
                    logger.error(f"XuiOne edit_line failed: {result}")
                    
            except ValueError as json_err:
                logger.error(f"XuiOne edit_line: Invalid JSON response")
        else:
            logger.error(f"XuiOne edit_line HTTP error: {response.status_code}")
            
    except Exception as e:
        logger.error(f"XuiOne extension error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


async def provision_xuione_service(order_id: str, order: dict, user: dict, item: dict, product: dict, settings: dict, email_service):
    """Provision XuiOne service using API"""
    try:
        xuione_settings = settings.get("xuione", {})
        panels = xuione_settings.get("panels", [])
        
        if not panels or len(panels) == 0:
            logger.warning("XuiOne not configured, skipping provisioning")
            return
        
        # Get panel index from product
        panel_index = product.get("panel_index", 0)
        
        # Validate panel index
        if panel_index >= len(panels):
            logger.error(f"Product references XuiOne panel {panel_index} but only {len(panels)} panels exist. Using first panel.")
            panel_index = 0
        
        panel = panels[panel_index]
        panel_name = panel.get("name", f"XuiOne Panel {panel_index + 1}")
        
        logger.info(f"Provisioning XuiOne service on panel: {panel_name}")
        
        # Initialize XuiOne service
        xuione_service = XuiOneService(
            panel_url=panel["panel_url"],
            api_access_code=panel.get("api_access_code", ""),
            api_key=panel.get("api_key", ""),
            admin_username=panel["admin_username"],
            admin_password=panel["admin_password"],
            ssl_verify=panel.get("ssl_verify", False)
        )
        
        # Generate or use custom credentials
        if item["account_type"] == "reseller" and order.get("reseller_credentials"):
            username = order["reseller_credentials"].get("username", generate_username())
            password = order["reseller_credentials"].get("password", generate_password())
            logger.info(f"Using custom reseller credentials: {username}")
        else:
            username = generate_username()
            password = generate_password()
        
        # Calculate expiry date
        term_months = item["term_months"]
        expiry_date = datetime.utcnow() + timedelta(days=term_months * 30)
        expiry_date_str = expiry_date.strftime("%Y-%m-%d")
        
        # Create service record
        service_dict = {
            "user_id": order["user_id"],
            "order_id": order_id,
            "product_id": item["product_id"],
            "product_name": item["product_name"],
            "account_type": item["account_type"],
            "term_months": term_months,
            "xtream_username": username,  # Keep field name for compatibility
            "xtream_password": password,
            "status": "pending",
            "panel_index": panel_index,
            "panel_type": "xuione",
            "panel_name": panel_name,
            "created_at": datetime.utcnow()
        }
        
        if item["account_type"] == "subscriber":
            # Check for existing service (renewal scenario)
            existing_service = None
            renewal_service_id = item.get("renewal_service_id")
            
            if renewal_service_id:
                # Customer explicitly chose to extend a specific service
                existing_service = await services_collection.find_one({
                    "_id": str_to_objectid(renewal_service_id),
                    "user_id": order["user_id"],
                    "status": "active",
                    "panel_type": "xuione"
                })
                if existing_service:
                    logger.info(f"Renewal: Extending XuiOne line {existing_service.get('xtream_username')}")
            
            if existing_service:
                # RENEWAL - Extend existing line using edit_line API
                await extend_xuione_line(xuione_service, existing_service, item, product, order, order_id, user, email_service)
                return
            else:
                # NEW SUBSCRIPTION - Create new line
                logger.info(f"Creating XuiOne subscriber: {username}")
            
            # XuiOne API requires api_key
            if not xuione_service.api_key:
                logger.error("XuiOne API key not configured!")
                service_dict["status"] = "failed"
                service_dict["error"] = "API key not configured"
                await services_collection.insert_one(service_dict)
                return
            
            # Make API request to create line
            # Note: XuiOne API might require BOTH api_key AND session cookies
            import requests
            try:
                # Login first to get session cookie
                if not xuione_service.logged_in:
                    login_result = xuione_service.login()
                    if not login_result:
                        logger.error("XuiOne: Failed to login before API call")
                        service_dict["status"] = "failed"
                        service_dict["error"] = "Login failed"
                        await services_collection.insert_one(service_dict)
                        return
                
                # Use the logged-in session (with cookies) for API calls
                logger.info(f"Using session with cookies: {bool(xuione_service.session.cookies)}")
                
                # Use the API URL (with API access code) instead of web URL
                api_url = xuione_service.get_api_url()
                
                logger.info(f"XuiOne API URL: {api_url}/?api_key=***&action=create_line")
                
                logger.info(f"Creating line: package={product.get('xtream_package_id', '')}, connections={product['max_connections']}, expiry={expiry_date_str}, is_trial={product.get('is_trial', False)}")
                
                # XuiOne WHMCS module format (from working implementation)
                request_data = {
                    'username': username,
                    'password': password,
                    'package': str(product.get('xtream_package_id', '')),  # Package ID from XuiOne
                    'trial': '1' if product.get('is_trial') else '0',  # Important: trial flag!
                    'reseller_notes': f'Billing System - Order {order_id}',
                    'is_isplock': '0'  # ISP lock disabled by default
                }
                
                logger.info(f"Request data: {request_data}")
                
                # Use the logged-in session (has cookies) instead of fresh session
                response = xuione_service.session.post(
                    api_url,
                    params={
                        'api_key': xuione_service.api_key,
                        'action': 'create_line'
                    },
                    data=request_data,
                    headers={
                        'User-Agent': 'IPTV-Billing-System/1.0',
                        'Accept': '*/*'
                    },
                    timeout=30
                )
                
                logger.info(f"XuiOne create_line response: status={response.status_code}, content-type={response.headers.get('content-type')}")
                logger.info(f"Response preview: {response.text[:500]}")
                
                if response.status_code == 200:
                    # Try to parse as JSON regardless of content-type (XuiOne sends wrong headers)
                    try:
                        result = response.json()
                        logger.info(f"XuiOne create_line result: {result}")
                        
                        if result.get('status') == 'STATUS_SUCCESS':
                            logger.info(f"✓ XuiOne line created successfully")
                            
                            # Store the line ID for future renewals
                            line_id = result.get('data', {}).get('id')
                            
                            service_dict.update({
                                "bouquets": product["bouquets"],
                                "max_connections": product["max_connections"],
                                "status": "active",
                                "start_date": datetime.utcnow(),
                                "expiry_date": expiry_date,
                                "dedicatedip": line_id,  # Store XuiOne line ID for renewals
                                "xuione_line_id": line_id,  # Alternative field name
                                "panel_url": panel.get("panel_url", "")  # Store panel URL for customer display
                            })
                        elif result.get('status') == 'STATUS_INVALID_PACKAGE':
                            logger.error(f"XuiOne: Invalid package - check bouquets configuration")
                            service_dict["status"] = "failed"
                            service_dict["error"] = "Invalid package/bouquets configuration"
                        else:
                            logger.error(f"XuiOne API returned error: {result}")
                            service_dict["status"] = "failed"
                            service_dict["error"] = result.get("message", result.get("status", "Unknown error"))
                    except ValueError as json_err:
                        # If it's truly not JSON, it might be HTML login page
                        if '<html' in response.text.lower():
                            logger.error("XuiOne API returned HTML (login page) - authentication failed")
                            service_dict["status"] = "failed"
                            service_dict["error"] = "API authentication failed - check API key"
                        else:
                            logger.error(f"XuiOne response is not valid JSON: {json_err}")
                            service_dict["status"] = "failed"
                            service_dict["error"] = "Invalid API response"
                else:
                    logger.error(f"XuiOne API HTTP error: {response.status_code}")
                    service_dict["status"] = "failed"
                    service_dict["error"] = f"HTTP {response.status_code}"
                    
            except Exception as api_err:
                logger.error(f"XuiOne API error: {api_err}")
                service_dict["status"] = "failed"
                service_dict["error"] = str(api_err)
            
            # Insert service record
            await services_collection.insert_one(service_dict)
            
            # Send activation email if successful
            if service_dict["status"] == "active" and email_service:
                await email_service.send_service_activated(
                    customer_email=user["email"],
                    customer_name=user["name"],
                    service_name=item["product_name"],
                    username=username,
                    password=password,
                    streaming_url=panel.get("panel_url", ""),  # XuiOne uses panel_url for streaming
                    max_connections=product["max_connections"],
                    expiry_date=expiry_date_str,
                    customer_id=order["user_id"]
                )
                
                # Send "Service Activated" Telegram notification
                await send_telegram_notification(
                    "service_activated",
                    f"✅ *Service Activated*\n\nCustomer: {user.get('name', 'Unknown')}\nEmail: {user.get('email', 'N/A')}\nService: {item['product_name']}\nPanel: {panel_name} (XuiOne)\nUsername: {username}\nExpiry: {expiry_date_str}"
                )
        
        else:
            # RESELLER PROVISIONING
            logger.info(f"Creating XuiOne reseller: {username}")
            
            # XuiOne API requires api_key
            if not xuione_service.api_key:
                logger.error("XuiOne API key not configured!")
                service_dict["status"] = "failed"
                service_dict["error"] = "API key not configured"
                await services_collection.insert_one(service_dict)
                return
            
            # Login first to get session cookie
            if not xuione_service.logged_in:
                if not xuione_service.login():
                    logger.error("XuiOne: Login failed")
                    service_dict["status"] = "failed"
                    service_dict["error"] = "Login failed"
                    await services_collection.insert_one(service_dict)
                    return
            
            # Get API URL
            api_url = xuione_service.get_api_url()
            
            # Prepare create_user request for reseller
            request_data = {
                'username': username,
                'password': password,
                'email': user.get('email', ''),
                'member_group_id': '2',  # 2 = Reseller
                'credits': str(int(product.get('reseller_credits', 0))),  # Integer string
                'notes': f'Billing System - Order {order_id}',
                'owner_id': '247'  # Parent reseller ID (numeric)
            }
            
            logger.info(f"Creating reseller with {product.get('reseller_credits', 0)} credits")
            
            import requests
            try:
                response = xuione_service.session.post(
                    api_url,
                    params={
                        'api_key': xuione_service.api_key,
                        'action': 'create_user'
                    },
                    data=request_data,
                    headers={
                        'User-Agent': 'IPTV-Billing-System/1.0',
                        'Accept': '*/*'
                    },
                    timeout=30
                )
                
                logger.info(f"XuiOne create_user response: status={response.status_code}")
                
                if response.status_code == 200:
                    try:
                        result = response.json()
                        logger.info(f"XuiOne create_user result: {result}")
                        
                        if result.get('status') == 'STATUS_SUCCESS':
                            logger.info(f"✓ XuiOne reseller created successfully")
                            
                            # Store the reseller ID
                            reseller_id = result.get('data', {}).get('id')
                            
                            # Add credits via adjust_credits action (all params in query string)
                            if product.get('reseller_credits', 0) > 0:
                                credits_amount = int(product['reseller_credits'])
                                logger.info(f"Adding {credits_amount} credits to reseller {reseller_id}")
                                
                                credits_response = xuione_service.session.post(
                                    api_url,
                                    params={
                                        'api_key': xuione_service.api_key,
                                        'action': 'adjust_credits',
                                        'id': reseller_id,
                                        'credits': str(credits_amount),
                                        'reason': f'Initial allocation - Order {order_id}'
                                    },
                                    headers={
                                        'User-Agent': 'IPTV-Billing-System/1.0',
                                        'Accept': '*/*'
                                    },
                                    timeout=30
                                )
                                
                                if credits_response.status_code == 200:
                                    try:
                                        credits_result = credits_response.json()
                                        logger.info(f"Adjust credits result: {credits_result}")
                                        
                                        if credits_result.get('status') == 'STATUS_SUCCESS':
                                            logger.info(f"✓ Credits adjusted successfully")
                                            
                                            # Verify new balance
                                            verify_response = xuione_service.session.get(
                                                api_url,
                                                params={
                                                    'api_key': xuione_service.api_key,
                                                    'action': 'get_user',
                                                    'id': reseller_id
                                                },
                                                timeout=10
                                            )
                                            if verify_response.status_code == 200:
                                                verify_data = verify_response.json()
                                                new_balance = verify_data.get('data', {}).get('credits', 'unknown')
                                                logger.info(f"✓ Verified new credit balance: {new_balance}")
                                        else:
                                            logger.warning(f"Failed to adjust credits: {credits_result}")
                                    except ValueError:
                                        logger.warning("Credits response not JSON")
                                else:
                                    logger.warning(f"Adjust credits HTTP error: {credits_response.status_code}")
                            
                            service_dict.update({
                                "status": "active",
                                "start_date": datetime.utcnow(),
                                "expiry_date": None,  # Resellers don't expire
                                "dedicatedip": reseller_id,  # Store reseller ID
                                "xuione_reseller_id": reseller_id,
                                "reseller_credits": product.get('reseller_credits', 0),
                                "panel_url": panel.get("panel_url", "")  # Store panel URL for customer display
                            })
                        else:
                            logger.error(f"XuiOne create_user failed: {result}")
                            service_dict["status"] = "failed"
                            service_dict["error"] = result.get("message", result.get("status", "Unknown error"))
                    except ValueError as json_err:
                        logger.error(f"XuiOne response is not valid JSON")
                        service_dict["status"] = "failed"
                        service_dict["error"] = "Invalid API response"
                else:
                    logger.error(f"XuiOne create_user HTTP error: {response.status_code}")
                    service_dict["status"] = "failed"
                    service_dict["error"] = f"HTTP {response.status_code}"
                    
            except Exception as api_err:
                logger.error(f"XuiOne create_user error: {api_err}")
                service_dict["status"] = "failed"
                service_dict["error"] = str(api_err)
            
            # Insert service record
            await services_collection.insert_one(service_dict)
            
            # Send activation email if successful
            if service_dict["status"] == "active" and email_service:
                # Note: Email templates may need to be adapted for reseller accounts
                logger.info(f"Reseller {username} created with {product.get('reseller_credits', 0)} credits")

    
    except Exception as e:
        logger.error(f"XuiOne provisioning error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


@app.post("/api/admin/services/{service_id}/suspend")
async def suspend_service(service_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Suspend a service"""
    service = await services_collection.find_one({"_id": str_to_objectid(service_id)})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    settings = await get_settings()
    xtream_service = get_xtream_service(settings.get("xtream", {}))
    
    if xtream_service:
        result = xtream_service.suspend_account(
            username=service["xtream_username"],
            password=service["xtream_password"]
        )
        
        if result["success"]:
            await services_collection.update_one(
                {"_id": str_to_objectid(service_id)},
                {"$set": {"status": "suspended"}}
            )
            
            # Send email
            user = await users_collection.find_one({"_id": str_to_objectid(service["user_id"])})
            email_service = get_email_service(settings.get("smtp", {}))
            if email_service:
                await email_service.send_service_suspended(
                    user_email=user["email"],
                    user_name=user["name"],
                    service_name=service["product_name"],
                    reason="Administrative action"
                )
            
            return {"message": "Service suspended successfully"}
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to suspend"))
    
    raise HTTPException(status_code=500, detail="XtreamUI service not configured")

@app.post("/api/admin/services/{service_id}/unsuspend")
async def unsuspend_service(service_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Unsuspend a service"""
    service = await services_collection.find_one({"_id": str_to_objectid(service_id)})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    settings = await get_settings()
    xtream_service = get_xtream_service(settings.get("xtream", {}))
    
    if xtream_service:
        result = xtream_service.unsuspend_account(
            username=service["xtream_username"],
            password=service["xtream_password"]
        )
        
        if result["success"]:
            await services_collection.update_one(
                {"_id": str_to_objectid(service_id)},
                {"$set": {"status": "active"}}
            )
            return {"message": "Service unsuspended successfully"}
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to unsuspend"))
    
    raise HTTPException(status_code=500, detail="XtreamUI service not configured")

@app.post("/api/admin/services/{service_id}/cancel")
async def cancel_service(service_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Cancel/terminate a service"""
    service = await services_collection.find_one({"_id": str_to_objectid(service_id)})

@app.get("/api/panels/names")
async def get_panel_names():
    """Get panel names (public endpoint for homepage categorization)"""
    settings = await get_settings()
    
    # Get XtreamUI panels
    xtream_panels = settings.get("xtream", {}).get("panels", [])
    panel_info = []
    for i, panel in enumerate(xtream_panels):
        panel_info.append({
            "index": i,
            "name": panel.get("name", f"Server {i + 1}")
        })
    
    # Get XuiOne panels
    xuione_panels = settings.get("xuione", {}).get("panels", [])
    xuione_info = []
    for i, panel in enumerate(xuione_panels):
        xuione_info.append({
            "index": i,
            "name": panel.get("name", f"XuiOne Panel {i + 1}")
        })
    
    return {
        "panels": panel_info,
        "xuione_panels": xuione_info
    }

    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    settings = await get_settings()
    xtream_service = get_xtream_service(settings.get("xtream", {}))
    
    if xtream_service:
        result = xtream_service.terminate_account(
            username=service["xtream_username"],
            password=service["xtream_password"]
        )
        
        if result["success"]:
            await services_collection.update_one(
                {"_id": str_to_objectid(service_id)},
                {"$set": {"status": "cancelled"}}
            )
            
            # Send email
            user = await users_collection.find_one({"_id": str_to_objectid(service["user_id"])})
            email_service = get_email_service(settings.get("smtp", {}))
            if email_service:
                await email_service.send_service_cancelled(
                    user_email=user["email"],
                    user_name=user["name"],
                    service_name=service["product_name"]
                )
            
            return {"message": "Service cancelled successfully"}
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to cancel"))
    
    raise HTTPException(status_code=500, detail="XtreamUI service not configured")


class ManualServiceCreate(BaseModel):
    user_id: str
    product_id: str
    term_months: int = 1

@app.post("/api/admin/services/create-manual")
async def create_manual_service(service_data: ManualServiceCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_admin_user)):
    """Manually create a service for a customer (admin only)"""
    import uuid
    
    # Get user
    user = await users_collection.find_one({"_id": str_to_objectid(service_data.user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get product
    product = await products_collection.find_one({"_id": str_to_objectid(service_data.product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Create a manual order
    order_id = str(uuid.uuid4())
    order_dict = {
        "_id": order_id,
        "user_id": service_data.user_id,
        "items": [{
            "product_id": service_data.product_id,
            "product_name": product.get("name"),
            "account_type": product.get("account_type"),
            "term_months": service_data.term_months,
            "price": 0,
            "action_type": "create_new"
        }],
        "subtotal": 0,
        "discount_amount": 0,
        "credits_used": 0,
        "total": 0,
        "status": "paid",
        "payment_method": "manual_admin",
        "created_at": datetime.utcnow(),
        "paid_at": datetime.utcnow()
    }
    
    await orders_collection.insert_one(order_dict)
    
    # Provision service in background
    background_tasks.add_task(provision_order_services, order_id, order_dict, user)
    
    return {
        "message": "Service creation initiated. Provisioning in background...",
        "order_id": order_id
    }


@app.get("/api/admin/products")
async def get_all_products_admin(current_user: dict = Depends(get_current_admin_user)):
    """Get all products (admin) sorted by display_order"""
    products = []
    async for product in products_collection.find().sort([("display_order", 1), ("created_at", 1)]):
        product["id"] = str(product["_id"])
        del product["_id"]
        products.append(product)
    return products

@app.post("/api/admin/products")
async def create_product(product: ProductCreate, current_user: dict = Depends(get_current_admin_user)):
    """Create new product"""
    product_dict = product.dict()
    product_dict["created_at"] = datetime.utcnow()
    
    # Auto-assign display_order if not set
    if "display_order" not in product_dict or product_dict["display_order"] is None:
        # Get the max display_order for this panel_index and account_type
        max_order = 0
        async for p in products_collection.find({
            "panel_index": product_dict.get("panel_index", 0),
            "account_type": product_dict.get("account_type", "subscriber")
        }).sort("display_order", -1).limit(1):
            max_order = p.get("display_order", 0)
        
        product_dict["display_order"] = max_order + 1
    
    result = await products_collection.insert_one(product_dict)
    
    # Fetch the created product to return
    created_product = await products_collection.find_one({"_id": result.inserted_id})
    
    # Serialize for JSON response
    created_product["id"] = str(created_product["_id"])
    del created_product["_id"]
    created_product["created_at"] = created_product["created_at"].isoformat()
    
    return created_product

@app.put("/api/admin/products/{product_id}")
async def update_product(product_id: str, product: ProductCreate, 
                        current_user: dict = Depends(get_current_admin_user)):
    """Update product"""
    await products_collection.update_one(
        {"_id": str_to_objectid(product_id)},
        {"$set": product.dict()}
    )
    return {"message": "Product updated successfully"}

@app.delete("/api/admin/products/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Delete product"""
    await products_collection.delete_one({"_id": str_to_objectid(product_id)})
    return {"message": "Product deleted successfully"}

@app.post("/api/admin/products/{product_id}/reorder")
async def reorder_product(product_id: str, direction: str = Query(...), current_user: dict = Depends(get_current_admin_user)):
    """Reorder product (move up or down)"""
    if direction not in ['up', 'down']:
        raise HTTPException(status_code=400, detail="Direction must be 'up' or 'down'")
    
    # Get current product
    product = await products_collection.find_one({"_id": str_to_objectid(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    current_order = product.get("display_order", 0)
    panel_index = product.get("panel_index", 0)
    panel_type = product.get("panel_type", "xtream")
    account_type = product.get("account_type", "subscriber")
    
    # Get all products in same panel type, panel index, AND same account type, sorted by display_order
    panel_products = []
    async for p in products_collection.find({
        "panel_index": panel_index,
        "panel_type": panel_type,
        "account_type": account_type
    }).sort("display_order", 1):
        panel_products.append(p)
    
    # Find current product index in the list
    current_index = next((i for i, p in enumerate(panel_products) if str(p["_id"]) == product_id), None)
    
    if current_index is None:
        raise HTTPException(status_code=404, detail="Product not found in panel")
    
    # Determine swap index
    if direction == 'up':
        if current_index == 0:
            return {"message": "Product is already first"}
        swap_index = current_index - 1
    else:  # down
        if current_index == len(panel_products) - 1:
            return {"message": "Product is already last"}
        swap_index = current_index + 1
    
    # Swap display_order values
    current_product = panel_products[current_index]
    swap_product = panel_products[swap_index]
    
    current_display_order = current_product.get("display_order", current_index)
    swap_display_order = swap_product.get("display_order", swap_index)
    
    await products_collection.update_one(
        {"_id": current_product["_id"]},
        {"$set": {"display_order": swap_display_order}}
    )
    
    await products_collection.update_one(
        {"_id": swap_product["_id"]},
        {"$set": {"display_order": current_display_order}}
    )
    
    return {"message": "Product reordered successfully"}

@app.post("/api/admin/products/fix-display-order")
async def fix_display_order(current_user: dict = Depends(get_current_admin_user)):
    """Fix and initialize display_order for all products"""
    # Get all products grouped by panel_type, panel_index, and account_type
    all_products = []
    async for p in products_collection.find():
        all_products.append(p)
    
    # Group products
    from collections import defaultdict
    groups = defaultdict(list)
    
    for product in all_products:
        panel_type = product.get("panel_type", "xtream")
        panel_index = product.get("panel_index", 0)
        account_type = product.get("account_type", "subscriber")
        key = f"{panel_type}-{panel_index}-{account_type}"
        groups[key].append(product)
    
    # Assign sequential display_order within each group
    updated_count = 0
    for group_key, group_products in groups.items():
        # Sort by current display_order (if exists) or creation date
        group_products.sort(key=lambda p: (
            p.get("display_order", 999),
            p.get("created_at", datetime.min)
        ))
        
        # Assign sequential order
        for index, product in enumerate(group_products):
            await products_collection.update_one(
                {"_id": product["_id"]},
                {"$set": {"display_order": index}}
            )
            updated_count += 1
    
    return {
        "message": f"Fixed display_order for {updated_count} products across {len(groups)} groups"
    }


@app.get("/api/branding")
async def get_branding():
    """Get branding settings (public - no auth required)"""
    settings = await get_settings()
    branding = settings.get("branding", {
        "site_name": "IPTV Billing",
        "logo_url": "",
        "theme": "light",
        "primary_color": "#2563eb",
        "secondary_color": "#7c3aed",
        "accent_color": "#059669",
        "product_card_color": "#2563eb",
        "hero_background_image": "",
        "hero_title": "Premium IPTV Subscriptions",
        "hero_description": "Stream thousands of channels in HD quality",
        "footer_text": "Premium IPTV Services"
    })
    return branding

@app.get("/api/admin/settings")
async def get_admin_settings(current_user: dict = Depends(get_current_admin_user)):
    """Get system settings"""
    settings = await get_settings()
    if "_id" in settings:
        settings["id"] = str(settings["_id"])
        del settings["_id"]
    return settings

@app.put("/api/admin/settings")
async def update_admin_settings(settings_update: Settings, 
                               current_user: dict = Depends(get_current_admin_user)):
    """Update system settings"""
    settings_dict = settings_update.dict()
    settings_dict["updated_at"] = datetime.utcnow()
    
    existing = await settings_collection.find_one()
    if existing:
        await settings_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": settings_dict}
        )
    else:
        await settings_collection.insert_one(settings_dict)
    
    # Reinitialize services with new settings
    get_xtream_service(settings_dict.get("xtream", {}))
    get_email_service(settings_dict.get("smtp", {}))
    
    return {"message": "Settings updated successfully"}

# ===== NOTIFICATION SETTINGS ENDPOINTS =====

class TelegramSettings(BaseModel):
    enabled: bool = False
    bot_token: str = ""
    chat_id: str = ""
    events: dict = {}

class TestTelegramRequest(BaseModel):
    bot_token: str
    chat_id: str

@app.get("/api/admin/notifications/settings")
async def get_notification_settings(current_user: dict = Depends(get_current_admin_user)):
    """Get notification settings"""
    settings = await get_settings()
    notifications = settings.get("notifications", {})
    return {
        "telegram": notifications.get("telegram", {
            "enabled": False,
            "bot_token": "",
            "chat_id": "",
            "events": {
                "new_order": True,
                "payment_received": True,
                "new_user": True,
                "service_activated": True,
                "service_expired": False,
                "ticket_created": True,
                "ticket_replied": False
            }
        })
    }

@app.put("/api/admin/notifications/telegram")
async def update_telegram_settings(telegram: TelegramSettings, current_user: dict = Depends(get_current_admin_user)):
    """Update Telegram notification settings"""
    settings = await get_settings()
    
    if "notifications" not in settings:
        settings["notifications"] = {}
    
    settings["notifications"]["telegram"] = telegram.dict()
    
    await settings_collection.update_one(
        {},
        {"$set": {"notifications": settings["notifications"]}},
        upsert=True
    )
    
    return {"message": "Telegram settings updated successfully"}

@app.post("/api/admin/notifications/telegram/test")
async def test_telegram_notification(request: TestTelegramRequest, current_user: dict = Depends(get_current_admin_user)):
    """Send a test message to verify Telegram settings"""
    import httpx
    
    if not request.bot_token or not request.chat_id:
        raise HTTPException(status_code=400, detail="Bot token and chat ID are required")
    
    try:
        # Get branding for site name
        settings = await get_settings()
        site_name = settings.get("branding", {}).get("site_name", "IPTV Billing")
        
        message = f"🔔 *Test Notification*\n\nThis is a test message from {site_name}.\n\nYour Telegram notifications are configured correctly! ✅"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.telegram.org/bot{request.bot_token}/sendMessage",
                json={
                    "chat_id": request.chat_id,
                    "text": message,
                    "parse_mode": "Markdown"
                },
                timeout=10.0
            )
            
            result = response.json()
            
            if response.status_code == 200 and result.get("ok"):
                return {"message": "Test message sent successfully!"}
            else:
                # Get the actual error from Telegram
                error_desc = result.get('description', f'HTTP {response.status_code}')
                
                # Provide helpful messages for common errors
                if response.status_code == 401 or "Unauthorized" in error_desc:
                    raise HTTPException(status_code=400, detail="Invalid bot token. Please check your token from @BotFather.")
                elif "chat not found" in error_desc.lower():
                    raise HTTPException(status_code=400, detail="Chat not found. Please check your Chat ID.")
                elif "bot was blocked" in error_desc.lower():
                    raise HTTPException(status_code=400, detail="Bot was blocked by user. Please unblock the bot and try again.")
                elif "chat_id is empty" in error_desc.lower():
                    raise HTTPException(status_code=400, detail="Chat ID cannot be empty.")
                elif "CHAT_WRITE_FORBIDDEN" in error_desc:
                    raise HTTPException(status_code=400, detail="Bot doesn't have permission to send messages. Make sure you've started a conversation with the bot first (send /start to your bot).")
                else:
                    raise HTTPException(status_code=400, detail=f"Telegram error: {error_desc}")
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=500, detail="Request timed out. Please check your internet connection.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send test message: {str(e)}")

# Helper function to send Telegram notifications
async def send_telegram_notification(event_type: str, message: str):
    """Send a Telegram notification if enabled for the event type"""
    try:
        settings = await get_settings()
        telegram = settings.get("notifications", {}).get("telegram", {})
        
        if not telegram.get("enabled"):
            return False
        
        events = telegram.get("events", {})
        if not events.get(event_type, False):
            return False
        
        bot_token = telegram.get("bot_token", "")
        chat_id = telegram.get("chat_id", "")
        
        if not bot_token or not chat_id:
            return False
        
        import httpx
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "Markdown"
                },
                timeout=10.0
            )
        return True
    except Exception as e:
        logger.error(f"Failed to send Telegram notification: {str(e)}")
        return False

# ===== XUIONE PANEL ENDPOINTS =====

from xuione_service import XuiOneService, get_xuione_service

@app.post("/api/admin/xuione/test")
async def test_xuione_connection(current_user: dict = Depends(get_current_admin_user)):
    """Test XuiOne panel connection"""
    import logging
    logger = logging.getLogger(__name__)
    
    settings = await get_settings()
    panels = settings.get("xuione", {}).get("panels", [])
    
    if not panels:
        raise HTTPException(status_code=400, detail="No XuiOne panels configured. Please add a panel first.")
    
    panel = panels[0]
    logger.info(f"Testing XuiOne panel: {panel.get('name', 'Unknown')}")
    logger.info(f"Panel URL: {panel.get('panel_url', 'Not set')}")
    
    try:
        service = get_xuione_service(panel)
        
        if not service:
            logger.error("Failed to create XuiOne service instance")
            raise HTTPException(status_code=500, detail="Failed to initialize XuiOne service. Check panel configuration.")
        
        result = service.test_connection()
        
        if result.get("success"):
            logger.info(f"✓ XuiOne connection test successful")
            return {"message": result.get("message", "Connection successful")}
        else:
            error_msg = result.get("error", "Connection failed")
            logger.error(f"✗ XuiOne connection test failed: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"✗ XuiOne test connection exception: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Connection test error: {str(e)}")

@app.get("/api/admin/xuione/sync-packages")
async def sync_xuione_packages(panel_index: int = 0, current_user: dict = Depends(get_current_admin_user)):
    """Sync packages from XuiOne panel - Returns package list for selection, does NOT create products"""
    settings = await get_settings()
    panels = settings.get("xuione", {}).get("panels", [])
    
    if panel_index >= len(panels):
        raise HTTPException(status_code=400, detail="Invalid panel index")
    
    panel = panels[panel_index]
    panel_name = panel.get("name", f"XuiOne Panel {panel_index + 1}")
    
    service = get_xuione_service(panel)
    if not service:
        raise HTTPException(status_code=500, detail="XuiOne service not available")
    
    result = service.get_packages()
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to fetch packages"))
    
    packages = result.get("packages", [])
    
    # Separate regular and trial packages
    regular_packages = [p for p in packages if not p.get('is_trial')]
    trial_packages = [p for p in packages if p.get('is_trial')]
    
    # Return packages for selection in the product form (DO NOT create products automatically)
    return {
        "success": True,
        "packages": regular_packages,
        "trial_packages": trial_packages,
        "all_packages": packages,
        "count": len(regular_packages),
        "trial_count": len(trial_packages),
        "total_count": len(packages),
        "panel_name": panel_name,
        "panel_index": panel_index
    }

@app.get("/api/admin/xuione/sync-bouquets")
async def sync_xuione_bouquets(panel_index: int = 0, current_user: dict = Depends(get_current_admin_user)):
    """Sync bouquets from XuiOne panel"""
    settings = await get_settings()
    panels = settings.get("xuione", {}).get("panels", [])
    
    if panel_index >= len(panels):
        raise HTTPException(status_code=400, detail="Invalid panel index")
    
    panel = panels[panel_index]
    panel_name = panel.get("name", f"XuiOne Panel {panel_index + 1}")
    
    service = get_xuione_service(panel)
    if not service:
        raise HTTPException(status_code=500, detail="XuiOne service not available")
    
    result = service.get_bouquets()
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to fetch bouquets"))
    
    bouquets = result.get("bouquets", [])
    
    # Store bouquets in settings
    if "xuione" not in settings:
        settings["xuione"] = {}
    if "panels" not in settings["xuione"]:
        settings["xuione"]["panels"] = panels
    
    # Update panel with bouquets
    settings["xuione"]["panels"][panel_index]["bouquets"] = bouquets
    
    await settings_collection.update_one(
        {},
        {"$set": {"xuione": settings["xuione"]}},
        upsert=True
    )
    
    return {
        "message": f"Synced {len(bouquets)} bouquets from {panel_name}",
        "bouquets": bouquets,
        "panel_name": panel_name
    }

@app.post("/api/admin/xuione/sync-users")
async def sync_xuione_users(panel_index: int = 0, current_user: dict = Depends(get_current_admin_user)):
    """Sync users from XuiOne panel to billing system (1:1 mirror)"""
    settings = await get_settings()
    panels = settings.get("xuione", {}).get("panels", [])
    
    if panel_index >= len(panels):
        raise HTTPException(status_code=400, detail="Invalid panel index")
    
    panel = panels[panel_index]
    panel_name = panel.get("name", f"XuiOne Panel {panel_index + 1}")
    
    service = get_xuione_service(panel)
    if not service:
        raise HTTPException(status_code=500, detail="XuiOne service not available")
    
    synced_count = 0
    updated_count = 0
    removed_count = 0
    total_users = 0
    
    xuione_subscriber_usernames = set()
    xuione_reseller_usernames = set()
    
    # Sync subscribers
    result = service.get_users()
    
    if result.get("success"):
        users_data = result.get("users", [])
        total_users += len(users_data)
        
        for user_data in users_data:
            username = user_data.get("username", "")
            if not username:
                continue
            
            xuione_subscriber_usernames.add(username)
            
            existing = await imported_users_collection.find_one({
                "username": username,
                "panel_index": panel_index,
                "panel_type": "xuione",
                "account_type": "subscriber"
            })
            
            expiry_str = user_data.get("expiry", "")
            expiry_date = None
            if expiry_str and expiry_str not in ["Unlimited", "NEVER", ""]:
                date_formats = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]
                for fmt in date_formats:
                    try:
                        expiry_date = datetime.strptime(expiry_str.strip(), fmt)
                        break
                    except ValueError:
                        continue
            
            status = "active"
            if expiry_date and expiry_date < datetime.utcnow():
                status = "expired"
            
            user_doc = {
                "panel_index": panel_index,
                "panel_name": panel_name,
                "panel_type": "xuione",
                "username": username,
                "password": user_data.get("password", ""),
                "expiry_date": expiry_date,
                "status": status,
                "max_connections": int(float(user_data.get("max_connections", 1) or 1)),
                "account_type": "subscriber",
                "last_synced": datetime.utcnow()
            }
            
            if existing:
                await imported_users_collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": user_doc}
                )
                updated_count += 1
            else:
                user_doc["created_at"] = datetime.utcnow()
                user_doc["xtream_user_id"] = user_data.get("user_id", 0)
                await imported_users_collection.insert_one(user_doc)
                synced_count += 1
    
    # Sync subresellers
    reseller_result = service.get_subresellers()
    reseller_synced = 0
    reseller_updated = 0
    
    if reseller_result.get("success"):
        resellers_data = reseller_result.get("users", [])
        total_users += len(resellers_data)
        
        for reseller_data in resellers_data:
            username = reseller_data.get("username", "")
            if not username:
                continue
            
            xuione_reseller_usernames.add(username)
            
            existing = await imported_users_collection.find_one({
                "username": username,
                "panel_index": panel_index,
                "panel_type": "xuione",
                "account_type": "reseller"
            })
            
            expiry_str = reseller_data.get("expiry", "NEVER")
            expiry_date = None
            if expiry_str and expiry_str not in ["Unlimited", "NEVER", ""]:
                date_formats = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]
                for fmt in date_formats:
                    try:
                        expiry_date = datetime.strptime(expiry_str.strip(), fmt)
                        break
                    except ValueError:
                        continue
            
            reseller_doc = {
                "panel_index": panel_index,
                "panel_name": panel_name,
                "panel_type": "xuione",
                "username": username,
                "password": "",
                "expiry_date": expiry_date,
                "status": "active",
                "credits": float(reseller_data.get("credits", 0) or 0),
                "member_group": reseller_data.get("member_group", ""),
                "owner": reseller_data.get("owner", ""),
                "account_type": "reseller",
                "last_synced": datetime.utcnow()
            }
            
            if existing:
                await imported_users_collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": reseller_doc}
                )
                reseller_updated += 1
                updated_count += 1
            else:
                reseller_doc["created_at"] = datetime.utcnow()
                reseller_doc["xtream_user_id"] = reseller_data.get("user_id", 0)
                await imported_users_collection.insert_one(reseller_doc)
                reseller_synced += 1
                synced_count += 1
    
    # Cleanup stale users
    if xuione_subscriber_usernames:
        stale = await imported_users_collection.find({
            "panel_index": panel_index,
            "panel_type": "xuione",
            "account_type": "subscriber",
            "username": {"$nin": list(xuione_subscriber_usernames)}
        }).to_list(None)
        if stale:
            await imported_users_collection.delete_many({"_id": {"$in": [s["_id"] for s in stale]}})
            removed_count += len(stale)
    
    stale_resellers = await imported_users_collection.find({
        "panel_index": panel_index,
        "panel_type": "xuione",
        "account_type": "reseller",
        "username": {"$nin": list(xuione_reseller_usernames)}
    }).to_list(None)
    if stale_resellers:
        await imported_users_collection.delete_many({"_id": {"$in": [s["_id"] for s in stale_resellers]}})
        removed_count += len(stale_resellers)
    
    return {
        "success": True,
        "synced": synced_count,
        "updated": updated_count,
        "removed": removed_count,
        "total": total_users,
        "panel_name": panel_name
    }

# ===== EMAIL MANAGEMENT ENDPOINTS =====

class TestEmailRequest(BaseModel):
    email: str

class MassEmailRequest(BaseModel):
    subject: str
    content: str
    recipient_filter: str = "all"  # all, active, inactive

@app.post("/api/admin/email/test")
async def send_test_email(request: TestEmailRequest, current_user: dict = Depends(get_current_admin_user)):
    """Send a test email to verify SMTP settings"""
    email_service = await get_configured_email_service()
    
    if not email_service or not email_service.enabled:
        raise HTTPException(status_code=400, detail="SMTP is not configured. Please configure SMTP settings first.")
    
    test_content = f"""
    <p>This is a test email from your billing system.</p>
    <p>If you're receiving this, your SMTP settings are configured correctly!</p>
    <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <strong>SMTP Configuration:</strong>
        <ul style="margin: 10px 0;">
            <li>Host: {smtp_settings.get('host', 'Not set')}</li>
            <li>Port: {smtp_settings.get('port', 587)}</li>
            <li>From: {smtp_settings.get('from_email', 'Not set')}</li>
        </ul>
    </div>
    <p>Sent at: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
    """
    
    success = await email_service.send_email(
        request.email,
        "Test Email - SMTP Configuration Verified ✓",
        email_service._wrap_email(test_content, "Test Email")
    )
    
    if success:
        return {"message": f"Test email sent successfully to {request.email}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send test email. Please check your SMTP settings and logs.")

@app.post("/api/admin/email/mass")
async def send_mass_email(request: MassEmailRequest, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_admin_user)):
    """Send mass email to customers"""
    email_service = await get_configured_email_service()
    
    if not email_service or not email_service.enabled:
        raise HTTPException(status_code=400, detail="SMTP is not configured")
    
    # Get recipients based on filter
    query = {"role": "user"}
    
    if request.recipient_filter == "active":
        # Users with active services
        active_user_ids = await db.services.distinct("user_id", {"status": "active"})
        query["_id"] = {"$in": [str_to_objectid(uid) for uid in active_user_ids]}
    elif request.recipient_filter == "inactive":
        # Users without active services
        active_user_ids = await db.services.distinct("user_id", {"status": "active"})
        query["_id"] = {"$nin": [str_to_objectid(uid) for uid in active_user_ids]}
    
    recipients = []
    async for user in users_collection.find(query):
        recipients.append({
            "email": user["email"],
            "name": user["name"],
            "customer_id": str(user["_id"])
        })
    
    if not recipients:
        raise HTTPException(status_code=400, detail="No recipients found matching the filter")
    
    # Send emails in background (wrapping will happen per-recipient in send_bulk_email)
    async def send_emails_task():
        results = await email_service.send_bulk_email(
            recipients, 
            request.subject,
            request.content,  # Raw content, will be wrapped and personalized per recipient
            email_type="marketing",
            sent_by=current_user["sub"]
        )
        logger.info(f"Mass email completed: {results['sent']} sent, {results['failed']} failed")
        
        # Result is already logged by email_service per email
    
    background_tasks.add_task(send_emails_task)
    
    return {
        "message": f"Mass email queued for {len(recipients)} recipients",
        "recipient_count": len(recipients)
    }

@app.get("/api/admin/email/logs")
async def get_email_logs(current_user: dict = Depends(get_current_admin_user)):
    """Get mass email logs"""
    logs = []
    async for log in db.email_logs.find().sort("created_at", -1).limit(50):
        log["id"] = str(log["_id"])
        del log["_id"]
        logs.append(log)
    return logs


# ===== EMAIL TEMPLATE ENDPOINTS =====

@app.get("/api/admin/email/templates")
async def get_email_templates(current_user: dict = Depends(get_current_admin_user)):
    """Get all email templates"""
    templates = []
    async for template in email_templates_collection.find().sort("created_at", 1):
        template["id"] = str(template["_id"])
        del template["_id"]
        templates.append(template)
    return templates

@app.get("/api/admin/email/templates/{template_id}")
async def get_email_template(template_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Get a single email template"""
    template = await email_templates_collection.find_one({"_id": str_to_objectid(template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template["id"] = str(template["_id"])
    del template["_id"]
    return template

@app.put("/api/admin/email/templates/{template_id}")
async def update_email_template(
    template_id: str, 
    update_data: EmailTemplateUpdate, 
    current_user: dict = Depends(get_current_admin_user)
):
    """Update an email template"""
    template = await email_templates_collection.find_one({"_id": str_to_objectid(template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Build update dict with only provided fields
    update_dict = {}
    if update_data.name is not None:
        update_dict["name"] = update_data.name
    if update_data.subject is not None:
        update_dict["subject"] = update_data.subject
    if update_data.html_content is not None:
        update_dict["html_content"] = update_data.html_content
    if update_data.text_content is not None:
        update_dict["text_content"] = update_data.text_content
    if update_data.is_active is not None:
        update_dict["is_active"] = update_data.is_active
    
    update_dict["updated_at"] = datetime.utcnow()
    
    await email_templates_collection.update_one(
        {"_id": str_to_objectid(template_id)},
        {"$set": update_dict}
    )
    
    return {"message": "Template updated successfully"}

@app.post("/api/admin/email/templates/{template_id}/preview")
async def preview_email_template(
    template_id: str,
    sample_data: dict,
    current_user: dict = Depends(get_current_admin_user)
):
    """Preview an email template with sample data"""
    template = await email_templates_collection.find_one({"_id": str_to_objectid(template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Replace variables in template
    subject = template["subject"]
    html_content = template["html_content"]
    
    for key, value in sample_data.items():
        subject = subject.replace(f"{{{{{key}}}}}", str(value))
        html_content = html_content.replace(f"{{{{{key}}}}}", str(value))
    
    # Get email service to wrap content
    email_service = await get_configured_email_service()
    
    wrapped_html = email_service._wrap_email(html_content, template["name"])
    
    return {
        "subject": subject,
        "html_content": wrapped_html,
        "original_html": html_content
    }

@app.post("/api/admin/email/templates/{template_id}/test")
async def test_email_template(
    template_id: str,
    test_data: dict,
    current_user: dict = Depends(get_current_admin_user)
):
    """Send a test email using a template"""
    if "test_email" not in test_data:
        raise HTTPException(status_code=400, detail="test_email is required")
    
    template = await email_templates_collection.find_one({"_id": str_to_objectid(template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get email service
    email_service = await get_configured_email_service()
    
    if not email_service or not email_service.enabled:
        raise HTTPException(status_code=400, detail="SMTP is not configured")
    
    # Replace variables
    subject = template["subject"]
    html_content = template["html_content"]
    
    for key, value in test_data.items():
        if key != "test_email":
            subject = subject.replace(f"{{{{{key}}}}}", str(value))
            html_content = html_content.replace(f"{{{{{key}}}}}", str(value))
    
    wrapped_html = email_service._wrap_email(html_content, template["name"])
    
    # Send test email
    success = await email_service.send_email(
        test_data["test_email"],
        f"[TEST] {subject}",
        wrapped_html
    )
    
    if success:
        return {"message": f"Test email sent to {test_data['test_email']}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send test email")




# ===== FILE UPLOAD ENDPOINTS =====

# Dynamic upload directory (works in any installation path)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads", "attachments")
HERO_IMAGES_DIR = os.path.join(BASE_DIR, "uploads", "hero")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(HERO_IMAGES_DIR, exist_ok=True)

@app.post("/api/admin/upload/hero-image")
async def upload_hero_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_admin_user)
):
    """Upload hero background image"""
    # Validate file size (max 5MB)
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, and WebP images are allowed")
    
    # Read file content
    contents = await file.read()
    file_size = len(contents)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"hero_{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(HERO_IMAGES_DIR, unique_filename)
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(contents)
    
    # Return file info
    return {
        "filename": file.filename,
        "stored_filename": unique_filename,
        "size": file_size,
        "url": f"{os.getenv('BACKEND_PUBLIC_URL', '')}/api/uploads/hero/{unique_filename}"
    }

@app.post("/api/admin/upload/attachment")
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_admin_user)
):
    """Upload email attachment"""
    # Validate file size (max 10MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    # Read file content
    contents = await file.read()
    file_size = len(contents)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(contents)
    
    # Return file info
    return {
        "filename": file.filename,
        "stored_filename": unique_filename,
        "size": file_size,
        "path": f"/api/uploads/attachments/{unique_filename}",
        "url": f"{os.getenv('BACKEND_PUBLIC_URL', '')}/api/uploads/attachments/{unique_filename}"
    }

@app.delete("/api/admin/upload/attachment/{filename}")
async def delete_attachment(filename: str, current_user: dict = Depends(get_current_admin_user)):
    """Delete an uploaded attachment"""
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        os.remove(file_path)
        return {"message": "File deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

# Serve uploaded files (use dynamic path)
UPLOAD_BASE_DIR = os.path.dirname(os.path.abspath(__file__)) + "/uploads"
os.makedirs(UPLOAD_BASE_DIR, exist_ok=True)
os.makedirs(f"{UPLOAD_BASE_DIR}/attachments", exist_ok=True)
os.makedirs(f"{UPLOAD_BASE_DIR}/downloads", exist_ok=True)

app.mount("/api/uploads", StaticFiles(directory=UPLOAD_BASE_DIR), name="uploads")

# ===== EMAIL LOGS & HISTORY ENDPOINTS =====

@app.get("/api/admin/email/logs/all")
async def get_all_email_logs(
    limit: int = 50,
    skip: int = 0,
    status: Optional[str] = None,
    email_type: Optional[str] = None,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get all email logs with filtering"""
    query = {}
    if status:
        query["status"] = status
    if email_type:
        query["email_type"] = email_type
    
    logs = []
    cursor = email_logs_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    
    async for log in cursor:
        log["id"] = str(log["_id"])
        del log["_id"]
        # Trim content for list view
        if "html_content" in log:
            log["content_preview"] = log["html_content"][:100] + "..."
            del log["html_content"]
        logs.append(log)
    
    total = await email_logs_collection.count_documents(query)
    
    return {"items": logs, "total": total, "limit": limit, "skip": skip}

@app.get("/api/admin/email/logs/{log_id}")
async def get_email_log_detail(log_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Get full details of a specific email log"""
    log = await email_logs_collection.find_one({"_id": str_to_objectid(log_id)})
    if not log:
        raise HTTPException(status_code=404, detail="Email log not found")
    
    log["id"] = str(log["_id"])
    del log["_id"]
    return log

@app.get("/api/customers/{customer_id}/email-history")
async def get_customer_email_history(
    customer_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get email history for a specific customer"""
    # Verify customer exists and user has permission
    customer = await users_collection.find_one({"_id": str_to_objectid(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Regular users can only see their own history
    if current_user["role"] != "admin" and current_user["sub"] != customer_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    emails = await email_logger.get_customer_history(customer_id, limit)
    return emails

@app.post("/api/admin/email/logs/{log_id}/resend")
async def resend_email(log_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Resend a previously sent email"""
    log = await email_logs_collection.find_one({"_id": str_to_objectid(log_id)})
    if not log:
        raise HTTPException(status_code=404, detail="Email log not found")
    
    # Get email service
    email_service = await get_configured_email_service()
    
    if not email_service or not email_service.enabled:
        raise HTTPException(status_code=400, detail="SMTP is not configured")
    
    # Send email (will be automatically logged by email service)
    success = await email_service.send_email(
        log["recipient_email"],
        f"[RESENT] {log['subject']}",
        log["html_content"],
        log.get("text_content"),
        email_type="transactional",
        customer_id=log.get("customer_id"),
        sent_by=current_user["sub"]
    )
    
    if success:
        return {"message": "Email resent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to resend email")

# ===== EMAIL STATISTICS ENDPOINTS =====

@app.get("/api/admin/email/statistics")
async def get_email_statistics(days: int = 30, current_user: dict = Depends(get_current_admin_user)):
    """Get email statistics for dashboard"""
    from datetime import timedelta
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Overall stats
    total = await email_logs_collection.count_documents({"created_at": {"$gte": start_date}})
    sent = await email_logs_collection.count_documents({"status": "sent", "created_at": {"$gte": start_date}})
    failed = await email_logs_collection.count_documents({"status": "failed", "created_at": {"$gte": start_date}})
    bounced = await email_logs_collection.count_documents({"status": "bounced", "created_at": {"$gte": start_date}})
    
    # By type
    transactional = await email_logs_collection.count_documents({"email_type": "transactional", "created_at": {"$gte": start_date}})
    marketing = await email_logs_collection.count_documents({"email_type": "marketing", "created_at": {"$gte": start_date}})
    
    # By template
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}, "template_type": {"$ne": None}}},
        {"$group": {"_id": "$template_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    
    template_stats = []
    async for stat in email_logs_collection.aggregate(pipeline):
        template_stats.append({"template": stat["_id"], "count": stat["count"]})
    
    # Unsubscribe count
    unsubscribes = await email_unsubscribes_collection.count_documents({"unsubscribed_at": {"$gte": start_date}})
    
    return {
        "period_days": days,
        "total": total,
        "sent": sent,
        "failed": failed,
        "bounced": bounced,
        "success_rate": round((sent / total * 100) if total > 0 else 0, 2),
        "by_type": {
            "transactional": transactional,
            "marketing": marketing
        },
        "top_templates": template_stats,
        "unsubscribes": unsubscribes
    }

# ===== UNSUBSCRIBE MANAGEMENT ENDPOINTS =====

@app.post("/api/unsubscribe")
async def unsubscribe_email(
    email: str,
    reason: Optional[str] = None,
    reason_text: Optional[str] = None,
    unsubscribe_type: str = "marketing"
):
    """Public endpoint for email unsubscribe (no auth required)"""
    await unsubscribe_manager.unsubscribe(
        email=email,
        unsubscribe_type=unsubscribe_type,
        reason=reason,
        reason_text=reason_text
    )
    
    return {"message": "You have been unsubscribed successfully"}

@app.post("/api/resubscribe")
async def resubscribe_email(email: str):
    """Public endpoint to resubscribe (no auth required)"""
    await unsubscribe_manager.resubscribe(email)
    return {"message": "You have been resubscribed successfully"}

@app.get("/api/admin/unsubscribes")
async def get_unsubscribes(
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_admin_user)
):
    """Get list of unsubscribed emails"""
    result = await unsubscribe_manager.get_all_unsubscribes(limit, skip)
    return result

@app.delete("/api/admin/unsubscribes/{email}")
async def remove_unsubscribe(email: str, current_user: dict = Depends(get_current_admin_user)):
    """Remove an email from unsubscribe list (admin resubscribes them)"""
    await unsubscribe_manager.resubscribe(email)
    return {"message": f"{email} has been resubscribed"}

# ===== SCHEDULED EMAILS ENDPOINTS =====

@app.post("/api/admin/email/schedule")
async def schedule_mass_email(
    subject: str,
    content: str,
    recipient_filter: str,
    scheduled_for: str,  # ISO datetime string
    current_user: dict = Depends(get_current_admin_user)
):
    """Schedule a mass email for later"""
    from datetime import datetime
    
    try:
        scheduled_datetime = datetime.fromisoformat(scheduled_for.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format")
    
    if scheduled_datetime <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
    
    scheduled_email = {
        "subject": subject,
        "content": content,
        "recipient_filter": recipient_filter,
        "scheduled_for": scheduled_datetime,
        "sent": False,
        "created_by": current_user["sub"],
        "created_at": datetime.utcnow(),
        "cancelled": False
    }
    
    result = await scheduled_emails_collection.insert_one(scheduled_email)
    
    return {
        "message": "Email scheduled successfully",
        "scheduled_id": str(result.inserted_id),
        "scheduled_for": scheduled_datetime.isoformat()
    }

@app.get("/api/admin/email/scheduled")
async def get_scheduled_emails(current_user: dict = Depends(get_current_admin_user)):
    """Get all scheduled emails"""
    scheduled = []
    cursor = scheduled_emails_collection.find({"sent": False, "cancelled": False}).sort("scheduled_for", 1)
    
    async for email in cursor:
        email["id"] = str(email["_id"])
        del email["_id"]
        scheduled.append(email)
    
    return scheduled

@app.delete("/api/admin/email/scheduled/{scheduled_id}")
async def cancel_scheduled_email(scheduled_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Cancel a scheduled email"""
    result = await scheduled_emails_collection.update_one(
        {"_id": str_to_objectid(scheduled_id)},
        {"$set": {"cancelled": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled email not found")
    
    return {"message": "Scheduled email cancelled"}

@app.post("/api/admin/email/scheduled/{scheduled_id}/send-now")
async def send_scheduled_email_now(scheduled_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Send a scheduled email immediately"""
    email_doc = await scheduled_emails_collection.find_one({"_id": str_to_objectid(scheduled_id)})
    
    if not email_doc:
        raise HTTPException(status_code=404, detail="Scheduled email not found")
    
    if email_doc["sent"]:
        raise HTTPException(status_code=400, detail="Email already sent")
    
    # Send via mass email endpoint logic (reuse existing code)
    # Mark as sent
    await scheduled_emails_collection.update_one(
        {"_id": str_to_objectid(scheduled_id)},
        {"$set": {"sent": True, "sent_at": datetime.utcnow()}}
    )
    
    return {"message": "Scheduled email sent successfully"}

# ===== TEMPLATE VERSIONING ENDPOINTS =====

@app.get("/api/admin/email/templates/{template_id}/versions")
async def get_template_versions(template_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Get version history of a template"""
    versions = []
    cursor = template_versions_collection.find({"template_id": template_id}).sort("version_number", -1).limit(20)
    
    async for version in cursor:
        version["id"] = str(version["_id"])
        del version["_id"]
        # Don't return full content in list
        version["content_preview"] = version["html_content"][:100] + "..."
        del version["html_content"]
        versions.append(version)
    
    return versions

@app.post("/api/admin/email/templates/{template_id}/restore/{version_id}")
async def restore_template_version(
    template_id: str,
    version_id: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Restore a template to a previous version"""
    version = await template_versions_collection.find_one({"_id": str_to_objectid(version_id)})
    
    if not version or version["template_id"] != template_id:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Update template
    await email_templates_collection.update_one(
        {"_id": str_to_objectid(template_id)},
        {"$set": {
            "name": version["name"],
            "subject": version["subject"],
            "html_content": version["html_content"],
            "text_content": version.get("text_content", ""),
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": f"Template restored to version {version['version_number']}"}



@app.get("/api/admin/bouquets/sync")
async def sync_bouquets_from_panel(panel_index: int = 0, current_user: dict = Depends(get_current_admin_user)):
    """Fetch bouquets from specific XtreamUI panel and sync to system"""
    settings = await get_settings()
    
    panels = settings.get("xtream", {}).get("panels", [])
    
    if panel_index >= len(panels):
        raise HTTPException(status_code=400, detail="Panel not found")
    
    panel = panels[panel_index]
    
    try:
        # Use session client to fetch bouquets from specific panel
        client = XtreamUISessionClient(
            panel_url=panel["panel_url"],
            username=panel["admin_username"],
            password=panel["admin_password"]
        )
        
        bouquets = client.fetch_bouquets_from_packages()
        
        if bouquets:
            # Save bouquets for this specific panel
            await settings_collection.update_one(
                {},
                {"$set": {f"bouquets_panel_{panel_index}": bouquets, "updated_at": datetime.utcnow()}},
                upsert=True
            )
            
            return {
                "success": True,
                "message": f"Synced {len(bouquets)} bouquets from {panel['name']}",
                "bouquets": bouquets,
                "panel_name": panel['name']
            }
        else:
            raise HTTPException(status_code=500, detail="Could not fetch bouquets from panel")
            
    except Exception as e:
        logger.error(f"Bouquet sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/packages/sync")
async def sync_packages_from_panel(panel_index: int = 0, current_user: dict = Depends(get_current_admin_user)):
    """Fetch both regular AND trial packages from specific XtreamUI panel"""
    settings = await get_settings()
    xtream_settings = settings.get("xtream", {})
    
    panels = xtream_settings.get("panels", [])
    
    if not panels or len(panels) == 0:
        raise HTTPException(status_code=400, detail="No XtreamUI panels configured. Please add a panel in XtreamUI Panel tab.")
    
    if panel_index >= len(panels):
        raise HTTPException(status_code=400, detail=f"Panel index {panel_index} not found. Only {len(panels)} panel(s) configured.")
    
    # Use specified panel
    panel = panels[panel_index]
    
    try:
        client = XtreamUISessionClient(
            panel_url=panel["panel_url"],
            username=panel["admin_username"],
            password=panel["admin_password"]
        )
        
        # Fetch BOTH regular and trial packages
        regular_packages = client.fetch_packages()
        trial_packages = client.fetch_trial_packages()
        
        # Combine packages with type indicator
        all_packages = []
        
        # Add regular packages
        for pkg in regular_packages:
            pkg['package_type'] = 'regular'
            all_packages.append(pkg)
        
        # Add trial packages
        for pkg in trial_packages:
            pkg['package_type'] = 'trial'
            all_packages.append(pkg)
        
        return {
            "success": True,
            "packages": regular_packages,  # Keep backwards compatibility
            "trial_packages": trial_packages,
            "all_packages": all_packages,
            "count": len(regular_packages),
            "trial_count": len(trial_packages),
            "total_count": len(all_packages),
            "panel_name": panel.get("name", f"Panel {panel_index}"),
            "panel_index": panel_index
        }
        
    except Exception as e:
        logger.error(f"Package sync error for panel {panel_index}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/packages/sync-trial")
async def sync_trial_packages_from_panel(panel_index: int = 0, current_user: dict = Depends(get_current_admin_user)):
    """Fetch trial packages from specific XtreamUI panel"""
    settings = await get_settings()
    xtream_settings = settings.get("xtream", {})
    
    panels = xtream_settings.get("panels", [])
    
    if not panels or len(panels) == 0:
        raise HTTPException(status_code=400, detail="No XtreamUI panels configured. Please add a panel in XtreamUI Panel tab.")
    
    if panel_index >= len(panels):
        raise HTTPException(status_code=400, detail=f"Panel index {panel_index} not found. Only {len(panels)} panel(s) configured.")
    
    # Use specified panel
    panel = panels[panel_index]
    
    try:
        client = XtreamUISessionClient(
            panel_url=panel["panel_url"],
            username=panel["admin_username"],
            password=panel["admin_password"]
        )
        
        trial_packages = client.fetch_trial_packages()
        
        return {
            "success": True,
            "packages": trial_packages,
            "count": len(trial_packages),
            "panel_name": panel.get("name", f"Panel {panel_index}"),
            "panel_index": panel_index,
            "is_trial": True
        }
        
    except Exception as e:
        logger.error(f"Trial package sync error for panel {panel_index}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/bouquets")
async def get_bouquets(panel_id: int = 0, panel_type: str = 'xtream', current_user: dict = Depends(get_current_admin_user)):
    """Get available bouquets for a specific panel"""
    settings = await get_settings()
    
    # Get bouquets based on panel type
    if panel_type == 'xuione':
        # Get XuiOne panel bouquets
        xuione_panels = settings.get("xuione", {}).get("panels", [])
        if panel_id < len(xuione_panels):
            panel = xuione_panels[panel_id]
            bouquets = panel.get("bouquets", [])
            if bouquets:
                return bouquets
    else:
        # Get XtreamUI panel bouquets (existing logic)
        xtream_panels = settings.get("xtream", {}).get("panels", [])
        if panel_id < len(xtream_panels):
            panel = xtream_panels[panel_id]
            bouquets = panel.get("bouquets", [])
            if bouquets:
                return bouquets
    
    # Legacy fallback
    panel_bouquets = settings.get(f"bouquets_panel_{panel_id}", [])
    if panel_bouquets:
        return panel_bouquets
    
    legacy_bouquets = settings.get("bouquets", [])
    if legacy_bouquets:
        return legacy_bouquets
    
    # Default bouquets
    return [
        {"id": 1, "name": "All Channels"},
        {"id": 2, "name": "Movies"},
        {"id": 3, "name": "Sports"},
    ]




@app.post("/api/admin/sync-all-users")
async def sync_all_users_from_all_panels(current_user: dict = Depends(get_current_admin_user)):
    """Sync users from ALL active XtreamUI and XuiOne panels"""
    settings = await get_settings()
    
    results = {
        "success": True,
        "panels_synced": [],
        "total_synced": 0,
        "total_updated": 0,
        "total_removed": 0,
        "errors": []
    }
    
    # Sync XtreamUI panels
    xtream_panels = settings.get("xtream", {}).get("panels", [])
    for panel_index, panel in enumerate(xtream_panels):
        panel_name = panel.get("name", f"XtreamUI Panel {panel_index + 1}")
        try:
            logger.info(f"Syncing users from XtreamUI panel: {panel_name}")
            
            xtream_service = get_xtream_service(panel)
            if not xtream_service:
                results["errors"].append(f"{panel_name}: Service not available")
                continue
            
            synced_count = 0
            updated_count = 0
            
            # Sync subscribers using get_reseller_users()
            users_result = xtream_service.get_reseller_users()
            if users_result.get("success"):
                users = users_result.get("users", [])
                for user_data in users:
                    username = user_data.get("username", "")
                    if not username:
                        continue
                    
                    existing = await imported_users_collection.find_one({
                        "panel_index": panel_index,
                        "panel_type": "xtream",
                        "username": username,
                        "account_type": "subscriber"
                    })
                    
                    # Parse expiry date
                    expiry_str = user_data.get("expiry", "")
                    expiry_date = None
                    if expiry_str and expiry_str not in ["Unlimited", "NEVER", ""]:
                        date_formats = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]
                        for fmt in date_formats:
                            try:
                                expiry_date = datetime.strptime(expiry_str.strip(), fmt)
                                break
                            except ValueError:
                                continue
                    
                    status = "active"
                    if expiry_date and expiry_date < datetime.utcnow():
                        status = "expired"
                    
                    user_doc = {
                        "panel_index": panel_index,
                        "panel_type": "xtream",
                        "panel_name": panel_name,
                        "xtream_user_id": user_data.get("user_id", 0),
                        "username": username,
                        "password": user_data.get("password", ""),
                        "expiry_date": expiry_date,
                        "status": status,
                        "max_connections": int(float(user_data.get("max_connections", 1) or 1)),
                        "account_type": "subscriber",
                        "created_by_reseller": user_data.get("created_by", ""),
                        "last_synced": datetime.utcnow()
                    }
                    
                    if existing:
                        await imported_users_collection.update_one(
                            {"_id": existing["_id"]},
                            {"$set": user_doc}
                        )
                        updated_count += 1
                    else:
                        user_doc["created_at"] = datetime.utcnow()
                        await imported_users_collection.insert_one(user_doc)
                        synced_count += 1
            
            # Sync resellers using get_subresellers()
            resellers_result = xtream_service.get_subresellers()
            if resellers_result.get("success"):
                resellers = resellers_result.get("users", [])
                for reseller_data in resellers:
                    username = reseller_data.get("username", "")
                    if not username:
                        continue
                    
                    existing = await imported_users_collection.find_one({
                        "panel_index": panel_index,
                        "panel_type": "xtream",
                        "username": username,
                        "account_type": "reseller"
                    })
                    
                    reseller_doc = {
                        "panel_index": panel_index,
                        "panel_type": "xtream",
                        "panel_name": panel_name,
                        "xtream_user_id": reseller_data.get("user_id", 0),
                        "username": username,
                        "password": reseller_data.get("password", ""),
                        "credits": float(reseller_data.get("credits", 0) or 0),
                        "status": "active",
                        "account_type": "reseller",
                        "member_group": reseller_data.get("member_group", ""),
                        "last_synced": datetime.utcnow()
                    }
                    
                    if existing:
                        await imported_users_collection.update_one(
                            {"_id": existing["_id"]},
                            {"$set": reseller_doc}
                        )
                        updated_count += 1
                    else:
                        reseller_doc["created_at"] = datetime.utcnow()
                        await imported_users_collection.insert_one(reseller_doc)
                        synced_count += 1
            
            results["panels_synced"].append({
                "name": panel_name,
                "type": "xtream",
                "synced": synced_count,
                "updated": updated_count
            })
            results["total_synced"] += synced_count
            results["total_updated"] += updated_count
            
        except Exception as e:
            logger.error(f"Error syncing from {panel_name}: {e}")
            results["errors"].append(f"{panel_name}: {str(e)}")
    
    # Sync XuiOne panels
    xuione_panels = settings.get("xuione", {}).get("panels", [])
    for panel_index, panel in enumerate(xuione_panels):
        panel_name = panel.get("name", f"XuiOne Panel {panel_index + 1}")
        try:
            logger.info(f"Syncing users from XuiOne panel: {panel_name}")
            
            xuione_service = get_xuione_service(panel)
            if not xuione_service:
                results["errors"].append(f"{panel_name}: Service not available")
                continue
            
            synced_count = 0
            updated_count = 0
            
            # Sync subscribers using get_users()
            users_result = xuione_service.get_users()
            if users_result.get("success"):
                users = users_result.get("users", [])
                for user_data in users:
                    username = user_data.get("username", "")
                    if not username:
                        continue
                    
                    existing = await imported_users_collection.find_one({
                        "panel_index": panel_index,
                        "panel_type": "xuione",
                        "username": username,
                        "account_type": "subscriber"
                    })
                    
                    # Parse expiry date
                    expiry_str = user_data.get("expiry", "")
                    expiry_date = None
                    if expiry_str and expiry_str not in ["Unlimited", "NEVER", ""]:
                        date_formats = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]
                        for fmt in date_formats:
                            try:
                                expiry_date = datetime.strptime(expiry_str.strip(), fmt)
                                break
                            except ValueError:
                                continue
                    
                    status = "active"
                    if expiry_date and expiry_date < datetime.utcnow():
                        status = "expired"
                    
                    user_doc = {
                        "panel_index": panel_index,
                        "panel_type": "xuione",
                        "panel_name": panel_name,
                        "xtream_user_id": user_data.get("user_id", 0),
                        "username": username,
                        "password": user_data.get("password", ""),
                        "expiry_date": expiry_date,
                        "status": status,
                        "max_connections": int(float(user_data.get("max_connections", 1) or 1)),
                        "account_type": "subscriber",
                        "last_synced": datetime.utcnow()
                    }
                    
                    if existing:
                        await imported_users_collection.update_one(
                            {"_id": existing["_id"]},
                            {"$set": user_doc}
                        )
                        updated_count += 1
                    else:
                        user_doc["created_at"] = datetime.utcnow()
                        await imported_users_collection.insert_one(user_doc)
                        synced_count += 1
            
            # Sync resellers using get_subresellers()
            resellers_result = xuione_service.get_subresellers()
            if resellers_result.get("success"):
                resellers = resellers_result.get("users", [])
                for reseller_data in resellers:
                    username = reseller_data.get("username", "")
                    if not username:
                        continue
                    
                    existing = await imported_users_collection.find_one({
                        "panel_index": panel_index,
                        "panel_type": "xuione",
                        "username": username,
                        "account_type": "reseller"
                    })
                    
                    reseller_doc = {
                        "panel_index": panel_index,
                        "panel_type": "xuione",
                        "panel_name": panel_name,
                        "xtream_user_id": reseller_data.get("user_id", 0),
                        "username": username,
                        "password": "",
                        "credits": float(reseller_data.get("credits", 0) or 0),
                        "status": "active",
                        "account_type": "reseller",
                        "member_group": reseller_data.get("member_group", ""),
                        "last_synced": datetime.utcnow()
                    }
                    
                    if existing:
                        await imported_users_collection.update_one(
                            {"_id": existing["_id"]},
                            {"$set": reseller_doc}
                        )
                        updated_count += 1
                    else:
                        reseller_doc["created_at"] = datetime.utcnow()
                        await imported_users_collection.insert_one(reseller_doc)
                        synced_count += 1
            
            results["panels_synced"].append({
                "name": panel_name,
                "type": "xuione",
                "synced": synced_count,
                "updated": updated_count
            })
            results["total_synced"] += synced_count
            results["total_updated"] += updated_count
            
        except Exception as e:
            logger.error(f"Error syncing from {panel_name}: {e}")
            results["errors"].append(f"{panel_name}: {str(e)}")
    
    # Clean up users from removed panels
    # Get list of active panel names
    active_xtream_panel_names = [p.get("name") for p in xtream_panels]
    active_xuione_panel_names = [p.get("name") for p in xuione_panels]
    
    # Remove users from XtreamUI panels that no longer exist
    removed_xtream = await imported_users_collection.delete_many({
        "panel_type": "xtream",
        "panel_name": {"$nin": active_xtream_panel_names}
    })
    
    # Remove users from XuiOne panels that no longer exist
    removed_xuione = await imported_users_collection.delete_many({
        "panel_type": "xuione",
        "panel_name": {"$nin": active_xuione_panel_names}
    })
    
    # Also remove users with null panel_type whose panel_name doesn't exist in any active panel
    all_active_panel_names = active_xtream_panel_names + active_xuione_panel_names
    removed_orphans = await imported_users_collection.delete_many({
        "$or": [
            {"panel_type": None, "panel_name": {"$nin": all_active_panel_names}},
            {"panel_type": {"$exists": False}, "panel_name": {"$nin": all_active_panel_names}}
        ]
    })
    
    total_removed = removed_xtream.deleted_count + removed_xuione.deleted_count + removed_orphans.deleted_count
    results["total_removed"] = total_removed
    
    if total_removed > 0:
        logger.info(f"Removed {total_removed} users from deleted panels (XtreamUI: {removed_xtream.deleted_count}, XuiOne: {removed_xuione.deleted_count}, Orphans: {removed_orphans.deleted_count})")
    
    logger.info(f"Sync all users complete: {results['total_synced']} new, {results['total_updated']} updated, {results['total_removed']} removed")
    
    return results


@app.post("/api/admin/xtream/sync-users")
async def sync_users_from_panel(panel_index: int = 0, current_user: dict = Depends(get_current_admin_user)):
    """Sync users and subresellers from XtreamUI panel to billing system (1:1 mirror)"""
    settings = await get_settings()
    panels = settings.get("xtream", {}).get("panels", [])
    
    if panel_index >= len(panels):
        raise HTTPException(status_code=400, detail="Invalid panel index")
    
    panel = panels[panel_index]
    panel_name = panel.get("name", f"Panel {panel_index + 1}")
    
    # Initialize XtreamUI service
    xtream_service = get_xtream_service(panel)
    
    if not xtream_service:
        raise HTTPException(status_code=500, detail="XtreamUI service not available")
    
    synced_count = 0
    updated_count = 0
    removed_count = 0
    total_users = 0
    
    # Track all usernames found in XtreamUI for cleanup
    xtream_subscriber_usernames = set()
    xtream_reseller_usernames = set()
    
    # === SYNC SUBSCRIBERS (users table) ===
    result = xtream_service.get_reseller_users()
    
    if result.get("success"):
        users_data = result.get("users", [])
        total_users += len(users_data)
        
        for user_data in users_data:
            username = user_data.get("username", "")
            if not username:
                continue
            
            xtream_subscriber_usernames.add(username)
            
            existing = await imported_users_collection.find_one({
                "username": username,
                "panel_index": panel_index,
                "account_type": "subscriber"
            })
            
            # Parse expiry date - handle multiple formats
            expiry_str = user_data.get("expiry", "")
            expiry_date = None
            if expiry_str and expiry_str not in ["Unlimited", "NEVER", ""]:
                # Try multiple date formats
                date_formats = [
                    "%Y-%m-%d %H:%M:%S",  # Full datetime: 2026-03-01 17:16:52
                    "%Y-%m-%d",            # Date only: 2026-02-26
                ]
                for fmt in date_formats:
                    try:
                        expiry_date = datetime.strptime(expiry_str.strip(), fmt)
                        break
                    except ValueError:
                        continue
            
            # Determine status
            status = "active"
            if expiry_date and expiry_date < datetime.utcnow():
                status = "expired"
            elif "suspend" in user_data.get("status", "").lower():
                status = "suspended"
            
            user_doc = {
                "panel_index": panel_index,
                "panel_name": panel_name,
                "username": username,
                "password": user_data.get("password", ""),
                "expiry_date": expiry_date,
                "status": status,
                "max_connections": int(float(user_data.get("max_connections", 1) or 1)),
                "account_type": "subscriber",
                "last_synced": datetime.utcnow()
            }
            
            if existing:
                await imported_users_collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": user_doc}
                )
                updated_count += 1
            else:
                user_doc["created_at"] = datetime.utcnow()
                user_doc["xtream_user_id"] = user_data.get("user_id", 0)
                await imported_users_collection.insert_one(user_doc)
                synced_count += 1
    
    # === SYNC SUBRESELLERS (reg_users table) ===
    reseller_result = xtream_service.get_subresellers()
    reseller_synced = 0
    reseller_updated = 0
    
    if reseller_result.get("success"):
        resellers_data = reseller_result.get("users", [])
        total_users += len(resellers_data)
        
        for reseller_data in resellers_data:
            username = reseller_data.get("username", "")
            if not username:
                continue
            
            xtream_reseller_usernames.add(username)
            
            existing = await imported_users_collection.find_one({
                "username": username,
                "panel_index": panel_index,
                "account_type": "reseller"
            })
            
            # Parse expiry - resellers usually have "NEVER"
            expiry_str = reseller_data.get("expiry", "NEVER")
            expiry_date = None
            if expiry_str and expiry_str not in ["Unlimited", "NEVER", ""]:
                # Try multiple date formats
                date_formats = [
                    "%Y-%m-%d %H:%M:%S",  # Full datetime
                    "%Y-%m-%d",            # Date only
                ]
                for fmt in date_formats:
                    try:
                        expiry_date = datetime.strptime(expiry_str.strip(), fmt)
                        break
                    except ValueError:
                        continue
            
            reseller_doc = {
                "panel_index": panel_index,
                "panel_name": panel_name,
                "username": username,
                "password": "",  # Reseller passwords not exposed
                "expiry_date": expiry_date,
                "status": "active",
                "credits": float(reseller_data.get("credits", 0) or 0),
                "member_group": reseller_data.get("member_group", ""),
                "owner": reseller_data.get("owner", ""),
                "account_type": "reseller",
                "last_synced": datetime.utcnow()
            }
            
            if existing:
                await imported_users_collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": reseller_doc}
                )
                reseller_updated += 1
                updated_count += 1
            else:
                reseller_doc["created_at"] = datetime.utcnow()
                reseller_doc["xtream_user_id"] = reseller_data.get("user_id", 0)
                await imported_users_collection.insert_one(reseller_doc)
                reseller_synced += 1
                synced_count += 1
    
    # === CLEANUP: Remove users that no longer exist in XtreamUI ===
    # This ensures the billing panel is a 1:1 mirror of XtreamUI
    
    # Remove subscribers that no longer exist
    if xtream_subscriber_usernames:  # Only cleanup if we got valid data
        stale_subscribers = await imported_users_collection.find({
            "panel_index": panel_index,
            "account_type": "subscriber",
            "username": {"$nin": list(xtream_subscriber_usernames)}
        }).to_list(None)
        
        if stale_subscribers:
            stale_ids = [s["_id"] for s in stale_subscribers]
            await imported_users_collection.delete_many({"_id": {"$in": stale_ids}})
            removed_count += len(stale_subscribers)
    
    # Remove resellers that no longer exist (only if we got valid reseller data)
    # Note: Empty reseller list is valid (e.g., no direct subresellers)
    stale_resellers = await imported_users_collection.find({
        "panel_index": panel_index,
        "account_type": "reseller",
        "username": {"$nin": list(xtream_reseller_usernames)}
    }).to_list(None)
    
    if stale_resellers:
        stale_ids = [s["_id"] for s in stale_resellers]
        await imported_users_collection.delete_many({"_id": {"$in": stale_ids}})
        removed_count += len(stale_resellers)
    
    return {
        "success": True,
        "synced": synced_count,
        "updated": updated_count,
        "removed": removed_count,
        "total": total_users,
        "panel_name": panel_name,
        "details": {
            "subscribers": {"synced": synced_count - reseller_synced, "updated": updated_count - reseller_updated},
            "resellers": {"synced": reseller_synced, "updated": reseller_updated},
            "removed": removed_count
        }
    }

@app.get("/api/admin/imported-users")
async def get_imported_users(panel_index: Optional[int] = None, current_user: dict = Depends(get_current_admin_user)):
    """Get all imported XtreamUI users"""
    query = {}
    if panel_index is not None:
        query["panel_index"] = panel_index
    
    users = []
    async for user in imported_users_collection.find(query).sort([("panel_index", 1), ("username", 1)]):
        user["id"] = str(user["_id"])
        del user["_id"]
        users.append(user)
    
    return users

@app.post("/api/admin/imported-users/{user_id}/suspend")
async def suspend_imported_user(user_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Suspend an imported user on XtreamUI or XuiOne panel"""
    user = await imported_users_collection.find_one({"_id": str_to_objectid(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get panel settings
    settings = await get_settings()
    panel_type = user.get("panel_type", "xtream")
    panel_index = user.get("panel_index", 0)
    
    if panel_type == "xtream":
        # XtreamUI suspension
        panels = settings.get("xtream", {}).get("panels", [])
        
        if panel_index >= len(panels):
            raise HTTPException(status_code=400, detail="Invalid panel")
        
        panel = panels[panel_index]
        xtream_service = XtreamUIService(
            panel_url=panel["panel_url"],
            admin_username=panel["admin_username"],
            admin_password=panel["admin_password"]
        )
        
        # Use stored user_id if available
        xtream_user_id = user.get("xtream_user_id")
        
        result = xtream_service.suspend_account(
            username=user["username"],
            password=user.get("password", ""),
            user_id=str(xtream_user_id) if xtream_user_id else None
        )
        
        if result.get("success"):
            await imported_users_collection.update_one(
                {"_id": str_to_objectid(user_id)},
                {"$set": {"status": "suspended", "last_synced": datetime.utcnow()}}
            )
            return {"message": "User suspended successfully on XtreamUI panel"}
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to suspend"))
    
    elif panel_type == "xuione":
        # XuiOne suspension
        panels = settings.get("xuione", {}).get("panels", [])
        
        if panel_index >= len(panels):
            raise HTTPException(status_code=400, detail="Invalid panel")
        
        panel = panels[panel_index]
        xuione_service = XuiOneService(
            panel_url=panel["panel_url"],
            api_access_code=panel.get("api_access_code", ""),
            api_key=panel.get("api_key", ""),
            admin_username=panel["admin_username"],
            admin_password=panel["admin_password"]
        )
        
        # Login and disable line
        if xuione_service.login():
            line_id = user.get("xtream_user_id")  # XuiOne line ID
            if line_id:
                api_url = xuione_service.get_api_url()
                response = xuione_service.session.post(
                    api_url,
                    params={'api_key': xuione_service.api_key, 'action': 'edit_line'},
                    data={'id': str(line_id), 'enabled': '0'},
                    timeout=30
                )
                
                if response.status_code == 200:
                    await imported_users_collection.update_one(
                        {"_id": str_to_objectid(user_id)},
                        {"$set": {"status": "suspended", "last_synced": datetime.utcnow()}}
                    )
                    return {"message": "User suspended successfully on XuiOne panel"}
                else:
                    raise HTTPException(status_code=500, detail=f"XuiOne API error: {response.status_code}")
            else:
                raise HTTPException(status_code=400, detail="User ID not found for XuiOne line")
        else:
            raise HTTPException(status_code=500, detail="XuiOne login failed")
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown panel type: {panel_type}")

@app.post("/api/admin/imported-users/{user_id}/activate")
async def activate_imported_user(user_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Activate/enable an imported user on XtreamUI or XuiOne panel"""
    user = await imported_users_collection.find_one({"_id": str_to_objectid(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get panel settings
    settings = await get_settings()
    panel_type = user.get("panel_type", "xtream")
    panel_index = user.get("panel_index", 0)
    
    if panel_type == "xtream":
        # XtreamUI activation
        panels = settings.get("xtream", {}).get("panels", [])
        
        if panel_index >= len(panels):
            raise HTTPException(status_code=400, detail="Invalid panel")
        
        panel = panels[panel_index]
        xtream_service = XtreamUIService(
            panel_url=panel["panel_url"],
            admin_username=panel["admin_username"],
            admin_password=panel["admin_password"]
        )
        
        # Use stored user_id if available
        xtream_user_id = user.get("xtream_user_id")
        
        result = xtream_service.unsuspend_account(
            username=user["username"],
            password=user.get("password", ""),
            user_id=str(xtream_user_id) if xtream_user_id else None
        )
        
        if result.get("success"):
            await imported_users_collection.update_one(
                {"_id": str_to_objectid(user_id)},
                {"$set": {"status": "active", "last_synced": datetime.utcnow()}}
            )
            return {"message": "User activated successfully on XtreamUI panel"}
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to activate"))
    
    elif panel_type == "xuione":
        # XuiOne activation
        panels = settings.get("xuione", {}).get("panels", [])
        
        if panel_index >= len(panels):
            raise HTTPException(status_code=400, detail="Invalid panel")
        
        panel = panels[panel_index]
        xuione_service = XuiOneService(
            panel_url=panel["panel_url"],
            api_access_code=panel.get("api_access_code", ""),
            api_key=panel.get("api_key", ""),
            admin_username=panel["admin_username"],
            admin_password=panel["admin_password"]
        )
        
        # Login and enable line
        if xuione_service.login():
            line_id = user.get("xtream_user_id")  # XuiOne line ID
            if line_id:
                api_url = xuione_service.get_api_url()
                response = xuione_service.session.post(
                    api_url,
                    params={'api_key': xuione_service.api_key, 'action': 'edit_line'},
                    data={'id': str(line_id), 'enabled': '1'},  # Enable with enabled=1
                    timeout=30
                )
                
                if response.status_code == 200:
                    await imported_users_collection.update_one(
                        {"_id": str_to_objectid(user_id)},
                        {"$set": {"status": "active", "last_synced": datetime.utcnow()}}
                    )
                    return {"message": "User activated successfully on XuiOne panel"}
                else:
                    raise HTTPException(status_code=500, detail=f"XuiOne API error: {response.status_code}")
            else:
                raise HTTPException(status_code=400, detail="User ID not found for XuiOne line")
        else:
            raise HTTPException(status_code=500, detail="XuiOne login failed")
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown panel type: {panel_type}")


# ===== UPDATE SYSTEM ENDPOINTS =====

from update_manager import update_manager

@app.get("/api/admin/updates/check")
async def check_for_updates(current_user: dict = Depends(get_current_admin_user)):
    """Check if updates are available from GitHub"""
    result = update_manager.check_for_updates()
    return result

@app.post("/api/admin/updates/apply")
async def apply_update(current_user: dict = Depends(get_current_admin_user)):
    """Apply available updates with backup"""
    try:
        # Create backup first
        backup_path = update_manager.create_backup()
        
        # Apply update
        result = update_manager.apply_update(backup_path)
        
        if result.get("success"):
            # Return success response first
            response_data = {
                "message": "Update applied successfully! Services will restart in 5 seconds.",
                "version": result.get("version"),
                "success": True
            }
            
            # Schedule restart after response is sent (increased delay for production)
            import threading
            def restart_delayed():
                import time
                time.sleep(5)  # Increased from 3 to 5 seconds for production
                logger.info("Restarting services after update...")
                try:
                    update_manager.restart_services()
                except Exception as e:
                    logger.error(f"Failed to restart services: {e}")
            
            thread = threading.Thread(target=restart_delayed)
            thread.daemon = True
            thread.start()
            
            logger.info("Update response sent, restart scheduled")
            return response_data
        else:
            return {
                "message": f"Update failed: {result.get('error')}",
                "error": result.get("error"),
                "success": False
            }
            
    except Exception as e:
        logger.error(f"Update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/updates/backups/{backup_name}")
async def delete_backup(backup_name: str, current_user: dict = Depends(get_current_admin_user)):
    """Delete a backup"""
    backup_path = f"{update_manager.backup_dir}/{backup_name}"
    
    logger.info(f"Attempting to delete backup: {backup_path}")
    logger.info(f"Backup dir: {update_manager.backup_dir}")
    logger.info(f"Backup exists: {os.path.exists(backup_path)}")
    
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup not found")
    
    try:
        import shutil
        shutil.rmtree(backup_path)
        logger.info(f"✓ Deleted backup: {backup_name}")
        return {"message": f"Backup {backup_name} deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete backup {backup_name}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to delete backup: {e}")


@app.get("/api/admin/updates/backups")
async def list_backups(current_user: dict = Depends(get_current_admin_user)):
    """List available backups"""
    backups = update_manager.list_backups()
    return {"backups": backups}

@app.post("/api/admin/updates/rollback/{backup_name}")
async def rollback_to_backup(backup_name: str, current_user: dict = Depends(get_current_admin_user)):
    """Rollback to a specific backup"""
    backup_path = f"/app/backups/{backup_name}"
    
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup not found")
    
    success = update_manager.rollback(backup_path)
    
    if success:
        # Restart services
        import threading
        def restart_delayed():
            import time
            time.sleep(2)
            update_manager.restart_services()
        
        thread = threading.Thread(target=restart_delayed)
        thread.start()
        
        return {"message": "Rollback successful. Services will restart in 2 seconds."}
    else:
        raise HTTPException(status_code=500, detail="Rollback failed")

# ===== BACKUP MANAGEMENT ENDPOINTS =====
from backup_manager import backup_manager

@app.post("/api/admin/backups/create")
async def create_manual_backup(data: dict, current_user: dict = Depends(get_current_admin_user)):
    """Create a manual backup"""
    description = data.get("description", "")
    result = backup_manager.create_manual_backup(description)
    
    if result.get("success"):
        return result
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Backup creation failed"))

@app.get("/api/admin/backups/list")
async def list_all_backups(current_user: dict = Depends(get_current_admin_user)):
    """List all backups (manual and auto)"""
    backups = backup_manager.list_backups()
    return {"backups": backups}

@app.post("/api/admin/backups/restore/{backup_name}")
async def restore_from_backup(backup_name: str, current_user: dict = Depends(get_current_admin_user)):
    """Restore from a backup"""
    success = backup_manager.restore_backup(backup_name)
    
    if success:
        # Restart services
        import threading
        def restart_delayed():
            import time
            time.sleep(2)
            update_manager.restart_services()
        
        thread = threading.Thread(target=restart_delayed)
        thread.start()
        
        return {"message": "Backup restored successfully. Services will restart in 2 seconds."}
    else:
        raise HTTPException(status_code=500, detail="Restore failed")

@app.delete("/api/admin/backups/{backup_name}")
async def delete_backup_endpoint(backup_name: str, current_user: dict = Depends(get_current_admin_user)):
    """Delete a backup"""
    success = backup_manager.delete_backup(backup_name)
    
    if success:
        return {"message": "Backup deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete backup")

@app.get("/api/admin/backups/settings")
async def get_backup_settings(current_user: dict = Depends(get_current_admin_user)):
    """Get backup settings"""
    settings = backup_manager.load_settings()
    
    # Don't send sensitive credentials to frontend
    safe_settings = {
        "cloud_backup_enabled": settings.get("cloud_backup_enabled", False),
        "cloud_provider": settings.get("cloud_provider", ""),
        "auto_backup_enabled": settings.get("auto_backup_enabled", False),
        "backup_retention_days": settings.get("backup_retention_days", 30)
    }
    
    return safe_settings

@app.post("/api/admin/backups/settings")
async def update_backup_settings(data: dict, current_user: dict = Depends(get_current_admin_user)):
    """Update backup settings"""
    settings = backup_manager.load_settings()
    
    # Update settings
    if "cloud_backup_enabled" in data:
        settings["cloud_backup_enabled"] = data["cloud_backup_enabled"]
    if "cloud_provider" in data:
        settings["cloud_provider"] = data["cloud_provider"]
    if "auto_backup_enabled" in data:
        settings["auto_backup_enabled"] = data["auto_backup_enabled"]
    if "backup_retention_days" in data:
        settings["backup_retention_days"] = data["backup_retention_days"]
    
    # Store cloud credentials securely
    if "dropbox_access_token" in data:
        settings["dropbox_access_token"] = data["dropbox_access_token"]
    if "google_drive_credentials" in data:
        settings["google_drive_credentials"] = data["google_drive_credentials"]
    if "google_drive_service_account" in data:
        settings["google_drive_service_account"] = data["google_drive_service_account"]
    if "google_drive_auth_type" in data:
        settings["google_drive_auth_type"] = data["google_drive_auth_type"]
    if "proton_drive" in data:
        settings["proton_drive"] = data["proton_drive"]
    
    success = backup_manager.save_settings(settings)
    
    if success:
        return {"message": "Settings saved successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to save settings")

@app.post("/api/admin/backups/test-cloud")
async def test_cloud_connection_endpoint(data: dict, current_user: dict = Depends(get_current_admin_user)):
    """Test cloud storage connection"""
    provider = data.get("provider")
    credentials = data.get("credentials", {})
    
    if not provider:
        raise HTTPException(status_code=400, detail="Provider required")
    
    result = backup_manager.test_cloud_connection(provider, credentials)
    
    if result.get("success"):
        return result
    else:
        raise HTTPException(status_code=400, detail=result.get("error", "Connection test failed"))

@app.get("/api/admin/backups/{backup_name}/download")
async def download_backup(backup_name: str, current_user: dict = Depends(get_current_admin_user)):
    """Download a backup as ZIP archive"""
    import tempfile
    import zipfile
    from fastapi.responses import FileResponse
    
    # Detect app directory
    if os.path.exists("/opt/backend"):
        app_dir = "/opt"
    else:
        app_dir = "/app"
    
    backup_path = f"{app_dir}/backups/{backup_name}"
    
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup not found")
    
    # Create temporary ZIP file
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    temp_zip_path = temp_zip.name
    temp_zip.close()
    
    try:
        # Create ZIP archive
        with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(backup_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, backup_path)
                    zipf.write(file_path, arcname)
        
        # Return as downloadable file
        return FileResponse(
            temp_zip_path,
            media_type='application/zip',
            filename=f"{backup_name}.zip"
        )
    except Exception as e:
        # Clean up temp file on error
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)
        raise HTTPException(status_code=500, detail=f"Failed to create download: {str(e)}")

@app.delete("/api/admin/imported-users/{user_id}")
async def delete_imported_user(user_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Delete an imported user from the billing panel only (does NOT delete from XtreamUI)"""
    user = await imported_users_collection.find_one({"_id": str_to_objectid(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete from billing panel database only
    await imported_users_collection.delete_one({"_id": str_to_objectid(user_id)})
    
    return {"message": f"User '{user.get('username')}' removed from billing panel"}


# Pydantic model for extending imported users
class ExtendImportedUserRequest(BaseModel):
    package_id: int  # Required - the package to extend by


@app.post("/api/admin/imported-users/{user_id}/extend")
async def extend_imported_user(user_id: str, data: ExtendImportedUserRequest, current_user: dict = Depends(get_current_admin_user)):
    """Extend an imported user's subscription on both billing system and panel"""
    
    user = await imported_users_collection.find_one({"_id": str_to_objectid(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user details
    username = user.get("username")
    password = user.get("password")
    panel_type = user.get("panel_type", "xtream")
    panel_index = user.get("panel_index", 0)
    
    # Get current expiry date for response
    current_expiry = user.get("expiry_date")
    
    # Get settings and panel info
    settings = await get_settings()
    days_to_add = 0
    panel_extend_result = None
    
    try:
        if panel_type == "xtream":
            xtream_settings = settings.get("xtream", {})
            panels = xtream_settings.get("panels", [])
            
            if not panels or panel_index >= len(panels):
                raise HTTPException(status_code=400, detail="Panel configuration not found")
            
            panel = panels[panel_index]
            
            # Use XtreamUISessionClient to get packages (same as sync endpoint)
            from xtreamui_session_client import XtreamUISessionClient as ExtendSessionClient
            session_client = ExtendSessionClient(
                panel_url=panel["panel_url"],
                username=panel["admin_username"],
                password=panel["admin_password"]
            )
            
            # Fetch packages using the same method as sync endpoint
            packages_list = session_client.fetch_packages()
            
            selected_package = None
            bouquets = [1]  # Default bouquet
            max_connections = 1
            
            logger.info(f"Looking for package ID {data.package_id} in {len(packages_list)} packages")
            
            for pkg in packages_list:
                logger.info(f"  Package: id={pkg.get('id')}, name={pkg.get('name')}")
                if str(pkg.get("id")) == str(data.package_id):
                    selected_package = pkg
                    duration_val = pkg.get("duration", "1")
                    duration_unit = pkg.get("duration_unit", "months")
                    
                    try:
                        duration = int(duration_val)
                        if duration_unit == "days":
                            days_to_add = duration
                        elif duration_unit == "years":
                            days_to_add = duration * 365
                        else:  # months
                            days_to_add = duration * 30
                    except (ValueError, TypeError):
                        days_to_add = 30
                    
                    max_connections = int(pkg.get("max_connections", 1))
                    bouquets = pkg.get("bouquets", [1])
                    break
            
            if not selected_package:
                logger.error(f"Package {data.package_id} not found in packages: {[p.get('id') for p in packages_list]}")
                raise HTTPException(status_code=400, detail=f"Package not found. Available packages: {[p.get('id') for p in packages_list]}")
            
            logger.info(f"Found package: {selected_package.get('name')}, duration={days_to_add} days")
            
            # Call the panel's extend subscriber method
            logger.info(f"Extending subscriber {username} on XtreamUI panel with package {data.package_id}")
            
            panel_extend_result = session_client.extend_subscriber(
                username=username,
                password=password,
                package_id=data.package_id,
                bouquets=bouquets,
                max_connections=max_connections,
                reseller_notes=f"Extended by Admin - {current_user.get('email', 'Unknown')}"
            )
            
            if not panel_extend_result.get("success"):
                logger.error(f"Panel extend failed: {panel_extend_result.get('error')}")
                raise HTTPException(status_code=500, detail=f"Failed to extend on panel: {panel_extend_result.get('error', 'Unknown error')}")
            
            logger.info(f"✓ Panel extension successful: {panel_extend_result}")
            
        elif panel_type == "xuione":
            xuione_settings = settings.get("xuione", {})
            panels = xuione_settings.get("panels", [])
            
            if not panels or panel_index >= len(panels):
                raise HTTPException(status_code=400, detail="Panel configuration not found")
            
            panel = panels[panel_index]
            
            # Initialize XuiOne service
            xuione_service = XuiOneService(
                panel_url=panel["panel_url"],
                api_access_code=panel.get("api_access_code", ""),
                api_key=panel.get("api_key", ""),
                admin_username=panel["admin_username"],
                admin_password=panel["admin_password"],
                ssl_verify=panel.get("ssl_verify", False)
            )
            
            # Get package details
            packages_result = xuione_service.get_packages()
            selected_package = None
            
            if packages_result.get("success"):
                for pkg in packages_result.get("packages", []):
                    if str(pkg.get("id")) == str(data.package_id):
                        selected_package = pkg
                        duration_val = pkg.get("duration", "1")
                        duration_unit = pkg.get("duration_unit", "months")
                        
                        try:
                            duration = int(duration_val)
                            if duration_unit == "days":
                                days_to_add = duration
                            elif duration_unit == "years":
                                days_to_add = duration * 365
                            else:  # months
                                days_to_add = duration * 30
                        except (ValueError, TypeError):
                            days_to_add = 30
                        break
            
            if not selected_package:
                raise HTTPException(status_code=400, detail="Package not found")
            
            # XuiOne extension via service method
            logger.info(f"Extending XuiOne line {username} with package {data.package_id}")
            
            panel_extend_result = xuione_service.extend_line(username, data.package_id)
            
            if not panel_extend_result.get("success"):
                error_msg = panel_extend_result.get("error", "Unknown error")
                logger.error(f"XuiOne extend failed: {error_msg}")
                raise HTTPException(status_code=500, detail=f"Failed to extend on panel: {error_msg}")
            
            logger.info(f"✓ XuiOne extension successful")
        
        else:
            raise HTTPException(status_code=400, detail="Invalid panel type")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extending user on panel: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extend on panel: {str(e)}")
    
    # Calculate new expiry for billing database
    if current_expiry is None:
        current_expiry = datetime.utcnow()
    elif isinstance(current_expiry, str):
        current_expiry = datetime.fromisoformat(current_expiry.replace('Z', '+00:00'))
    
    # If current expiry is in the past, start from now
    if current_expiry < datetime.utcnow():
        current_expiry = datetime.utcnow()
    
    new_expiry = current_expiry + timedelta(days=days_to_add)
    
    # Update the user in billing database
    await imported_users_collection.update_one(
        {"_id": str_to_objectid(user_id)},
        {
            "$set": {
                "expiry_date": new_expiry,
                "status": "active",  # Reactivate if was expired
                "last_synced": datetime.utcnow()
            }
        }
    )
    
    logger.info(f"Admin {current_user.get('email')} extended user {username} by {days_to_add} days")
    
    return {
        "success": True,
        "message": f"Subscription extended by {days_to_add} days on both billing system and panel",
        "previous_expiry": user.get("expiry_date").isoformat() if user.get("expiry_date") else None,
        "new_expiry": new_expiry.isoformat(),
        "days_added": days_to_add,
        "panel_extended": True
    }


# Pydantic model for creating imported users
class CreateImportedUserRequest(BaseModel):
    panel_type: str = "xtream"  # 'xtream' or 'xuione'
    panel_index: int = 0
    account_type: str = "subscriber"  # 'subscriber' or 'reseller'
    username: Optional[str] = None  # Auto-generate if not provided
    password: Optional[str] = None  # Auto-generate if not provided
    # For subscribers
    package_id: Optional[int] = None
    duration_months: Optional[int] = 1
    max_connections: Optional[int] = 1
    # For resellers
    credits: Optional[float] = 0.0
    member_group_id: Optional[int] = 2


@app.post("/api/admin/imported-users/create")
async def create_imported_user(data: CreateImportedUserRequest, current_user: dict = Depends(get_current_admin_user)):
    """Create a new user directly on the panel and add to imported_users collection"""
    
    settings = await get_settings()
    
    # Generate credentials if not provided
    username = data.username or generate_username()
    password = data.password or generate_password()
    
    panel_type = data.panel_type
    panel_index = data.panel_index
    
    if panel_type == "xtream":
        # XtreamUI panel
        xtream_settings = settings.get("xtream", {})
        panels = xtream_settings.get("panels", [])
        
        if not panels or panel_index >= len(panels):
            raise HTTPException(status_code=400, detail="Invalid XtreamUI panel index")
        
        panel = panels[panel_index]
        panel_name = panel.get("name", f"XtreamUI Panel {panel_index + 1}")
        
        # Initialize XtreamUI service
        xtream_service = XtreamUIService(
            panel_url=panel["panel_url"],
            admin_username=panel["admin_username"],
            admin_password=panel["admin_password"],
            ssl_verify=panel.get("ssl_verify", False)
        )
        
        if data.account_type == "subscriber":
            if not data.package_id:
                raise HTTPException(status_code=400, detail="package_id is required for subscriber creation")
            
            # Fetch package details to get duration and max_connections
            package_duration = 1  # Default 1 month
            package_max_connections = 1  # Default 1 connection
            
            try:
                # Get packages from panel to find the selected one
                packages_result = xtream_service.get_packages()
                if packages_result.get("success"):
                    for pkg in packages_result.get("packages", []):
                        if str(pkg.get("id")) == str(data.package_id):
                            # Parse duration from package
                            duration_val = pkg.get("duration", "1")
                            duration_unit = pkg.get("duration_unit", "months")
                            try:
                                package_duration = int(duration_val)
                                # Convert to months if needed
                                if duration_unit == "days":
                                    package_duration = max(1, package_duration // 30)
                                elif duration_unit == "years":
                                    package_duration = package_duration * 12
                            except (ValueError, TypeError):
                                package_duration = 1
                            
                            # Get max connections
                            try:
                                package_max_connections = int(pkg.get("max_connections", "1"))
                            except (ValueError, TypeError):
                                package_max_connections = 1
                            break
            except Exception as e:
                logger.warning(f"Could not fetch package details: {e}")
            
            # Get bouquets from a product or use all
            bouquets = [1]  # Default bouquet
            
            # Create subscriber using form method
            result = xtream_service.create_subscriber_via_form(
                username=username,
                password=password,
                package_id=data.package_id,
                bouquets=bouquets,
                customer_name=f"Manual - {current_user.get('email', 'Admin')}"
            )
            
            if not result.get("success"):
                raise HTTPException(status_code=500, detail=result.get("error", "Failed to create subscriber on panel"))
            
            # Calculate expiry date using package duration
            expiry_date = datetime.utcnow() + timedelta(days=package_duration * 30)
            
            # Insert into imported_users collection
            user_doc = {
                "panel_index": panel_index,
                "panel_type": "xtream",
                "panel_name": panel_name,
                "xtream_user_id": int(result.get("user_id", 0)),
                "username": username,
                "password": password,
                "expiry_date": expiry_date,
                "status": "active",
                "max_connections": package_max_connections,
                "account_type": "subscriber",
                "created_by_reseller": None,
                "last_synced": datetime.utcnow(),
                "created_at": datetime.utcnow()
            }
            
            await imported_users_collection.insert_one(user_doc)
            
            return {
                "success": True,
                "message": f"Subscriber '{username}' created successfully on {panel_name}",
                "user": {
                    "username": username,
                    "password": password,
                    "panel_name": panel_name,
                    "expiry_date": expiry_date.isoformat(),
                    "account_type": "subscriber",
                    "max_connections": package_max_connections,
                    "duration_months": package_duration
                }
            }
        
        else:  # reseller
            # Create reseller
            result = xtream_service.create_reseller(
                username=username,
                password=password,
                credits=data.credits or 0.0,
                email="",
                member_group_id=data.member_group_id or 2
            )
            
            if not result.get("success"):
                raise HTTPException(status_code=500, detail=result.get("error", "Failed to create reseller on panel"))
            
            # Insert into imported_users collection
            user_doc = {
                "panel_index": panel_index,
                "panel_type": "xtream",
                "panel_name": panel_name,
                "xtream_user_id": int(result.get("user_id", 0)),
                "username": username,
                "password": password,
                "expiry_date": None,  # Resellers don't expire
                "status": "active",
                "credits": data.credits,
                "account_type": "reseller",
                "member_group": f"Group {data.member_group_id}",
                "last_synced": datetime.utcnow(),
                "created_at": datetime.utcnow()
            }
            
            await imported_users_collection.insert_one(user_doc)
            
            return {
                "success": True,
                "message": f"Reseller '{username}' created successfully on {panel_name}",
                "user": {
                    "username": username,
                    "password": password,
                    "panel_name": panel_name,
                    "credits": data.credits,
                    "account_type": "reseller"
                }
            }
    
    elif panel_type == "xuione":
        # XuiOne panel
        xuione_settings = settings.get("xuione", {})
        panels = xuione_settings.get("panels", [])
        
        if not panels or panel_index >= len(panels):
            raise HTTPException(status_code=400, detail="Invalid XuiOne panel index")
        
        panel = panels[panel_index]
        panel_name = panel.get("name", f"XuiOne Panel {panel_index + 1}")
        
        # Initialize XuiOne service
        xuione_service = XuiOneService(
            panel_url=panel["panel_url"],
            api_access_code=panel.get("api_access_code", ""),
            api_key=panel.get("api_key", ""),
            admin_username=panel["admin_username"],
            admin_password=panel["admin_password"],
            ssl_verify=panel.get("ssl_verify", False)
        )
        
        if data.account_type == "subscriber":
            if not data.package_id:
                raise HTTPException(status_code=400, detail="package_id is required for subscriber creation")
            
            if not xuione_service.api_key:
                raise HTTPException(status_code=400, detail="XuiOne API key is required for creating subscribers")
            
            # Login first
            if not xuione_service.logged_in:
                if not xuione_service.login():
                    raise HTTPException(status_code=500, detail="Failed to login to XuiOne panel")
            
            # Fetch package details to get duration and max_connections
            package_duration = 1  # Default 1 month
            package_max_connections = 1  # Default 1 connection
            
            try:
                # Get packages from panel to find the selected one
                packages_result = xuione_service.get_packages()
                if packages_result.get("success"):
                    for pkg in packages_result.get("packages", []):
                        if str(pkg.get("id")) == str(data.package_id):
                            # Parse duration from package
                            duration_val = pkg.get("duration", "1")
                            duration_unit = pkg.get("duration_unit", "months")
                            try:
                                package_duration = int(duration_val)
                                # Convert to months if needed
                                if duration_unit == "days":
                                    package_duration = max(1, package_duration // 30)
                                elif duration_unit == "years":
                                    package_duration = package_duration * 12
                            except (ValueError, TypeError):
                                package_duration = 1
                            
                            # Get max connections
                            try:
                                package_max_connections = int(pkg.get("max_connections", "1"))
                            except (ValueError, TypeError):
                                package_max_connections = 1
                            break
            except Exception as e:
                logger.warning(f"Could not fetch XuiOne package details: {e}")
            
            # Calculate expiry date using package duration
            expiry_date = datetime.utcnow() + timedelta(days=package_duration * 30)
            
            # Use XuiOne API to create line
            api_url = xuione_service.get_api_url()
            
            request_data = {
                'username': username,
                'password': password,
                'package': str(data.package_id),
                'trial': '0',
                'reseller_notes': f'Manual Creation - {current_user.get("email", "Admin")}',
                'is_isplock': '0'
            }
            
            response = xuione_service.session.post(
                api_url,
                params={
                    'api_key': xuione_service.api_key,
                    'action': 'create_line'
                },
                data=request_data,
                timeout=30
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"XuiOne API error: HTTP {response.status_code}")
            
            try:
                result = response.json()
                if result.get('status') != 'STATUS_SUCCESS':
                    raise HTTPException(status_code=500, detail=result.get("message", "Failed to create line"))
            except ValueError:
                raise HTTPException(status_code=500, detail="Invalid response from XuiOne API")
            
            # Insert into imported_users collection
            user_doc = {
                "panel_index": panel_index,
                "panel_type": "xuione",
                "panel_name": panel_name,
                "xtream_user_id": result.get("data", {}).get("id", 0),
                "username": username,
                "password": password,
                "expiry_date": expiry_date,
                "status": "active",
                "max_connections": package_max_connections,
                "account_type": "subscriber",
                "last_synced": datetime.utcnow(),
                "created_at": datetime.utcnow()
            }
            
            await imported_users_collection.insert_one(user_doc)
            
            return {
                "success": True,
                "message": f"Subscriber '{username}' created successfully on {panel_name}",
                "user": {
                    "username": username,
                    "password": password,
                    "panel_name": panel_name,
                    "expiry_date": expiry_date.isoformat(),
                    "account_type": "subscriber",
                    "max_connections": package_max_connections,
                    "duration_months": package_duration
                }
            }
        
        else:  # reseller for XuiOne - might not be supported via API
            raise HTTPException(status_code=400, detail="Reseller creation is not currently supported for XuiOne panels via API")
    
    else:
        raise HTTPException(status_code=400, detail="Invalid panel_type. Must be 'xtream' or 'xuione'")

@app.get("/api/products/{product_id}/channels")
async def get_product_channels(product_id: str):
    """Get LIVE channel list for a product (public endpoint) - excludes VOD and Series"""
    product = await products_collection.find_one({"_id": str_to_objectid(product_id)})
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get bouquet IDs from product
    bouquet_ids = product.get("bouquets", [])
    panel_index = product.get("panel_index", 0)
    
    # Get settings
    settings = await get_settings()
    
    # Get bouquets for the specific panel
    panel_bouquets_key = f"bouquets_panel_{panel_index}"
    panel_bouquets = settings.get(panel_bouquets_key, [])
    
    # Fallback to legacy bouquets if panel-specific not found
    if not panel_bouquets:
        panel_bouquets = settings.get("bouquets", [])
    
    # Get LIVE channel bouquets only (exclude VOD and Series)
    live_channels = []
    for bouquet_id in bouquet_ids:
        # Match by converting both to int for comparison
        bouquet = next((b for b in panel_bouquets if int(b.get("id")) == int(bouquet_id)), None)
        if bouquet:
            bouquet_name = bouquet.get("name", "")
            # Filter out VOD and Series - check both type field and name
            is_vod_or_series = (
                'movie' in bouquet_name.lower() or
                'series' in bouquet_name.lower() or
                'vod' in bouquet_name.lower() or
                '24/7' in bouquet_name.lower()
            )
            
            if not is_vod_or_series:
                live_channels.append({
                    "id": bouquet_id,
                    "name": bouquet_name,
                    "category": bouquet.get("category", "General")
                })
    
    return {
        "product_name": product.get("name"),
        "channels": live_channels,
        "total_packages": len(live_channels),
        "note": "Live TV channels only (excludes movies and series)"
    }

@app.get("/api/bouquets/{bouquet_id}/channels")
async def get_bouquet_channels(bouquet_id: int, panel_index: int = 0):
    """Get individual channels within a bouquet (public endpoint)"""
    # Note: Individual channel listing requires direct database access or XtreamUI API subscription
    # For now, return a helpful message
    
    # Get bouquet name from settings
    settings = await get_settings()
    panel_bouquets_key = f"bouquets_panel_{panel_index}"
    panel_bouquets = settings.get(panel_bouquets_key, [])
    
    bouquet = next((b for b in panel_bouquets if int(b.get("id")) == int(bouquet_id)), None)
    bouquet_name = bouquet.get("name", f"Package {bouquet_id}") if bouquet else f"Package {bouquet_id}"
    
    return {
        "bouquet_id": bouquet_id,
        "bouquet_name": bouquet_name,
        "channels": [],
        "total": 0,
        "message": f"The {bouquet_name} package includes hundreds of live channels. Channel list available after subscription."
    }

@app.get("/api/admin/packages")
async def get_packages(current_user: dict = Depends(get_current_admin_user)):
    """Get available packages from XtreamUI panel"""
    settings = await get_settings()
    xtream_settings = settings.get("xtream", {})
    
    if not xtream_settings.get("panel_url"):
        raise HTTPException(status_code=400, detail="XtreamUI not configured")
    
    # Fetch from XtreamUI panel
    xtream_service = get_xtream_service(xtream_settings)
    result = xtream_service.get_packages()
    
    if result['success']:
        packages_data = result.get('packages', [])
        return {"packages": packages_data, "source": "xtreamui"}
    else:
        return {"packages": [], "source": "none", "error": result.get('error')}

@app.put("/api/admin/bouquets")
async def update_bouquets(bouquets: List[dict], current_user: dict = Depends(get_current_admin_user)):
    """Update bouquet configuration"""
    existing = await settings_collection.find_one()
    if existing:
        await settings_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {"bouquets": bouquets, "updated_at": datetime.utcnow()}}
        )
    else:
        await settings_collection.insert_one({
            "bouquets": bouquets,
            "updated_at": datetime.utcnow()
        })
    
    return {"message": "Bouquets updated successfully"}

@app.post("/api/admin/xtreamui/test")
async def test_xtreamui_connection(current_user: dict = Depends(get_current_admin_user)):
    """Test XtreamUI connection"""
    settings = await get_settings()
    xtream_settings = settings.get("xtream", {})
    
    # Get panels array
    panels = xtream_settings.get("panels", [])
    
    if not panels or len(panels) == 0:
        raise HTTPException(status_code=400, detail="No XtreamUI panels configured. Please add a panel first.")
    
    # Test first active panel
    panel = panels[0]


# ===== REFERRAL SYSTEM ENDPOINTS =====

@app.get("/api/referral/my-code")
async def get_my_referral_code(current_user: dict = Depends(get_current_user)):
    """Get or create user's referral code"""
    user_id = current_user["sub"]
    code = await referral_service.create_referral_code_for_user(user_id)
    
    # Get referral stats
    referrals = await referral_service.get_user_referrals(user_id)
    completed = len([r for r in referrals if r["status"] == "completed"])
    total_earned = sum(r.get("reward_amount", 0) for r in referrals if r.get("rewarded"))
    
    # Get settings for display
    settings = await get_settings()
    referral_settings = settings.get("referral", {})
    credit_settings = settings.get("credit", {})
    
    return {
        "referral_code": code,
        "referral_link": f"{os.getenv('BACKEND_PUBLIC_URL', '')}/register?ref={code}",
        "total_referrals": len(referrals),
        "completed_referrals": completed,
        "total_earned": total_earned,
        "referrals": referrals,
        "settings": {
            "referrer_reward": referral_settings.get("referrer_reward", 10.0),
            "referred_reward": referral_settings.get("referred_reward", 5.0),
            "enabled": referral_settings.get("enabled", True),
            "credit_enabled": credit_settings.get("enabled", True)
        }
    }

@app.get("/api/referral/leaderboard")
async def get_referral_leaderboard():
    """Public leaderboard of top referrers"""
    leaderboard = await referral_service.get_leaderboard(limit=10)
    return leaderboard

@app.post("/api/admin/referral/award/{referral_id}")
async def manually_award_referral(referral_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Manually award referral credits (admin)"""
    await referral_service.award_referral_credits(referral_id)
    return {"message": "Referral credits awarded"}

# ===== COUPON SYSTEM ENDPOINTS =====

class CouponCreate(BaseModel):
    code: str
    coupon_type: str  # percentage or fixed
    value: float
    min_purchase: float = 0.0
    max_uses: Optional[int] = None
    valid_until: Optional[datetime] = None
    applies_to: str = "all"
    product_ids: List[str] = []

@app.post("/api/admin/coupons")
async def create_coupon(coupon_data: CouponCreate, current_user: dict = Depends(get_current_admin_user)):
    """Create a new coupon"""
    # Check if code already exists
    existing = await coupons_collection.find_one({"code": coupon_data.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    
    coupon = {
        "code": coupon_data.code.upper(),
        "coupon_type": coupon_data.coupon_type,
        "value": coupon_data.value,
        "min_purchase": coupon_data.min_purchase,
        "max_uses": coupon_data.max_uses,
        "used_count": 0,
        "valid_from": datetime.utcnow(),
        "valid_until": coupon_data.valid_until,
        "active": True,
        "applies_to": coupon_data.applies_to,
        "product_ids": coupon_data.product_ids,
        "created_by": current_user["sub"],
        "created_at": datetime.utcnow()
    }
    
    result = await coupons_collection.insert_one(coupon)
    return {"message": "Coupon created", "id": str(result.inserted_id), "code": coupon["code"]}

@app.get("/api/admin/coupons")
async def get_all_coupons(current_user: dict = Depends(get_current_admin_user)):
    """Get all coupons"""
    coupons = []
    async for coupon in coupons_collection.find().sort("created_at", -1):
        coupon["id"] = str(coupon["_id"])
        del coupon["_id"]
        
        # Get stats
        stats = await coupon_service.get_coupon_stats(coupon["id"])
        coupon.update(stats)
        
        coupons.append(coupon)
    
    return coupons

@app.post("/api/coupon/validate")
async def validate_coupon_code(code: str, order_total: float, product_ids: List[str] = []):
    """Validate coupon code (public endpoint for checkout)"""
    result = await coupon_service.validate_coupon(code, order_total, product_ids)
    return result

@app.delete("/api/admin/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Delete/deactivate a coupon"""
    await coupons_collection.update_one(
        {"_id": str_to_objectid(coupon_id)},
        {"$set": {"active": False}}
    )
    return {"message": "Coupon deactivated"}

# ===== CREDIT SYSTEM ENDPOINTS =====

@app.get("/api/credits/balance")
async def get_credit_balance(current_user: dict = Depends(get_current_user)):
    """Get user's credit balance"""
    balance = await credit_service.get_balance(current_user["sub"])
    return {"balance": balance}

@app.get("/api/credits/history")
async def get_credit_history(limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get user's credit transaction history"""
    history = await credit_service.get_transaction_history(current_user["sub"], limit)
    return history

@app.post("/api/admin/credits/add")
async def admin_add_credits(
    user_id: str,
    amount: float,
    description: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Admin manually add credits to user"""
    new_balance = await credit_service.add_credits(
        user_id=user_id,
        amount=amount,
        transaction_type="admin_adjustment",
        description=description,
        created_by=current_user["sub"]
    )
    return {"message": f"${amount} credits added", "new_balance": new_balance}

@app.post("/api/admin/credits/deduct")
async def admin_deduct_credits(
    user_id: str,
    amount: float,
    description: str,
    current_user: dict = Depends(get_current_admin_user)
):
    """Admin manually deduct credits from user"""
    new_balance = await credit_service.deduct_credits(
        user_id=user_id,
        amount=amount,
        transaction_type="admin_adjustment",
        description=description
    )
    return {"message": f"${amount} credits deducted", "new_balance": new_balance}


# ===== DOWNLOADS SYSTEM ENDPOINTS =====

class DownloadCreate(BaseModel):
    name: str
    description: str = ""
    category: str
    file_path: str
    file_url: str
    file_size: int
    file_type: str = ""
    version: str = ""
    platform: str = "all"
    requires_active_service: bool = True
    linked_service_types: List[str] = []

@app.post("/api/admin/downloads")
async def create_download(download_data: DownloadCreate, current_user: dict = Depends(get_current_admin_user)):
    """Create a new download"""
    download = {
        "name": download_data.name,
        "description": download_data.description,
        "category": download_data.category,
        "file_path": download_data.file_path,
        "file_url": download_data.file_url,
        "file_size": download_data.file_size,
        "file_type": download_data.file_type,
        "version": download_data.version,
        "platform": download_data.platform,
        "requires_active_service": download_data.requires_active_service,
        "linked_service_types": download_data.linked_service_types,
        "download_count": 0,
        "active": True,
        "created_by": current_user["sub"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await downloads_collection.insert_one(download)
    return {"message": "Download created", "id": str(result.inserted_id)}

@app.get("/api/admin/downloads")
async def get_all_downloads_admin(current_user: dict = Depends(get_current_admin_user)):
    """Get all downloads (admin)"""
    downloads = []
    async for download in downloads_collection.find().sort("created_at", -1):
        download["id"] = str(download["_id"])
        del download["_id"]
        downloads.append(download)
    return downloads

@app.put("/api/admin/downloads/{download_id}")
async def update_download(
    download_id: str,
    update_data: dict,
    current_user: dict = Depends(get_current_admin_user)
):
    """Update a download"""
    update_data["updated_at"] = datetime.utcnow()
    
    await downloads_collection.update_one(
        {"_id": str_to_objectid(download_id)},
        {"$set": update_data}
    )
    return {"message": "Download updated"}

@app.delete("/api/admin/downloads/{download_id}")
async def delete_download(download_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Delete a download"""
    await downloads_collection.delete_one({"_id": str_to_objectid(download_id)})
    return {"message": "Download deleted"}

@app.get("/api/downloads")
async def get_available_downloads(current_user: dict = Depends(get_current_user)):
    """Get downloads available to user based on products they own"""
    user_id = current_user["sub"]
    
    # Get user's active services and their product IDs
    active_services = []
    user_product_ids = []
    async for service in services_collection.find({"user_id": user_id, "status": "active"}):
        active_services.append(service)
        if service.get("product_id"):
            user_product_ids.append(service["product_id"])
    
    has_active_service = len(active_services) > 0
    
    # Get available downloads
    downloads = []
    async for download in downloads_collection.find({"active": True}).sort("category", 1):
        # Check if user can access this download
        can_access = True
        
        # Check if active service is required
        if download.get("requires_active_service", True) and not has_active_service:
            can_access = False
        
        # Check linked products
        linked_products = download.get("linked_service_types", [])  # Will rename to linked_product_ids
        if linked_products and len(linked_products) > 0:
            # Check if user has any of the required products
            user_has_matching = any(
                product_id in linked_products 
                for product_id in user_product_ids
            )
            if not user_has_matching:
                can_access = False
        
        if can_access:
            download["id"] = str(download["_id"])
            del download["_id"]
            downloads.append(download)
    
    return {
        "downloads": downloads,
        "has_active_service": has_active_service
    }

@app.post("/api/downloads/{download_id}/download")
async def track_download(
    download_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Track download and increment counter"""
    # Log download
    await download_logs_collection.insert_one({
        "download_id": download_id,
        "user_id": current_user["sub"],
        "ip_address": request.client.host,
        "downloaded_at": datetime.utcnow()
    })
    
    # Increment counter
    await downloads_collection.update_one(
        {"_id": str_to_objectid(download_id)},
        {"$inc": {"download_count": 1}}
    )
    
    # Get download info
    download = await downloads_collection.find_one({"_id": str_to_objectid(download_id)})
    
    return {"file_url": download.get("file_url"), "file_name": download.get("name")}


# Note: License generation is done on the separate license server (license.synapse.watch)
# This billing panel only has license STATUS checking and ACTIVATION
# Customers cannot generate their own licenses

# License status endpoint (keep this - needed for activation)
@app.get("/api/license/status")
async def get_license_status():
    """Get current license status (public endpoint for status check)"""
    # Check env var first
    license_key = os.getenv("LICENSE_KEY")
    
    # If not in env, check settings
    if not license_key:
        settings = await get_settings()
        license_key = settings.get("license_key", "")
    
    current_domain = license_manager.get_current_domain()
    
    if not license_key:
        return {
            "licensed": False,
            "mode": "DEMO",
            "message": "No license key configured. Add LICENSE_KEY to environment or Settings → License tab."
        }
    
    validation = await license_manager.validate_license(license_key, current_domain)
    
    return {
        "licensed": validation["valid"],
        "mode": "LICENSED" if validation["valid"] else "DEMO",
        "message": validation.get("reason", "License valid"),
        "expiry_date": validation.get("expiry_date"),
        "customer": validation.get("customer_name")
    }


@app.post("/api/admin/activate-license")
async def save_license_key_endpoint(request: dict):
    """Activate license by saving to settings (public endpoint for initial activation)"""
    license_key = request.get("license_key", "").strip()
    
    if not license_key:
        raise HTTPException(status_code=400, detail="License key is required")
    
    # Validate the license key format
    if not re.match(r'^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$', license_key):
        return {
            "valid": False,
            "reason": "Invalid license key format. Expected: XXXX-XXXX-XXXX-XXXX"
        }
    
    # Validate license with license server
    current_domain = license_manager.get_current_domain()
    validation = await license_manager.validate_license(license_key, current_domain)
    
    if not validation["valid"]:
        return {
            "valid": False,
            "reason": validation.get("reason", "License validation failed")
        }
    
    # Save to settings
    existing = await settings_collection.find_one()
    if existing:
        await settings_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {"license_key": license_key}}
        )
    else:
        await settings_collection.insert_one({"license_key": license_key})
    
    logger.info(f"License activated successfully for domain: {current_domain}")
    
    return {
        "valid": True,
        "message": "License activated successfully",
        "customer": validation.get("customer_name"),
        "expiry_date": validation.get("expiry_date")
    }




@app.post("/api/admin/upload/download")
async def upload_download_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_admin_user)
):
    """Upload file for downloads section"""
    # Validate file size (max 100MB for client apps)
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    contents = await file.read()
    file_size = len(contents)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 100MB")
    
    # Create downloads directory dynamically
    DOWNLOADS_DIR = os.path.join(BASE_DIR, "uploads", "downloads")
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(DOWNLOADS_DIR, unique_filename)
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(contents)
    
    return {
        "filename": file.filename,
        "stored_filename": unique_filename,
        "size": file_size,
        "path": file_path,
        "url": f"{os.getenv('BACKEND_PUBLIC_URL', '')}/api/uploads/downloads/{unique_filename}"
    }



# ===== REFUND SYSTEM ENDPOINTS =====

class RefundRequest(BaseModel):
    order_id: str
    amount: float
    reason: str
    refund_type: str = "full"
    method: str = "credit"

@app.post("/api/refund/request")
async def request_refund_endpoint(
    request: RefundRequest,
    current_user: dict = Depends(get_current_user)
):
    """Customer requests a refund"""
    refund_id = await refund_service.request_refund(
        order_id=request.order_id,
        user_id=current_user["sub"],
        amount=request.amount,
        refund_type=request.refund_type,
        method=request.method,
        reason=request.reason
    )
    return {"message": "Refund request submitted", "refund_id": refund_id}

@app.get("/api/admin/refunds/pending")
async def get_pending_refunds_endpoint(current_user: dict = Depends(get_current_admin_user)):
    """Get all pending refund requests"""
    refunds = await refund_service.get_pending_refunds()
    return refunds

@app.post("/api/admin/refunds/{refund_id}/approve")
async def approve_refund_endpoint(
    refund_id: str,
    notes: str = "",
    current_user: dict = Depends(get_current_admin_user)
):
    """Approve a refund request and cancel associated service"""
    # Get refund details
    refund = await refunds_collection.find_one({"_id": str_to_objectid(refund_id)})
    
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    
    # Approve the refund
    await refund_service.approve_refund(refund_id, current_user["sub"], notes)
    
    # Find and cancel all services associated with this order
    order_id = refund.get("order_id")
    if order_id:
        settings = await get_settings()
        services = await services_collection.find({"order_id": order_id}).to_list(None)
        
        for service in services:
            # Mark service as refunded and suspend on panel
            if service.get("status") in ["active", "suspended"]:
                # Suspend on the actual panel (XtreamUI or XuiOne)
                panel_type = service.get("panel_type", "xtream")
                panel_index = service.get("panel_index", 0)
                
                if panel_type == "xtream":
                    # Suspend on XtreamUI panel
                    xtream_panels = settings.get("xtream", {}).get("panels", [])
                    if panel_index < len(xtream_panels):
                        panel = xtream_panels[panel_index]
                        xtream_service = XtreamUIService(
                            panel_url=panel["panel_url"],
                            admin_username=panel["admin_username"],
                            admin_password=panel["admin_password"]
                        )
                        result = xtream_service.suspend_account(
                            username=service["xtream_username"],
                            password=service["xtream_password"],
                            user_id=service.get("dedicatedip")  # Pass the stored XtreamUI user ID
                        )
                        if result.get("success"):
                            logger.info(f"Suspended XtreamUI line {service['xtream_username']}")
                        else:
                            logger.warning(f"Failed to suspend XtreamUI line: {result.get('error')}")
                
                elif panel_type == "xuione":
                    # Suspend on XuiOne panel using edit_line with enabled=0
                    xuione_panels = settings.get("xuione", {}).get("panels", [])
                    if panel_index < len(xuione_panels):
                        panel = xuione_panels[panel_index]
                        xuione_service = XuiOneService(
                            panel_url=panel["panel_url"],
                            api_access_code=panel.get("api_access_code", ""),
                            api_key=panel.get("api_key", ""),
                            admin_username=panel["admin_username"],
                            admin_password=panel["admin_password"]
                        )
                        
                        # Login and suspend line
                        if xuione_service.login():
                            line_id = service.get("dedicatedip") or service.get("xuione_line_id")
                            if line_id:
                                api_url = xuione_service.get_api_url()
                                response = xuione_service.session.post(
                                    api_url,
                                    params={'api_key': xuione_service.api_key, 'action': 'edit_line'},
                                    data={'id': line_id, 'enabled': '0'},  # Disable the line
                                    timeout=30
                                )
                                if response.status_code == 200:
                                    logger.info(f"Suspended XuiOne line {service['xtream_username']}")
                                else:
                                    logger.warning(f"Failed to suspend XuiOne line")
                
                # Mark service as refunded in database
                await services_collection.update_one(
                    {"_id": service["_id"]},
                    {"$set": {
                        "status": "refunded",
                        "refunded_at": datetime.utcnow(),
                        "refund_reason": notes or "Customer request"
                    }}
                )
                logger.info(f"Marked service {service.get('xtream_username')} as refunded")
    
    return {"message": "Refund approved, service(s) suspended on panel"}

@app.post("/api/admin/refunds/{refund_id}/reject")
async def reject_refund_endpoint(
    refund_id: str,
    notes: str = "",
    current_user: dict = Depends(get_current_admin_user)
):
    """Reject a refund request"""
    await refund_service.reject_refund(refund_id, current_user["sub"], notes)
    return {"message": "Refund rejected"}


    
    xtream_service = XtreamUIService(
        panel_url=panel["panel_url"],
        admin_username=panel["admin_username"],
        admin_password=panel["admin_password"],
        ssl_verify=panel.get("ssl_verify", False)
    )
    
    result = xtream_service.test_connection()
    
    if result["success"]:
        return {"message": f"Connection successful to {panel.get('name', 'panel')}", "details": result}
    else:
        return {"message": "Connection failed", "error": result.get("error")}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

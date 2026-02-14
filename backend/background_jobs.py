from datetime import datetime, timedelta
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

class BackgroundJobScheduler:
    """Manage all background jobs and cron tasks"""
    
    def __init__(self, db, lifecycle_manager=None, email_service=None):
        self.db = db
        self.lifecycle_manager = lifecycle_manager
        self.email_service = email_service
        self.scheduler = AsyncIOScheduler()
    
    def start(self):
        """Start all background jobs"""
        logger.info("Starting background job scheduler...")
        
        # Job 1: Check and suspend expired services (every hour)
        self.scheduler.add_job(
            self.job_suspend_expired_services,
            trigger=IntervalTrigger(hours=1),
            id="suspend_expired_services",
            name="Suspend Expired Services",
            replace_existing=True
        )
        
        # Job 2: Send expiry warnings - 7 days (daily at 9 AM)
        self.scheduler.add_job(
            self.job_send_expiry_warnings_7d,
            trigger=CronTrigger(hour=9, minute=0),
            id="send_expiry_warnings_7d",
            name="Send Expiry Warnings (7 days)",
            replace_existing=True
        )
        
        # Job 2b: Send expiry warnings - 3 days (daily at 9 AM)
        self.scheduler.add_job(
            self.job_send_expiry_warnings_3d,
            trigger=CronTrigger(hour=9, minute=15),
            id="send_expiry_warnings_3d",
            name="Send Expiry Warnings (3 days)",
            replace_existing=True
        )
        
        # Job 2c: Send expiry warnings - 1 day (daily at 9 AM)
        self.scheduler.add_job(
            self.job_send_expiry_warnings_1d,
            trigger=CronTrigger(hour=9, minute=30),
            id="send_expiry_warnings_1d",
            name="Send Expiry Warnings (1 day)",
            replace_existing=True
        )
        
        # Job 3: Cancel long-suspended services (daily at 2 AM)
        self.scheduler.add_job(
            self.job_cancel_suspended_services,
            trigger=CronTrigger(hour=2, minute=0),
            id="cancel_suspended_services",
            name="Cancel Long-Suspended Services",
            replace_existing=True
        )
        
        # Job 4: Process scheduled emails (every 5 minutes)
        self.scheduler.add_job(
            self.job_process_scheduled_emails,
            trigger=IntervalTrigger(minutes=5),
            id="process_scheduled_emails",
            name="Process Scheduled Emails",
            replace_existing=True
        )
        
        # Job 5: Clean up old logs (weekly on Sunday at 3 AM)
        self.scheduler.add_job(
            self.job_cleanup_old_logs,
            trigger=CronTrigger(day_of_week='sun', hour=3, minute=0),
            id="cleanup_old_logs",
            name="Cleanup Old Logs",
            replace_existing=True
        )
        
        # Job 6: Payment retry (every 6 hours)
        self.scheduler.add_job(
            self.job_retry_failed_payments,
            trigger=IntervalTrigger(hours=6),
            id="retry_failed_payments",
            name="Retry Failed Payments",
            replace_existing=True
        )
        
        # Job 7: Check panel credits (every 4 hours)
        self.scheduler.add_job(
            self.job_check_panel_credits,
            trigger=IntervalTrigger(hours=4),
            id="check_panel_credits",
            name="Check Panel Credits",
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info("Background jobs started successfully")
    
    async def job_suspend_expired_services(self):
        """Suspend services that have expired"""
        try:
            if self.lifecycle_manager:
                count = await self.lifecycle_manager.auto_suspend_expired_services()
                logger.info(f"Auto-suspended {count} expired services")
        except Exception as e:
            logger.error(f"Error in suspend_expired_services job: {str(e)}")
    
    async def job_send_expiry_warnings_7d(self):
        """Send 7-day expiry warnings"""
        try:
            if self.lifecycle_manager:
                count = await self.lifecycle_manager.send_expiry_warnings(7)
                if count > 0:
                    logger.info(f"Sent {count} expiry warnings (7 days)")
        except Exception as e:
            logger.error(f"Error in 7-day expiry warnings: {str(e)}")

    async def job_send_expiry_warnings_3d(self):
        """Send 3-day expiry warnings"""
        try:
            if self.lifecycle_manager:
                count = await self.lifecycle_manager.send_expiry_warnings(3)
                if count > 0:
                    logger.info(f"Sent {count} expiry warnings (3 days)")
        except Exception as e:
            logger.error(f"Error in 3-day expiry warnings: {str(e)}")

    async def job_send_expiry_warnings_1d(self):
        """Send 1-day expiry warnings"""
        try:
            if self.lifecycle_manager:
                count = await self.lifecycle_manager.send_expiry_warnings(1)
                if count > 0:
                    logger.info(f"Sent {count} expiry warnings (1 day)")
        except Exception as e:
            logger.error(f"Error in 1-day expiry warnings: {str(e)}")

    async def job_check_panel_credits(self):
        """Check panel credit balances and alert if low"""
        try:
            if self.lifecycle_manager:
                settings = await self.db.settings.find_one()
                threshold = settings.get("credit_alert_threshold", 10) if settings else 10
                await self.lifecycle_manager.check_panel_credits(low_threshold=threshold)
        except Exception as e:
            logger.error(f"Error in credit check job: {str(e)}")
    
    async def job_cancel_suspended_services(self):
        """Cancel services suspended for 30+ days"""
        try:
            if self.lifecycle_manager:
                count = await self.lifecycle_manager.auto_cancel_long_suspended(days=30)
                logger.info(f"Auto-cancelled {count} long-suspended services")
        except Exception as e:
            logger.error(f"Error in cancel_suspended_services job: {str(e)}")
    
    async def job_process_scheduled_emails(self):
        """Process and send scheduled emails"""
        try:
            now = datetime.utcnow()
            
            # Find emails scheduled for now or earlier
            async for email in self.db.scheduled_emails.find({
                "sent": False,
                "cancelled": False,
                "scheduled_for": {"$lte": now}
            }):
                try:
                    # Send the email (would integrate with email service)
                    logger.info(f"Processing scheduled email: {email['subject']}")
                    
                    # Mark as sent
                    await self.db.scheduled_emails.update_one(
                        {"_id": email["_id"]},
                        {"$set": {"sent": True, "sent_at": now}}
                    )
                    
                except Exception as e:
                    logger.error(f"Failed to send scheduled email {email['_id']}: {str(e)}")
                    
        except Exception as e:
            logger.error(f"Error in process_scheduled_emails job: {str(e)}")
    
    async def job_cleanup_old_logs(self):
        """Clean up logs older than 90 days"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=90)
            
            # Clean email logs
            email_result = await self.db.email_logs.delete_many({
                "created_at": {"$lt": cutoff_date},
                "status": {"$in": ["sent", "failed"]}  # Keep pending/bounced
            })
            
            # Clean lifecycle logs
            lifecycle_result = await self.db.lifecycle_logs.delete_many({
                "created_at": {"$lt": cutoff_date}
            })
            
            logger.info(f"Cleaned up {email_result.deleted_count} email logs, {lifecycle_result.deleted_count} lifecycle logs")
            
        except Exception as e:
            logger.error(f"Error in cleanup_old_logs job: {str(e)}")
    
    async def job_retry_failed_payments(self):
        """Retry failed payment attempts"""
        try:
            now = datetime.utcnow()
            
            # Find payment retries ready for next attempt
            async for retry in self.db.payment_retries.find({
                "status": "pending",
                "next_retry_at": {"$lte": now},
                "attempt_number": {"$lt": 3}  # Max 3 attempts
            }):
                try:
                    logger.info(f"Retrying payment for order {retry['order_id']} (attempt {retry['attempt_number'] + 1})")
                    
                    # Would attempt payment here
                    # If successful, mark order as paid
                    # If failed, schedule next retry with exponential backoff
                    
                    # Increment attempt
                    await self.db.payment_retries.update_one(
                        {"_id": retry["_id"]},
                        {"$inc": {"attempt_number": 1}}
                    )
                    
                except Exception as e:
                    logger.error(f"Payment retry failed for {retry['order_id']}: {str(e)}")
                    
        except Exception as e:
            logger.error(f"Error in retry_failed_payments job: {str(e)}")
    
    def stop(self):
        """Stop scheduler"""
        self.scheduler.shutdown()
        logger.info("Background job scheduler stopped")

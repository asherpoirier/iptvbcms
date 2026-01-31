# Background Jobs Scheduler Setup
# This file is imported and started in server.py

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = None

def init_scheduler(db, lifecycle_manager, email_service):
    """Initialize and start background job scheduler"""
    global scheduler
    
    from background_jobs import BackgroundJobScheduler
    
    scheduler = BackgroundJobScheduler(db, lifecycle_manager, email_service)
    scheduler.start()
    
    logger.info("Background job scheduler initialized")
    return scheduler

def stop_scheduler():
    """Stop background job scheduler"""
    global scheduler
    if scheduler:
        scheduler.stop()
        logger.info("Background job scheduler stopped")

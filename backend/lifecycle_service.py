from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class ServiceLifecycleManager:
    """Manage automated service lifecycle"""
    
    def __init__(self, db, xtream_service=None, email_service=None):
        self.db = db
        self.services = db.services
        self.users = db.users
        self.lifecycle_logs = db.lifecycle_logs
        self.xtream_service = xtream_service
        self.email_service = email_service
    
    async def log_action(self, service_id: str, user_id: str, action: str, reason: str, old_status: str = None, new_status: str = None, triggered_by: str = "system"):
        """Log lifecycle action"""
        await self.lifecycle_logs.insert_one({
            "service_id": service_id,
            "user_id": user_id,
            "action": action,
            "reason": reason,
            "triggered_by": triggered_by,
            "old_status": old_status,
            "new_status": new_status,
            "created_at": datetime.utcnow()
        })
    
    async def auto_provision_service(self, order_id: str, service_id: str):
        """Automatically provision service after payment"""
        service = await self.services.find_one({"_id": service_id})
        if not service:
            return False
        
        # Service should be in pending status
        if service.get("status") != "pending":
            logger.warning(f"Service {service_id} not in pending status")
            return False
        
        try:
            # Create account on XtreamUI panel (if xtream_service available)
            if self.xtream_service:
                # This would call xtream_service to create account
                logger.info(f"Provisioning service {service_id} on XtreamUI panel")
            
            # Update service status to active
            await self.services.update_one(
                {"_id": service_id},
                {"$set": {
                    "status": "active",
                    "activated_at": datetime.utcnow()
                }}
            )
            
            # Log action
            await self.log_action(
                service_id=service_id,
                user_id=service["user_id"],
                action="provision",
                reason="Payment confirmed",
                old_status="pending",
                new_status="active"
            )
            
            # Send service activated email
            if self.email_service:
                user = await self.users.find_one({"_id": service["user_id"]})
                # Would call email_service.send_service_activated(...)
            
            logger.info(f"Service {service_id} auto-provisioned successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to auto-provision service {service_id}: {str(e)}")
            return False
    
    async def auto_suspend_expired_services(self):
        """Suspend all expired services"""
        now = datetime.utcnow()
        
        # Find active services that have expired
        suspended_count = 0
        async for service in self.services.find({
            "status": "active",
            "expiry_date": {"$lt": now}
        }):
            try:
                # Suspend service
                await self.services.update_one(
                    {"_id": service["_id"]},
                    {"$set": {
                        "status": "suspended",
                        "suspended_at": now
                    }}
                )
                
                # Log action
                await self.log_action(
                    service_id=str(service["_id"]),
                    user_id=service["user_id"],
                    action="suspend",
                    reason="Service expired",
                    old_status="active",
                    new_status="suspended"
                )
                
                suspended_count += 1
                logger.info(f"Auto-suspended service {service['_id']} (expired)")
                
            except Exception as e:
                logger.error(f"Failed to suspend service {service['_id']}: {str(e)}")
        
        return suspended_count
    
    async def auto_cancel_long_suspended(self, days: int = 30):
        """Cancel services suspended for more than N days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        cancelled_count = 0
        async for service in self.services.find({
            "status": "suspended",
            "suspended_at": {"$lt": cutoff_date}
        }):
            try:
                await self.services.update_one(
                    {"_id": service["_id"]},
                    {"$set": {
                        "status": "cancelled",
                        "cancelled_at": datetime.utcnow()
                    }}
                )
                
                await self.log_action(
                    service_id=str(service["_id"]),
                    user_id=service["user_id"],
                    action="cancel",
                    reason=f"Suspended for {days}+ days",
                    old_status="suspended",
                    new_status="cancelled"
                )
                
                cancelled_count += 1
                
            except Exception as e:
                logger.error(f"Failed to cancel service {service['_id']}: {str(e)}")
        
        return cancelled_count
    
    async def send_expiry_warnings(self, days_before: int = 7):
        """Send warnings for services expiring soon"""
        target_date = datetime.utcnow() + timedelta(days=days_before)
        start_of_target_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_target_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        warned_count = 0
        async for service in self.services.find({
            "status": "active",
            "expiry_date": {
                "$gte": start_of_target_day,
                "$lte": end_of_target_day
            }
        }):
            # Check if already warned for this period
            recent_warning = await self.lifecycle_logs.find_one({
                "service_id": str(service["_id"]),
                "action": "expiry_warning",
                "created_at": {"$gte": datetime.utcnow() - timedelta(hours=12)}
            })
            
            if recent_warning:
                continue  # Already warned recently
            
            try:
                # Send warning email
                if self.email_service:
                    user = await self.users.find_one({"_id": service["user_id"]})
                    # Would send expiry warning email
                
                # Log warning sent
                await self.log_action(
                    service_id=str(service["_id"]),
                    user_id=service["user_id"],
                    action="expiry_warning",
                    reason=f"Service expires in {days_before} days"
                )
                
                warned_count += 1
                
            except Exception as e:
                logger.error(f"Failed to send expiry warning for service {service['_id']}: {str(e)}")
        
        return warned_count

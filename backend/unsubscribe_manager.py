from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class UnsubscribeManager:
    """Manage email unsubscribe preferences"""
    
    def __init__(self, db):
        self.db = db
        self.unsubscribes = db.email_unsubscribes
    
    async def unsubscribe(
        self,
        email: str,
        unsubscribe_type: str = "all",
        reason: str = None,
        reason_text: str = None,
        customer_id: str = None,
        ip_address: str = None
    ):
        """Unsubscribe an email address"""
        existing = await self.unsubscribes.find_one({"email": email})
        
        if existing:
            # Update existing unsubscribe
            await self.unsubscribes.update_one(
                {"email": email},
                {"$set": {
                    "unsubscribed_from": unsubscribe_type,
                    "reason": reason,
                    "reason_text": reason_text,
                    "unsubscribed_at": datetime.utcnow(),
                    "ip_address": ip_address
                }}
            )
        else:
            # Create new unsubscribe
            unsubscribe_data = {
                "email": email,
                "customer_id": customer_id,
                "unsubscribed_from": unsubscribe_type,
                "reason": reason,
                "reason_text": reason_text,
                "unsubscribed_at": datetime.utcnow(),
                "ip_address": ip_address
            }
            await self.unsubscribes.insert_one(unsubscribe_data)
        
        logger.info(f"Email unsubscribed: {email} from {unsubscribe_type}")
    
    async def resubscribe(self, email: str):
        """Remove unsubscribe (customer wants to receive emails again)"""
        await self.unsubscribes.delete_one({"email": email})
        logger.info(f"Email resubscribed: {email}")
    
    async def is_unsubscribed(self, email: str, email_type: str = "marketing") -> bool:
        """Check if an email is unsubscribed"""
        unsubscribe = await self.unsubscribes.find_one({"email": email})
        
        if not unsubscribe:
            return False
        
        unsubscribed_from = unsubscribe.get("unsubscribed_from", "all")
        
        # If unsubscribed from "all", they don't receive anything
        if unsubscribed_from == "all":
            return True
        
        # If unsubscribed from specific type, check it
        if unsubscribed_from == email_type:
            return True
        
        return False
    
    async def can_send_marketing(self, email: str) -> bool:
        """Check if marketing emails can be sent"""
        return not await self.is_unsubscribed(email, "marketing")
    
    async def can_send_transactional(self, email: str) -> bool:
        """Transactional emails can always be sent unless user unsubscribed from ALL"""
        unsubscribe = await self.unsubscribes.find_one({"email": email})
        if not unsubscribe:
            return True
        return unsubscribe.get("unsubscribed_from") != "all"
    
    async def get_all_unsubscribes(self, limit: int = 100, skip: int = 0):
        """Get list of all unsubscribed emails"""
        unsubscribes = []
        cursor = self.unsubscribes.find().sort("unsubscribed_at", -1).skip(skip).limit(limit)
        
        async for unsub in cursor:
            unsub["id"] = str(unsub["_id"])
            del unsub["_id"]
            unsubscribes.append(unsub)
        
        total = await self.unsubscribes.count_documents({})
        
        return {"items": unsubscribes, "total": total}

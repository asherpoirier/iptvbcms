from datetime import datetime, timedelta
import random
import string
import logging

logger = logging.getLogger(__name__)

class ReferralService:
    """Manage referral program"""
    
    def __init__(self, db, settings_getter=None):
        self.db = db
        self.referrals = db.referrals
        self.users = db.users
        self.credit_transactions = db.credit_transactions
        self.get_settings = settings_getter
    
    async def is_enabled(self) -> bool:
        """Check if referral system is enabled"""
        if not self.get_settings:
            return True
        
        settings = await self.get_settings()
        return settings.get("referral", {}).get("enabled", True)
    
    async def get_referral_settings(self) -> dict:
        """Get referral settings"""
        if not self.get_settings:
            return {
                "referrer_reward": 10.0,
                "referred_reward": 5.0,
                "minimum_purchase": 0.0
            }
        
        settings = await self.get_settings()
        return settings.get("referral", {})
    
    def generate_referral_code(self, user_name: str) -> str:
        """Generate unique referral code"""
        # Use first 3 letters of name + 5 random chars
        prefix = ''.join(c for c in user_name if c.isalnum())[:3].upper()
        suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
        return f"{prefix}{suffix}"
    
    async def create_referral_code_for_user(self, user_id: str) -> str:
        """Create and assign referral code to user"""
        from bson import ObjectId
        
        # Convert string ID to ObjectId if needed
        try:
            if isinstance(user_id, str) and len(user_id) == 24:
                user_oid = ObjectId(user_id)
            else:
                user_oid = user_id
        except:
            user_oid = user_id
        
        user = await self.users.find_one({"_id": user_oid})
        if not user:
            return None
        
        # Check if user already has code
        if user.get("referral_code"):
            return user["referral_code"]
        
        # Generate unique code
        code = self.generate_referral_code(user["name"])
        
        # Ensure uniqueness
        while await self.users.find_one({"referral_code": code}):
            code = self.generate_referral_code(user["name"])
        
        # Assign to user
        await self.users.update_one(
            {"_id": user_oid},
            {"$set": {"referral_code": code}}
        )
        
        return code
    
    async def track_referral(self, referral_code: str, referred_email: str):
        """Track when someone uses a referral link"""
        # Check if referral system is enabled
        if not await self.is_enabled():
            logger.info("Referral system is disabled")
            return None
        
        # Get settings for reward amount
        settings = await self.get_referral_settings()
        
        # Find referrer
        referrer = await self.users.find_one({"referral_code": referral_code})
        if not referrer:
            return None
        
        # Check if already tracked
        existing = await self.referrals.find_one({
            "referrer_id": str(referrer["_id"]),
            "referred_email": referred_email
        })
        
        if existing:
            return existing
        
        # Create referral record
        referral = {
            "referrer_id": str(referrer["_id"]),
            "referred_email": referred_email,
            "referral_code": referral_code,
            "status": "pending",
            "reward_amount": settings.get("referrer_reward", 10.0),
            "reward_type": "credit",
            "rewarded": False,
            "created_at": datetime.utcnow()
        }
        
        result = await self.referrals.insert_one(referral)
        return str(result.inserted_id)
    
    async def complete_referral(self, referred_user_id: str, order_id: str):
        """Mark referral as completed when referred user makes first purchase"""
        # Find user
        user = await self.users.find_one({"_id": referred_user_id})
        if not user or not user.get("referred_by"):
            return
        
        # Find referral record
        referral = await self.referrals.find_one({
            "referred_email": user["email"],
            "status": "pending"
        })
        
        if not referral:
            return
        
        # Update referral status
        await self.referrals.update_one(
            {"_id": referral["_id"]},
            {"$set": {
                "status": "completed",
                "referred_id": referred_user_id,
                "order_id": order_id,
                "completed_at": datetime.utcnow()
            }}
        )
        
        # Award credits to referrer
        if not referral.get("rewarded"):
            await self.award_referral_credits(str(referral["_id"]))
    
    async def award_referral_credits(self, referral_id: str):
        """Award credits to referrer"""
        referral = await self.referrals.find_one({"_id": referral_id})
        if not referral or referral.get("rewarded"):
            return
        
        referrer_id = referral["referrer_id"]
        reward_amount = referral.get("reward_amount", 10.0)
        
        # Get current balance
        user = await self.users.find_one({"_id": referrer_id})
        current_balance = user.get("credit_balance", 0.0)
        new_balance = current_balance + reward_amount
        
        # Update user balance
        await self.users.update_one(
            {"_id": referrer_id},
            {"$set": {"credit_balance": new_balance}}
        )
        
        # Log credit transaction
        await self.credit_transactions.insert_one({
            "user_id": referrer_id,
            "amount": reward_amount,
            "transaction_type": "referral",
            "description": f"Referral reward for {referral['referred_email']}",
            "referral_id": str(referral["_id"]),
            "balance_after": new_balance,
            "created_at": datetime.utcnow()
        })
        
        # Mark as rewarded
        await self.referrals.update_one(
            {"_id": referral["_id"]},
            {"$set": {"rewarded": True}}
        )
        
        logger.info(f"Referral reward: ${reward_amount} to user {referrer_id}")
    
    async def get_user_referrals(self, user_id: str):
        """Get all referrals made by a user"""
        referrals = []
        async for ref in self.referrals.find({"referrer_id": user_id}).sort("created_at", -1):
            ref["id"] = str(ref["_id"])
            del ref["_id"]
            referrals.append(ref)
        return referrals
    
    async def get_leaderboard(self, limit: int = 10):
        """Get top referrers"""
        pipeline = [
            {"$match": {"status": "completed"}},
            {"$group": {
                "_id": "$referrer_id",
                "total_referrals": {"$sum": 1},
                "total_rewards": {"$sum": "$reward_amount"}
            }},
            {"$sort": {"total_referrals": -1}},
            {"$limit": limit}
        ]
        
        leaderboard = []
        async for entry in self.referrals.aggregate(pipeline):
            # Get user details
            user = await self.users.find_one({"_id": entry["_id"]})
            if user:
                leaderboard.append({
                    "user_id": str(user["_id"]),
                    "name": user["name"],
                    "email": user["email"],
                    "total_referrals": entry["total_referrals"],
                    "total_rewards": entry["total_rewards"]
                })
        
        return leaderboard

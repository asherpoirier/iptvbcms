from datetime import datetime
import logging
from bson import ObjectId

logger = logging.getLogger(__name__)

class CouponService:
    """Manage discount coupons"""
    
    def __init__(self, db):
        self.db = db
        self.coupons = db.coupons
        self.coupon_usage = db.coupon_usage
    
    async def validate_coupon(self, code: str, order_total: float, product_ids: list = []):
        """Validate coupon and return discount amount"""
        coupon = await self.coupons.find_one({"code": code.upper()})
        
        if not coupon:
            return {"valid": False, "error": "Coupon code not found"}
        
        if not coupon.get("active", True):
            return {"valid": False, "error": "Coupon is inactive"}
        
        # Check validity period
        now = datetime.utcnow()
        if coupon.get("valid_from") and now < coupon["valid_from"]:
            return {"valid": False, "error": "Coupon not yet valid"}
        
        if coupon.get("valid_until") and now > coupon["valid_until"]:
            return {"valid": False, "error": "Coupon has expired"}
        
        # Check usage limit
        if coupon.get("max_uses"):
            if coupon.get("used_count", 0) >= coupon["max_uses"]:
                return {"valid": False, "error": "Coupon usage limit reached"}
        
        # Check minimum purchase
        if order_total < coupon.get("min_purchase", 0):
            return {"valid": False, "error": f"Minimum purchase of ${coupon['min_purchase']} required"}
        
        # Check product applicability
        applies_to = coupon.get("applies_to", "all")
        if applies_to != "all":
            coupon_product_ids = coupon.get("product_ids", [])
            if not any(pid in coupon_product_ids for pid in product_ids):
                return {"valid": False, "error": "Coupon not applicable to selected products"}
        
        # Calculate discount
        discount = 0.0
        if coupon["coupon_type"] == "percentage":
            discount = order_total * (coupon["value"] / 100)
        elif coupon["coupon_type"] == "fixed":
            discount = min(coupon["value"], order_total)  # Can't exceed total
        
        return {
            "valid": True,
            "coupon_id": str(coupon["_id"]),
            "code": coupon["code"],
            "discount": round(discount, 2),
            "coupon_type": coupon["coupon_type"],
            "value": coupon["value"]
        }
    
    async def apply_coupon(self, coupon_code: str, user_id: str, order_id: str, discount_amount: float):
        """Record coupon usage and increment count"""
        coupon = await self.coupons.find_one({"code": coupon_code.upper()})
        if not coupon:
            return
        
        # Record usage
        await self.coupon_usage.insert_one({
            "coupon_id": str(coupon["_id"]),
            "coupon_code": coupon_code.upper(),
            "user_id": user_id,
            "order_id": order_id,
            "discount_amount": discount_amount,
            "used_at": datetime.utcnow()
        })
        
        # Increment usage count
        await self.coupons.update_one(
            {"_id": coupon["_id"]},
            {"$inc": {"used_count": 1}}
        )
        
        logger.info(f"Coupon {coupon_code} applied: ${discount_amount} discount for user {user_id}")
    
    async def get_coupon_stats(self, coupon_id: str):
        """Get usage statistics for a coupon"""
        usage_count = await self.coupon_usage.count_documents({"coupon_id": coupon_id})
        
        pipeline = [
            {"$match": {"coupon_id": coupon_id}},
            {"$group": {
                "_id": None,
                "total_discount": {"$sum": "$discount_amount"}
            }}
        ]
        
        total_discount = 0.0
        async for result in self.coupon_usage.aggregate(pipeline):
            total_discount = result.get("total_discount", 0.0)
        
        return {
            "usage_count": usage_count,
            "total_discount": total_discount
        }

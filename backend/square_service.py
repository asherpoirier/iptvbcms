from square.client import Square, SquareEnvironment
import os
import logging
import uuid

logger = logging.getLogger(__name__)

class SquareService:
    """Square payment processing service"""
    
    def __init__(self, access_token=None, application_id=None, location_id=None, environment="sandbox"):
        self.access_token = access_token
        self.application_id = application_id
        self.location_id = location_id
        env = SquareEnvironment.SANDBOX if environment == "sandbox" else SquareEnvironment.PRODUCTION
        
        if self.access_token:
            self.client = Square(
                token=self.access_token,  # Correct parameter name
                environment=env
            )
            logger.info(f"Square configured in {environment} mode")
    
    async def create_payment(self, amount, source_id, order_id="", customer_email=""):
        """Create Square payment"""
        if not self.access_token:
            return {"success": False, "error": "Square not configured"}
        
        try:
            # Square requires idempotency_key <= 45 chars
            idempotency_key = f"{order_id[:12]}_{uuid.uuid4().hex[:20]}"  # Max 33 chars
            
            result = self.client.payments.create(
                idempotency_key=idempotency_key,
                source_id=source_id,
                amount_money={
                    "amount": int(amount * 100),
                    "currency": "CAD"
                },
                location_id=self.location_id,
                reference_id=order_id,
                note=f"Order {order_id[:8]}",
                buyer_email_address=customer_email
            )
            
            # Square SDK returns CreatePaymentResponse
            if result.payment:
                payment = result.payment
                logger.info(f"Square payment created: {payment.id}")
                return {
                    "success": True,
                    "payment_id": payment.id,
                    "status": payment.status,
                    "receipt_url": payment.receipt_url if hasattr(payment, 'receipt_url') else None
                }
            else:
                logger.error(f"Square payment failed: No payment in response")
                return {"success": False, "error": "Payment failed"}
                
        except Exception as e:
            logger.error(f"Square payment error: {e}")
            return {"success": False, "error": str(e)}

def get_square_service(square_settings=None):
    """Get Square service instance"""
    if not square_settings or not square_settings.get("enabled"):
        return None
    
    return SquareService(
        access_token=square_settings.get("access_token"),
        application_id=square_settings.get("application_id"),
        location_id=square_settings.get("location_id"),
        environment=square_settings.get("environment", "sandbox")
    )

from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
import logging
import os

logger = logging.getLogger(__name__)

class StripeService:
    """Stripe payment processing service with crypto support"""
    
    def __init__(self, api_key=None, webhook_url=""):
        self.api_key = api_key or os.getenv("STRIPE_API_KEY", "sk_test_emergent")
        self.webhook_url = webhook_url
        self.checkout = None
        
        if self.api_key and self.webhook_url:
            self.checkout = StripeCheckout(
                api_key=self.api_key,
                webhook_url=self.webhook_url
            )
            logger.info(f"Stripe configured with webhook: {webhook_url}")
    
    async def create_payment_session(self, amount, order_id, success_url, cancel_url, crypto_enabled=True):
        """Create Stripe checkout session"""
        if not self.checkout:
            return {"success": False, "error": "Stripe not configured"}
        
        try:
            # Include crypto payment method if enabled
            payment_methods = ['card', 'crypto'] if crypto_enabled else ['card']
            
            request = CheckoutSessionRequest(
                amount=float(amount),  # Keep as float for Stripe
                currency="usd",
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    "order_id": order_id,
                    "source": "web_checkout"
                },
                payment_methods=payment_methods
            )
            
            session: CheckoutSessionResponse = await self.checkout.create_checkout_session(request)
            
            logger.info(f"Stripe session created: {session.session_id} for order {order_id}")
            return {
                "success": True,
                "session_id": session.session_id,
                "checkout_url": session.url
            }
            
        except Exception as e:
            logger.error(f"Stripe session creation error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_payment_status(self, session_id):
        """Get payment status"""
        if not self.checkout:
            return {"success": False, "error": "Stripe not configured"}
        
        try:
            status: CheckoutStatusResponse = await self.checkout.get_checkout_status(session_id)
            
            return {
                "success": True,
                "status": status.status,
                "payment_status": status.payment_status,
                "amount": status.amount_total / 100,  # Convert from cents
                "currency": status.currency,
                "metadata": status.metadata
            }
            
        except Exception as e:
            logger.error(f"Stripe status check error: {e}")
            return {"success": False, "error": str(e)}
    
    async def handle_webhook(self, body, signature):
        """Handle Stripe webhook"""
        if not self.checkout:
            return {"success": False, "error": "Stripe not configured"}
        
        try:
            event = await self.checkout.handle_webhook(body, signature)
            
            return {
                "success": True,
                "event_type": event.event_type,
                "session_id": event.session_id,
                "payment_status": event.payment_status,
                "metadata": event.metadata
            }
            
        except Exception as e:
            logger.error(f"Stripe webhook error: {e}")
            return {"success": False, "error": str(e)}

def get_stripe_service(stripe_settings=None, webhook_url=""):
    """Get Stripe service instance"""
    if not stripe_settings or not stripe_settings.get("enabled"):
        return None
    
    # Use production key if in live mode and key is provided
    api_key = None
    mode = stripe_settings.get("mode", "test")
    
    if mode == "live" and stripe_settings.get("secret_key"):
        api_key = stripe_settings.get("secret_key")
        logger.info("Using production Stripe key")
    else:
        # Use emergent test key
        api_key = "sk_test_emergent"
        logger.info("Using test Stripe key")
    
    return StripeService(
        api_key=api_key,
        webhook_url=webhook_url
    )

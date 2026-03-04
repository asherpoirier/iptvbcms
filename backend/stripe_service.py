import os
import logging

logger = logging.getLogger(__name__)

# Try emergentintegrations first (Emergent platform), fall back to official stripe SDK
try:
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
    USING_EMERGENT = True
    logger.info("Using emergentintegrations Stripe")
except ImportError:
    USING_EMERGENT = False
    try:
        import stripe
        logger.info("Using official stripe SDK")
    except ImportError:
        stripe = None
        logger.warning("No Stripe library available. Install 'stripe' package.")


class StripeService:
    def __init__(self, api_key=None, webhook_url=""):
        self.api_key = api_key or os.getenv("STRIPE_API_KEY", "")
        self.webhook_url = webhook_url
        self.checkout = None
        
        if not self.api_key:
            logger.warning("No Stripe API key provided")
            return
        
        if USING_EMERGENT:
            try:
                self.checkout = StripeCheckout(
                    api_key=self.api_key,
                    webhook_url=self.webhook_url or "https://example.com/api/webhooks/stripe"
                )
                logger.info(f"Stripe configured via emergentintegrations (key: {self.api_key[:12]}...)")
            except Exception as e:
                logger.error(f"Stripe init failed: {e}")
        else:
            if stripe:
                stripe.api_key = self.api_key
                self.checkout = "native"  # marker that native SDK is ready
                logger.info(f"Stripe configured via native SDK (key: {self.api_key[:12]}...)")
    
    async def create_payment_session(self, amount, order_id, success_url, cancel_url, crypto_enabled=True, currency="usd"):
        """Create Stripe checkout session"""
        if not self.checkout:
            return {"success": False, "error": "Stripe not configured. Check API key."}
        
        try:
            if USING_EMERGENT:
                payment_methods = ['card', 'crypto'] if crypto_enabled else ['card']
                request = CheckoutSessionRequest(
                    amount=float(amount),
                    currency=currency.lower(),
                    order_id=order_id,
                    success_url=success_url,
                    cancel_url=cancel_url,
                    payment_method_types=payment_methods,
                    metadata={"order_id": order_id}
                )
                session = self.checkout.create_session(request)
                logger.info(f"Stripe session created: {session.session_id}")
                return {
                    "success": True,
                    "session_id": session.session_id,
                    "checkout_url": session.url
                }
            else:
                # Native Stripe SDK — try with crypto first, fallback to card-only
                payment_methods = ['card']
                if crypto_enabled:
                    payment_methods.append('crypto')
                
                try:
                    session = stripe.checkout.Session.create(
                        payment_method_types=payment_methods,
                        line_items=[{
                            'price_data': {
                                'currency': currency.lower(),
                                'product_data': {
                                    'name': f'Order #{order_id[:8]}',
                                },
                                'unit_amount': int(float(amount) * 100),
                            },
                            'quantity': 1,
                        }],
                        mode='payment',
                        success_url=success_url,
                        cancel_url=cancel_url,
                        metadata={'order_id': order_id},
                    )
                except stripe.error.InvalidRequestError:
                    # If crypto not supported, retry without it
                    session = stripe.checkout.Session.create(
                        payment_method_types=['card'],
                        line_items=[{
                            'price_data': {
                                'currency': currency.lower(),
                                'product_data': {
                                    'name': f'Order #{order_id[:8]}',
                                },
                                'unit_amount': int(float(amount) * 100),
                            },
                            'quantity': 1,
                        }],
                        mode='payment',
                        success_url=success_url,
                        cancel_url=cancel_url,
                        metadata={'order_id': order_id},
                    )
                except stripe.error.InvalidRequestError as crypto_err:
                    if 'crypto' in str(crypto_err).lower() and crypto_enabled:
                        logger.warning(f"Stripe crypto not available, falling back to card-only: {crypto_err}")
                        session = stripe.checkout.Session.create(
                            payment_method_types=['card'],
                            line_items=[{
                                'price_data': {
                                    'currency': currency.lower(),
                                    'product_data': {'name': f'Order #{order_id[:8]}'},
                                    'unit_amount': int(float(amount) * 100),
                                },
                                'quantity': 1,
                            }],
                            mode='payment',
                            success_url=success_url,
                            cancel_url=cancel_url,
                            metadata={'order_id': order_id},
                        )
                    else:
                        raise
                
                logger.info(f"Stripe session created: {session.id}")
                return {
                    "success": True,
                    "session_id": session.id,
                    "checkout_url": session.url
                }
        
        except Exception as e:
            import traceback
            logger.error(f"Stripe session creation error: {e}\n{traceback.format_exc()}")
            return {"success": False, "error": str(e)}
    
    async def get_payment_status(self, session_id):
        """Get payment status"""
        try:
            if USING_EMERGENT and self.checkout:
                status = self.checkout.get_session_status(session_id)
                return {
                    "success": True,
                    "status": status.payment_status,
                    "amount": status.amount_total
                }
            elif stripe:
                session = stripe.checkout.Session.retrieve(session_id)
                return {
                    "success": True,
                    "status": session.payment_status,
                    "amount": session.amount_total / 100 if session.amount_total else 0
                }
            return {"success": False, "error": "Stripe not available"}
        except Exception as e:
            logger.error(f"Stripe status check error: {e}")
            return {"success": False, "error": str(e)}


def get_stripe_service(stripe_settings=None, webhook_url=""):
    """Get Stripe service instance"""
    if not stripe_settings or not stripe_settings.get("enabled"):
        return None
    
    mode = stripe_settings.get("mode", "test")
    
    if mode == "live":
        api_key = stripe_settings.get("live_secret_key", "")
        if not api_key:
            logger.warning("Stripe in live mode but no live_secret_key set")
            return None
    else:
        api_key = stripe_settings.get("test_secret_key", "")
        if not api_key:
            api_key = "sk_test_emergent"
    
    logger.info(f"Stripe service: mode={mode}, key={api_key[:12]}...")
    return StripeService(api_key=api_key, webhook_url=webhook_url)

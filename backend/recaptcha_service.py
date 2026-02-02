"""Google reCAPTCHA v3 Verification Service"""
import httpx
import logging
from typing import Dict, Tuple, Optional

logger = logging.getLogger(__name__)

RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"

class RecaptchaService:
    """Service for verifying Google reCAPTCHA v3 tokens"""
    
    @staticmethod
    async def verify_token(
        token: str,
        secret_key: str,
        action: str = "login",
        min_score: float = 0.5
    ) -> Tuple[bool, float, Optional[Dict]]:
        """
        Verify reCAPTCHA v3 token with Google's servers.
        
        Args:
            token: reCAPTCHA token from frontend
            secret_key: reCAPTCHA secret key
            action: Expected action name
            min_score: Minimum acceptable score (0.0 to 1.0)
        
        Returns:
            Tuple of (success, score, response_data)
        """
        if not token or not secret_key:
            logger.error("Missing reCAPTCHA token or secret key")
            return False, 0.0, None
        
        payload = {
            "secret": secret_key,
            "response": token
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    RECAPTCHA_VERIFY_URL,
                    data=payload,
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                
                # Extract key information
                success = data.get("success", False)
                score = data.get("score", 0.0)
                response_action = data.get("action", "")
                error_codes = data.get("error-codes", [])
                
                # Log verification result
                logger.info(
                    f"reCAPTCHA verification - success: {success}, "
                    f"score: {score}, action: {response_action}, "
                    f"errors: {error_codes}"
                )
                
                # Verify action matches
                if response_action and response_action != action:
                    logger.warning(
                        f"Action mismatch: expected {action}, got {response_action}"
                    )
                    return False, score, data
                
                # Check score threshold
                if not success or score < min_score:
                    logger.warning(f"reCAPTCHA failed: score {score} below threshold {min_score}")
                    return False, score, data
                
                return True, score, data
                
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during reCAPTCHA verification: {str(e)}")
            return False, 0.0, None
        except Exception as e:
            logger.error(f"Unexpected error during reCAPTCHA verification: {str(e)}")
            return False, 0.0, None
    
    @staticmethod
    def evaluate_risk(score: float, threshold: float = 0.5) -> Dict[str, any]:
        """
        Evaluate risk level based on reCAPTCHA score.
        
        Score interpretation:
        - 1.0: Very likely a good interaction
        - 0.5: Neutral, default threshold
        - 0.0: Very likely a bot
        """
        return {
            "score": score,
            "threshold": threshold,
            "passed": score >= threshold,
            "risk_level": "low" if score >= 0.8 else "medium" if score >= 0.5 else "high"
        }

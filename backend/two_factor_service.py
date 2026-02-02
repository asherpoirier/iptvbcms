"""Two-Factor Authentication Service using TOTP (Google Authenticator)"""
import pyotp
import qrcode
import io
import base64
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class TwoFactorService:
    """Service for managing TOTP-based 2FA"""
    
    @staticmethod
    def generate_secret() -> str:
        """Generate a new TOTP secret for a user"""
        return pyotp.random_base32()
    
    @staticmethod
    def generate_qr_code(secret: str, email: str, issuer: str = "IPTV Billing") -> str:
        """Generate QR code as base64 image for Google Authenticator"""
        try:
            # Create TOTP URI
            totp = pyotp.TOTP(secret)
            uri = totp.provisioning_uri(name=email, issuer_name=issuer)
            
            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(uri)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            return f"data:image/png;base64,{img_base64}"
            
        except Exception as e:
            logger.error(f"Failed to generate QR code: {e}")
            raise Exception(f"QR code generation failed: {str(e)}")
    
    @staticmethod
    def verify_totp(secret: str, code: str) -> bool:
        """Verify a TOTP code against the secret"""
        try:
            totp = pyotp.TOTP(secret)
            # Allow 1 time window before and after for clock drift
            return totp.verify(code, valid_window=1)
        except Exception as e:
            logger.error(f"TOTP verification error: {e}")
            return False
    
    @staticmethod
    def get_backup_codes(count: int = 10) -> list:
        """Generate backup codes for 2FA recovery"""
        import secrets
        import string
        
        codes = []
        for _ in range(count):
            code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
            # Format as XXXX-XXXX
            formatted = f"{code[:4]}-{code[4:]}"
            codes.append(formatted)
        
        return codes

from datetime import datetime, timedelta
import secrets
import string
import logging
import os

logger = logging.getLogger(__name__)

class LicenseManager:
    """Manage application licensing"""
    
    def __init__(self, db):
        self.db = db
        self.licenses = db.licenses
        self.validations = db.license_validations
    
    def generate_license_key(self) -> str:
        """Generate a unique license key (format: XXXX-XXXX-XXXX-XXXX)"""
        segments = []
        for _ in range(4):
            segment = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
            segments.append(segment)
        return '-'.join(segments)
    
    async def create_license(
        self,
        customer_name: str = "",
        customer_email: str = "",
        allowed_domains: list = [],
        max_domains: int = 1,
        expiry_days: int = None,
        features: dict = {},
        notes: str = "",
        created_by: str = None
    ) -> str:
        """Create a new license"""
        # Generate unique key
        license_key = self.generate_license_key()
        
        # Ensure uniqueness
        while await self.licenses.find_one({"license_key": license_key}):
            license_key = self.generate_license_key()
        
        # Calculate expiry
        expiry_date = None
        if expiry_days:
            expiry_date = datetime.utcnow() + timedelta(days=expiry_days)
        
        license_data = {
            "license_key": license_key,
            "customer_name": customer_name,
            "customer_email": customer_email,
            "status": "active",
            "allowed_domains": allowed_domains,
            "max_domains": max_domains,
            "issued_date": datetime.utcnow(),
            "expiry_date": expiry_date,
            "last_validated": None,
            "validation_count": 0,
            "features": features,
            "notes": notes,
            "created_by": created_by,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await self.licenses.insert_one(license_data)
        logger.info(f"License created: {license_key}")
        
        return license_key
    
    async def validate_license(self, license_key: str, domain: str, ip_address: str = None) -> dict:
        """Validate a license key - calls remote license server"""
        import aiohttp
        
        # Remote license server URL
        LICENSE_SERVER_URL = "https://license.synapse.watch"
        
        try:
            # Call remote license server to validate (using query parameters)
            params = {
                "license_key": license_key,
                "domain": domain
            }
            if ip_address:
                params["ip_address"] = ip_address
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{LICENSE_SERVER_URL}/api/validate",
                    params=params,  # Send as query parameters, not JSON body
                    timeout=aiohttp.ClientTimeout(total=10),
                    ssl=False  # Skip SSL verification for self-signed certs
                ) as response:
                    result = await response.json()
                    
                    # Log validation locally
                    await self._log_validation(
                        license_key, 
                        domain, 
                        ip_address,
                        "success" if result.get("valid") else "failed",
                        result.get("reason")
                    )
                    
                    return result
                    
        except Exception as e:
            logger.error(f"Failed to validate license with remote server: {str(e)}")
            await self._log_validation(license_key, domain, ip_address, "failed", f"Server error: {str(e)}")
            return {"valid": False, "reason": f"Unable to connect to license server: {str(e)}"}
    
    async def _log_validation(self, license_key: str, domain: str, ip_address: str, status: str, failure_reason: str = None):
        """Log license validation attempt"""
        await self.validations.insert_one({
            "license_key": license_key,
            "domain": domain,
            "ip_address": ip_address,
            "validated_at": datetime.utcnow(),
            "status": status,
            "failure_reason": failure_reason
        })
    
    async def revoke_license(self, license_key: str, reason: str = ""):
        """Revoke a license"""
        result = await self.licenses.update_one(
            {"license_key": license_key},
            {
                "$set": {
                    "status": "revoked",
                    "notes": f"{reason}. Revoked at {datetime.utcnow()}",
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            logger.info(f"License revoked: {license_key}")
            return True
        return False
    
    async def add_domain(self, license_key: str, domain: str):
        """Add a domain to license whitelist"""
        license = await self.licenses.find_one({"license_key": license_key})
        
        if not license:
            return False
        
        allowed = license.get("allowed_domains", [])
        max_domains = license.get("max_domains", 1)
        
        if len(allowed) >= max_domains:
            return False  # Max domains reached
        
        if domain not in allowed:
            allowed.append(domain)
            await self.licenses.update_one(
                {"license_key": license_key},
                {"$set": {"allowed_domains": allowed}}
            )
        
        return True
    
    async def get_license_info(self, license_key: str) -> dict:
        """Get license information"""
        license = await self.licenses.find_one({"license_key": license_key})
        
        if not license:
            return None
        
        license["id"] = str(license["_id"])
        del license["_id"]
        
        return license
    
    async def get_all_licenses(self):
        """Get all licenses (admin)"""
        licenses = []
        async for lic in self.licenses.find().sort("created_at", -1):
            lic["id"] = str(lic["_id"])
            del lic["_id"]
            licenses.append(lic)
        return licenses
    
    def get_current_domain(self) -> str:
        """Get current application domain from environment"""
        # Try to get from various environment variables
        domain = os.getenv("DOMAIN")
        if not domain:
            # Check BACKEND_PUBLIC_URL first
            domain = os.getenv("BACKEND_PUBLIC_URL", "")
            if not domain:
                # Check PUBLIC_URL (used in Emergent environment)
                domain = os.getenv("PUBLIC_URL", "")
            
            if domain:
                # Extract domain from URL
                domain = domain.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        
        return domain or "localhost"

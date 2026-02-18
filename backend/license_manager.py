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
        """Validate a license key - tries primary server first, falls back to backup"""
        import aiohttp
        
        # Primary license server (iptvb.app)
        PRIMARY_SERVER = "https://license.iptvb.app"
        # Backup license server (synapse.watch)
        BACKUP_SERVER = "https://license.synapse.watch"
        
        # Try primary server first
        try:
            result = await self._validate_with_primary(license_key, domain, PRIMARY_SERVER)
            if result is not None:
                await self._log_validation(license_key, domain, ip_address,
                    "success" if result.get("valid") else "failed",
                    result.get("reason"))
                return result
        except Exception as e:
            logger.warning(f"Primary license server failed: {str(e)}, trying backup...")
        
        # Fall back to backup server
        try:
            result = await self._validate_with_backup(license_key, domain, ip_address, BACKUP_SERVER)
            await self._log_validation(license_key, domain, ip_address,
                "success" if result.get("valid") else "failed",
                result.get("reason"))
            return result
        except Exception as e:
            logger.error(f"Backup license server also failed: {str(e)}")
            await self._log_validation(license_key, domain, ip_address, "failed", f"Both servers failed: {str(e)}")
            return {"valid": False, "reason": f"Unable to connect to license servers"}
    
    async def _validate_with_primary(self, license_key: str, domain: str, server_url: str) -> dict:
        """Validate against primary server (license.iptvb.app)"""
        import aiohttp
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{server_url}/api/verify",
                json={"license_key": license_key, "domain": domain},
                timeout=aiohttp.ClientTimeout(total=10),
                ssl=False
            ) as response:
                data = await response.json()
                
                if data.get("valid"):
                    license_info = data.get("license", {})
                    return {
                        "valid": True,
                        "customer_name": license_info.get("product_name", ""),
                        "domains": license_info.get("domains", []),
                        "status": license_info.get("status", "active"),
                        "expires_at": license_info.get("expires_at"),
                    }
                else:
                    return {
                        "valid": False,
                        "reason": data.get("error", "License validation failed"),
                    }
    
    async def _validate_with_backup(self, license_key: str, domain: str, ip_address: str, server_url: str) -> dict:
        """Validate against backup server (license.synapse.watch)"""
        import aiohttp
        
        params = {"license_key": license_key, "domain": domain}
        if ip_address:
            params["ip_address"] = ip_address
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{server_url}/api/validate",
                params=params,
                timeout=aiohttp.ClientTimeout(total=10),
                ssl=False
            ) as response:
                return await response.json()
    
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

"""
Panel Migration Service
Migrates users, products, and service records between panel types.
Supports: XtreamUI, XuiOne, 1-Stream, NXT Dash, Aether, Gold, Ghost Panel, GhostSurf.

Migration flow:
1. Fetch users from source panel
2. Admin provides package mapping (source pkg → destination pkg)
3. For each user: create on destination panel, update billing records
4. Return detailed migration report
"""
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple

logger = logging.getLogger(__name__)

# Panel types that support the full API-based migration
API_PANELS = ["ghostpanel", "aether", "gold"]
# Panel types where we can only read users (record-only migration)
READ_ONLY_PANELS = ["xtream", "xuione", "onestream", "nxtdash"]
ALL_PANELS = API_PANELS + READ_ONLY_PANELS + ["ghostsurf"]

# Panel categories — IPTV and VPN are incompatible for migration
IPTV_PANELS = ["xtream", "xuione", "onestream", "nxtdash", "aether", "gold", "ghostpanel"]
VPN_PANELS = ["ghostsurf"]

# Display names for panel types (internal key → human-readable label)
PANEL_DISPLAY_NAMES = {
    "xtream": "XtreamUI",
    "xuione": "XuiOne",
    "onestream": "1-Stream",
    "nxtdash": "NXT Dash",
    "aether": "Aether",
    "gold": "Gold",
    "ghostpanel": "Ghost Panel",
    "ghostsurf": "GhostSurf",
}


class MigrationError(Exception):
    def __init__(self, message: str, code: str = "migration_error"):
        super().__init__(message)
        self.message = message
        self.code = code


class PanelMigrationService:
    def __init__(self, db):
        self.db = db

    @staticmethod
    def _validate_panel_compatibility(source_type: str, dest_type: str):
        """Ensure source and destination are in the same category (IPTV↔IPTV or VPN↔VPN)."""
        source_is_iptv = source_type in IPTV_PANELS
        dest_is_iptv = dest_type in IPTV_PANELS
        source_is_vpn = source_type in VPN_PANELS
        dest_is_vpn = dest_type in VPN_PANELS
        if source_is_iptv and dest_is_vpn:
            raise MigrationError(
                "Cannot migrate from an IPTV panel to a VPN panel. IPTV and VPN services are incompatible.",
                "incompatible_panels"
            )
        if source_is_vpn and dest_is_iptv:
            raise MigrationError(
                "Cannot migrate from a VPN panel to an IPTV panel. IPTV and VPN services are incompatible.",
                "incompatible_panels"
            )

    async def get_migration_preview(
        self, source_type: str, source_index: int, dest_type: str, dest_index: int, settings: dict
    ) -> dict:
        """Preview a migration — show users to migrate, packages available on both sides."""
        self._validate_panel_compatibility(source_type, dest_type)
        source_panel = self._get_panel_config(source_type, source_index, settings)
        dest_panel = self._get_panel_config(dest_type, dest_index, settings)

        if not source_panel:
            raise MigrationError(f"Source panel {source_type}[{source_index}] not found", "source_not_found")
        if not dest_panel:
            raise MigrationError(f"Destination panel {dest_type}[{dest_index}] not found", "dest_not_found")

        # Get imported users from source panel
        source_users = []
        cursor = self.db.imported_users.find({
            "panel_type": source_type,
            "panel_index": source_index
        })
        async for user in cursor:
            user["_id"] = str(user["_id"])
            source_users.append(user)

        # Get services linked to source panel
        source_services = []
        cursor = self.db.services.find({
            "panel_type": source_type,
            "panel_index": source_index,
            "status": {"$ne": "cancelled"}
        })
        async for svc in cursor:
            svc["_id"] = str(svc["_id"])
            source_services.append(svc)

        # Get products linked to source panel
        source_products = []
        cursor = self.db.products.find({
            "panel_type": source_type,
            "panel_index": source_index
        })
        async for prod in cursor:
            prod["_id"] = str(prod["_id"])
            source_products.append(prod)

        # Get destination panel packages if it's an API panel
        dest_packages = []
        if dest_type in API_PANELS:
            try:
                dest_svc = await self._create_panel_service(dest_type, dest_panel)
                if dest_svc:
                    dest_packages = await dest_svc.list_packages()
            except Exception as e:
                logger.warning(f"Could not fetch dest packages: {e}")

        return {
            "source": {
                "type": source_type,
                "index": source_index,
                "name": source_panel.get("name", source_panel.get("url", "Unknown")),
                "users_count": len(source_users),
                "services_count": len(source_services),
                "products_count": len(source_products),
                "users": source_users[:50],  # preview first 50
                "products": source_products,
            },
            "destination": {
                "type": dest_type,
                "index": dest_index,
                "name": dest_panel.get("name", dest_panel.get("url", "Unknown")),
                "packages": dest_packages,
            },
            "total_users": len(source_users),
            "total_services": len(source_services),
            "total_products": len(source_products),
        }

    async def execute_migration(
        self,
        source_type: str,
        source_index: int,
        dest_type: str,
        dest_index: int,
        settings: dict,
        package_mapping: Dict[str, int],  # source_package_id -> dest_package_id
        migrate_users_to_panel: bool = True,  # actually create users on dest panel
        preserve_credentials: bool = True,  # keep same username/password
    ) -> dict:
        """Execute migration from source to destination panel."""
        self._validate_panel_compatibility(source_type, dest_type)
        source_panel = self._get_panel_config(source_type, source_index, settings)
        dest_panel = self._get_panel_config(dest_type, dest_index, settings)

        if not source_panel:
            raise MigrationError(f"Source panel not found")
        if not dest_panel:
            raise MigrationError(f"Destination panel not found")

        dest_svc = None
        if migrate_users_to_panel and dest_type in API_PANELS:
            dest_svc = await self._create_panel_service(dest_type, dest_panel)
            if not dest_svc:
                raise MigrationError(f"Could not connect to destination panel")

        report = {
            "started_at": datetime.utcnow().isoformat(),
            "source": f"{source_type}[{source_index}]",
            "destination": f"{dest_type}[{dest_index}]",
            "users_migrated": 0,
            "users_failed": 0,
            "users_skipped": 0,
            "services_updated": 0,
            "products_updated": 0,
            "errors": [],
            "migrated_users": [],
        }

        # 1. Migrate products
        source_products = []
        cursor = self.db.products.find({
            "panel_type": source_type,
            "panel_index": source_index
        })
        async for prod in cursor:
            source_products.append(prod)

        for prod in source_products:
            prod_id = str(prod["_id"])
            old_pkg_id = str(prod.get("package_id", prod.get("panel_package_id", "")))
            # Frontend sends mapping keyed by product _id; also check by source package_id as fallback
            new_pkg_id = package_mapping.get(prod_id) or package_mapping.get(old_pkg_id)

            # Always update panel_type and panel_index for every product
            update_set = {
                "panel_type": dest_type,
                "panel_index": dest_index,
                "migrated_from": {
                    "panel_type": source_type,
                    "panel_index": source_index,
                    "package_id": old_pkg_id,
                    "migrated_at": datetime.utcnow().isoformat()
                }
            }
            # Also update package_id if a mapping was provided
            if new_pkg_id is not None:
                update_set["package_id"] = new_pkg_id
                update_set["panel_package_id"] = new_pkg_id
            else:
                logger.warning(f"Migration: Product '{prod.get('name', prod['_id'])}' has no package mapping for pkg {old_pkg_id}, migrating panel assignment only")
                report["errors"].append({
                    "type": "product_no_mapping",
                    "product": prod.get("name", str(prod["_id"])),
                    "old_package_id": old_pkg_id,
                    "warning": "Product migrated to new panel but package ID was not remapped — update manually in product settings"
                })

            await self.db.products.update_one(
                {"_id": prod["_id"]},
                {"$set": update_set}
            )
            report["products_updated"] += 1

        # Build a normalized lookup: source_package_id → dest_package_id
        # The frontend sends mapping keyed by product._id, so we resolve product._id → source pkg → dest pkg
        pkg_id_mapping = {}  # source_package_id (str) → dest_package_id (str)
        for prod in source_products:
            prod_id = str(prod["_id"])
            old_pkg_id = str(prod.get("package_id", prod.get("panel_package_id", "")))
            mapped_dest = package_mapping.get(prod_id) or package_mapping.get(old_pkg_id)
            if mapped_dest and old_pkg_id:
                pkg_id_mapping[old_pkg_id] = str(mapped_dest)
                # Also map by product _id for direct lookups
                pkg_id_mapping[prod_id] = str(mapped_dest)
        logger.info(f"Migration: Built pkg_id_mapping with {len(pkg_id_mapping)} entries from {len(source_products)} products")

        # 2. Migrate users
        source_users = []
        cursor = self.db.imported_users.find({
            "panel_type": source_type,
            "panel_index": source_index
        })
        async for user in cursor:
            source_users.append(user)

        dest_panel_name = dest_panel.get("name", f"{dest_type}-{dest_index}")

        for user in source_users:
            username = user.get("username", "")
            password = user.get("password", "")

            if not username:
                report["users_skipped"] += 1
                continue

            # Try to create user on destination panel
            panel_user_data = None
            if migrate_users_to_panel and dest_svc:
                try:
                    # Find matching destination package via service record
                    service = await self.db.services.find_one({
                        "panel_type": source_type,
                        "panel_index": source_index,
                        "username": username,
                        "status": {"$ne": "cancelled"}
                    })
                    dest_pkg_id = None
                    if service:
                        old_pkg = str(service.get("package_id", service.get("panel_package_id", "")))
                        # Look up in resolved mapping (source pkg_id → dest pkg_id)
                        dest_pkg_id = pkg_id_mapping.get(old_pkg) or package_mapping.get(old_pkg)
                        # Also try by service's product_id
                        svc_product_id = str(service.get("product_id", ""))
                        if not dest_pkg_id and svc_product_id:
                            dest_pkg_id = pkg_id_mapping.get(svc_product_id) or package_mapping.get(svc_product_id)

                    if not dest_pkg_id:
                        # Try first available mapping value
                        if pkg_id_mapping:
                            dest_pkg_id = list(pkg_id_mapping.values())[0]
                        elif package_mapping:
                            dest_pkg_id = list(package_mapping.values())[0]

                    if dest_pkg_id:
                        create_params = {"package_id": int(dest_pkg_id)}
                        if preserve_credentials and username:
                            create_params["username"] = username
                        if preserve_credentials and password:
                            create_params["password"] = password

                        panel_user_data = await dest_svc.create_user(**create_params)
                        logger.info(f"Migration: Created user {username} on {dest_type}[{dest_index}]")
                    else:
                        report["errors"].append({
                            "username": username,
                            "error": "No package mapping found for this user"
                        })
                        report["users_skipped"] += 1
                        continue

                except Exception as e:
                    error_msg = str(e)
                    # If user already exists, that's OK — just update records
                    if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
                        logger.info(f"Migration: User {username} already exists on dest, updating records only")
                    else:
                        report["errors"].append({"username": username, "error": error_msg})
                        report["users_failed"] += 1
                        continue

            # 3. Update imported_users record
            update_data = {
                "panel_type": dest_type,
                "panel_index": dest_index,
                "panel_name": dest_panel_name,
                "migrated_from": {
                    "panel_type": source_type,
                    "panel_index": source_index,
                    "migrated_at": datetime.utcnow().isoformat()
                }
            }
            if panel_user_data:
                if panel_user_data.get("user_id"):
                    update_data["panel_user_id"] = panel_user_data["user_id"]
                if panel_user_data.get("expiry"):
                    update_data["expiry"] = panel_user_data["expiry"]
                if panel_user_data.get("expiry_ts"):
                    update_data["expiry_ts"] = panel_user_data["expiry_ts"]
                if panel_user_data.get("username"):
                    update_data["username"] = panel_user_data["username"]
                if panel_user_data.get("password"):
                    update_data["password"] = panel_user_data["password"]

            await self.db.imported_users.update_one(
                {"_id": user["_id"]},
                {"$set": update_data}
            )

            # 4. Update linked services
            svc_update = {
                "panel_type": dest_type,
                "panel_index": dest_index,
                "panel_name": dest_panel_name,
            }
            if panel_user_data:
                if panel_user_data.get("expiry"):
                    svc_update["expiry"] = panel_user_data["expiry"]
                if panel_user_data.get("username"):
                    svc_update["username"] = panel_user_data["username"]
                if panel_user_data.get("password"):
                    svc_update["password"] = panel_user_data["password"]

            result = await self.db.services.update_many(
                {
                    "panel_type": source_type,
                    "panel_index": source_index,
                    "username": username,
                    "status": {"$ne": "cancelled"}
                },
                {"$set": svc_update}
            )
            report["services_updated"] += result.modified_count

            report["users_migrated"] += 1
            report["migrated_users"].append({
                "username": username,
                "new_panel_user_id": panel_user_data.get("user_id") if panel_user_data else None,
                "new_expiry": panel_user_data.get("expiry") if panel_user_data else None,
            })

        report["completed_at"] = datetime.utcnow().isoformat()
        report["success"] = report["users_failed"] == 0

        # Save migration log
        await self.db.migration_logs.insert_one({
            **report,
            "created_at": datetime.utcnow()
        })

        return report

    def _get_panel_config(self, panel_type: str, panel_index: int, settings: dict) -> Optional[dict]:
        """Get panel configuration from settings.
        Ghost Panel uses flat settings.ghostpanel_panels[].
        All other panels use nested settings.<key>.panels[] structure.
        """
        if panel_type == "ghostpanel":
            panels = settings.get("ghostpanel_panels", [])
        elif panel_type == "xtream":
            panels = settings.get("xtream", {}).get("panels", [])
        elif panel_type == "xuione":
            panels = settings.get("xuione", {}).get("panels", [])
        elif panel_type == "onestream":
            panels = settings.get("onestream", {}).get("panels", [])
        elif panel_type == "nxtdash":
            panels = settings.get("nxtdash", {}).get("panels", [])
        elif panel_type == "aether":
            panels = settings.get("aether", {}).get("panels", [])
        elif panel_type == "gold":
            panels = settings.get("gold", {}).get("panels", [])
        elif panel_type == "ghostsurf":
            panels = settings.get("ghostsurf", {}).get("panels", [])
        else:
            return None

        if 0 <= panel_index < len(panels):
            return panels[panel_index]
        return None

    async def _create_panel_service(self, panel_type: str, panel_config: dict):
        """Create a panel service instance for the given type."""
        if panel_type == "ghostpanel":
            from ghostpanel_service import get_ghostpanel_service
            return get_ghostpanel_service(panel_config)
        elif panel_type == "aether":
            from aether_service import AetherService
            return AetherService(
                panel_url=panel_config.get("url", ""),
                api_token=panel_config.get("api_token", ""),
                name=panel_config.get("name", ""),
                streaming_url=panel_config.get("streaming_url", ""),
                ssl_verify=panel_config.get("ssl_verify", True),
            )
        elif panel_type == "gold":
            from gold_service import GoldPanelService
            return GoldPanelService(
                panel_url=panel_config.get("url", ""),
                api_key=panel_config.get("api_key", ""),
                name=panel_config.get("name", ""),
                streaming_url=panel_config.get("streaming_url", ""),
                ssl_verify=panel_config.get("ssl_verify", True),
            )
        return None

    async def get_migration_logs(self, limit: int = 20) -> List[dict]:
        """Get recent migration logs."""
        logs = []
        cursor = self.db.migration_logs.find().sort("created_at", -1).limit(limit)
        async for log in cursor:
            log["_id"] = str(log["_id"])
            logs.append(log)
        return logs

    async def get_all_panels_summary(self, settings: dict) -> List[dict]:
        """Get a summary of all configured panels for the migration UI."""
        panels = []
        panel_configs = [
            ("xtream", settings.get("xtream", {}).get("panels", [])),
            ("xuione", settings.get("xuione", {}).get("panels", [])),
            ("onestream", settings.get("onestream", {}).get("panels", [])),
            ("nxtdash", settings.get("nxtdash", {}).get("panels", [])),
            ("aether", settings.get("aether", {}).get("panels", [])),
            ("gold", settings.get("gold", {}).get("panels", [])),
            ("ghostpanel", settings.get("ghostpanel_panels", [])),
            ("ghostsurf", settings.get("ghostsurf", {}).get("panels", [])),
        ]
        for panel_type, panel_list in panel_configs:
            if not isinstance(panel_list, list):
                continue
            for idx, panel in enumerate(panel_list):
                # Count users for this panel
                user_count = await self.db.imported_users.count_documents({
                    "panel_type": panel_type,
                    "panel_index": idx
                })
                service_count = await self.db.services.count_documents({
                    "panel_type": panel_type,
                    "panel_index": idx,
                    "status": {"$ne": "cancelled"}
                })
                product_count = await self.db.products.count_documents({
                    "panel_type": panel_type,
                    "panel_index": idx
                })
                panels.append({
                    "type": panel_type,
                    "index": idx,
                    "name": panel.get("name", panel.get("url", f"{panel_type}-{idx}")),
                    "url": panel.get("url", ""),
                    "users": user_count,
                    "services": service_count,
                    "products": product_count,
                    "can_create_users": panel_type in API_PANELS,
                    "category": "vpn" if panel_type in VPN_PANELS else "iptv",
                })
        return panels

"""
Auto-Update System for IPTV Billing Panel
Pulls updates from GitHub and applies them safely with backup/rollback
"""
import os
import subprocess
import shutil
import json
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class UpdateManager:
    def __init__(self):
        self.repo_url = "https://github.com/asherpoirier/iptvbcms.git"
        self.app_dir = "/app"
        self.backup_dir = "/app/backups"
        self.version_file = "/app/VERSION.json"
        
    def get_current_version(self):
        """Get current installed version"""
        try:
            if os.path.exists(self.version_file):
                with open(self.version_file, 'r') as f:
                    data = json.load(f)
                    return data.get('version'), data.get('commit_hash')
            return None, None
        except Exception as e:
            logger.error(f"Failed to read version: {e}")
            return None, None
    
    def get_latest_version(self):
        """Check GitHub for latest version"""
        try:
            # Get latest commit hash from GitHub
            cmd = f"git ls-remote {self.repo_url} HEAD"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                commit_hash = result.stdout.split()[0]
                return commit_hash
            
            return None
        except Exception as e:
            logger.error(f"Failed to check GitHub: {e}")
            return None
    
    def check_for_updates(self):
        """Check if updates are available"""
        try:
            current_version, current_commit = self.get_current_version()
            latest_commit = self.get_latest_version()
            
            logger.info(f"Current commit: {current_commit}")
            logger.info(f"Latest commit: {latest_commit}")
            
            if not latest_commit:
                return {
                    "update_available": False,
                    "error": "Failed to check GitHub - ensure git is installed and repository is accessible",
                    "current_commit": current_commit,
                    "latest_commit": None
                }
            
            update_available = current_commit != latest_commit if current_commit else True
            
            return {
                "update_available": update_available,
                "current_commit": current_commit,
                "latest_commit": latest_commit,
                "current_version": current_version
            }
        except Exception as e:
            logger.error(f"Update check error: {e}")
            return {
                "update_available": False,
                "error": str(e)
            }
    
    def create_backup(self):
        """Create backup of current installation"""
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_path = f"{self.backup_dir}/backup_{timestamp}"
            
            # Create backup directory
            os.makedirs(self.backup_dir, exist_ok=True)
            
            logger.info(f"Creating backup at {backup_path}")
            
            # Backup critical directories
            shutil.copytree(f"{self.app_dir}/backend", f"{backup_path}/backend", ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
            shutil.copytree(f"{self.app_dir}/frontend", f"{backup_path}/frontend", ignore=shutil.ignore_patterns('node_modules', 'build'))
            
            # Copy version file if exists
            if os.path.exists(self.version_file):
                shutil.copy(self.version_file, f"{backup_path}/VERSION.json")
            
            logger.info(f"✓ Backup created: {backup_path}")
            return backup_path
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            raise Exception(f"Failed to create backup: {e}")
    
    def apply_update(self, backup_path=None):
        """Pull and apply updates from GitHub"""
        try:
            logger.info("Starting update process...")
            
            # Clone or pull latest code to temp directory
            temp_dir = "/tmp/iptvbcms_update"
            
            # Remove old temp if exists
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            
            # Clone repository
            logger.info(f"Cloning repository from {self.repo_url}")
            cmd = f"git clone --depth 1 {self.repo_url} {temp_dir}"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0:
                raise Exception(f"Git clone failed: {result.stderr}")
            
            # Get commit hash
            cmd = f"cd {temp_dir} && git rev-parse HEAD"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            new_commit = result.stdout.strip()
            
            logger.info(f"Downloaded version: {new_commit}")
            
            # Copy files from temp to app directory
            logger.info("Copying backend files...")
            if os.path.exists(f"{temp_dir}/backend"):
                # Remove old backend files (except venv and data)
                for item in os.listdir(f"{self.app_dir}/backend"):
                    if item not in ['.env', '__pycache__', '.venv', 'data']:
                        item_path = f"{self.app_dir}/backend/{item}"
                        if os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                        else:
                            os.remove(item_path)
                
                # Copy new files
                for item in os.listdir(f"{temp_dir}/backend"):
                    if item not in ['.env', '__pycache__']:
                        src = f"{temp_dir}/backend/{item}"
                        dst = f"{self.app_dir}/backend/{item}"
                        if os.path.isdir(src):
                            shutil.copytree(src, dst)
                        else:
                            shutil.copy2(src, dst)
            
            logger.info("Copying frontend files...")
            if os.path.exists(f"{temp_dir}/frontend"):
                # Remove old frontend files (except node_modules and .env)
                for item in os.listdir(f"{self.app_dir}/frontend"):
                    if item not in ['node_modules', '.env', 'build']:
                        item_path = f"{self.app_dir}/frontend/{item}"
                        if os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                        else:
                            os.remove(item_path)
                
                # Copy new files
                for item in os.listdir(f"{temp_dir}/frontend"):
                    if item not in ['node_modules', 'build', '.env']:
                        src = f"{temp_dir}/frontend/{item}"
                        dst = f"{self.app_dir}/frontend/{item}"
                        if os.path.isdir(src):
                            shutil.copytree(src, dst)
                        else:
                            shutil.copy2(src, dst)
            
            # Update version file
            version_data = {
                "version": datetime.utcnow().strftime("%Y.%m.%d.%H%M"),
                "commit_hash": new_commit,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            with open(self.version_file, 'w') as f:
                json.dump(version_data, f, indent=2)
            
            # Cleanup temp directory
            shutil.rmtree(temp_dir)
            
            logger.info("✓ Update applied successfully")
            return {
                "success": True,
                "version": version_data,
                "message": "Update applied successfully. Restart required."
            }
            
        except Exception as e:
            logger.error(f"Update failed: {e}")
            
            # Rollback if backup exists
            if backup_path and os.path.exists(backup_path):
                logger.info(f"Rolling back to backup: {backup_path}")
                self.rollback(backup_path)
                return {
                    "success": False,
                    "error": str(e),
                    "rolled_back": True
                }
            
            return {
                "success": False,
                "error": str(e),
                "rolled_back": False
            }
    
    def rollback(self, backup_path):
        """Restore from backup"""
        try:
            logger.info(f"Restoring from backup: {backup_path}")
            
            # Restore backend
            if os.path.exists(f"{backup_path}/backend"):
                # Remove current backend files
                for item in os.listdir(f"{self.app_dir}/backend"):
                    if item not in ['.env', '__pycache__', '.venv']:
                        item_path = f"{self.app_dir}/backend/{item}"
                        if os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                        else:
                            os.remove(item_path)
                
                # Copy backup files
                for item in os.listdir(f"{backup_path}/backend"):
                    src = f"{backup_path}/backend/{item}"
                    dst = f"{self.app_dir}/backend/{item}"
                    if os.path.isdir(src):
                        shutil.copytree(src, dst)
                    else:
                        shutil.copy2(src, dst)
            
            # Restore frontend
            if os.path.exists(f"{backup_path}/frontend"):
                for item in os.listdir(f"{self.app_dir}/frontend"):
                    if item not in ['node_modules', '.env', 'build']:
                        item_path = f"{self.app_dir}/frontend/{item}"
                        if os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                        else:
                            os.remove(item_path)
                
                for item in os.listdir(f"{backup_path}/frontend"):
                    src = f"{backup_path}/frontend/{item}"
                    dst = f"{self.app_dir}/frontend/{item}"
                    if os.path.isdir(src):
                        shutil.copytree(src, dst)
                    else:
                        shutil.copy2(src, dst)
            
            # Restore version file
            if os.path.exists(f"{backup_path}/VERSION.json"):
                shutil.copy(f"{backup_path}/VERSION.json", self.version_file)
            
            logger.info("✓ Rollback completed")
            return True
            
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return False
    
    def restart_services(self):
        """Restart backend and frontend services"""
        try:
            logger.info("Restarting services...")
            subprocess.run("supervisorctl restart backend frontend", shell=True, timeout=30)
            logger.info("✓ Services restarted")
            return True
        except Exception as e:
            logger.error(f"Failed to restart services: {e}")
            return False
    
    def list_backups(self):
        """List available backups"""
        try:
            if not os.path.exists(self.backup_dir):
                return []
            
            backups = []
            for item in os.listdir(self.backup_dir):
                backup_path = f"{self.backup_dir}/{item}"
                if os.path.isdir(backup_path):
                    stat = os.stat(backup_path)
                    backups.append({
                        "name": item,
                        "path": backup_path,
                        "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        "size_mb": sum(f.stat().st_size for f in Path(backup_path).rglob('*') if f.is_file()) / (1024 * 1024)
                    })
            
            return sorted(backups, key=lambda x: x['created'], reverse=True)
            
        except Exception as e:
            logger.error(f"Failed to list backups: {e}")
            return []

# Singleton instance
update_manager = UpdateManager()

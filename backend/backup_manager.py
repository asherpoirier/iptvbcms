"""
Backup Manager for IPTV Billing Panel
Supports manual backups and cloud storage (Dropbox, Google Drive)
"""
import os
import subprocess
import shutil
import json
from datetime import datetime
from pathlib import Path
import logging
import zipfile
import tempfile

logger = logging.getLogger(__name__)

class BackupManager:
    def __init__(self):
        # Detect if running in production (/opt) or development (/app)
        if os.path.exists("/opt/backend"):
            self.app_dir = "/opt"
        else:
            self.app_dir = "/app"
        
        self.backup_dir = f"{self.app_dir}/backups"
        self.settings_file = f"{self.app_dir}/backend/.backup_settings.json"
        
        logger.info(f"BackupManager initialized with app_dir: {self.app_dir}")
    
    def load_settings(self):
        """Load backup settings"""
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r') as f:
                    return json.load(f)
            return {}
        except Exception as e:
            logger.error(f"Failed to load backup settings: {e}")
            return {}
    
    def save_settings(self, settings):
        """Save backup settings"""
        try:
            with open(self.settings_file, 'w') as f:
                json.dump(settings, f, indent=2)
            os.chmod(self.settings_file, 0o600)  # Secure permissions
            return True
        except Exception as e:
            logger.error(f"Failed to save backup settings: {e}")
            return False
    
    def create_manual_backup(self, description=""):
        """Create a manual backup"""
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_name = f"manual_{timestamp}"
            backup_path = f"{self.backup_dir}/{backup_name}"
            
            os.makedirs(self.backup_dir, exist_ok=True)
            
            logger.info(f"Creating manual backup: {backup_name}")
            
            # Backup backend (excluding venv)
            if os.path.exists(f"{self.app_dir}/backend"):
                shutil.copytree(
                    f"{self.app_dir}/backend",
                    f"{backup_path}/backend",
                    ignore=shutil.ignore_patterns('__pycache__', '*.pyc', 'venv', '.venv', '*.log')
                )
            
            # Backup frontend (excluding node_modules and build)
            if os.path.exists(f"{self.app_dir}/frontend"):
                shutil.copytree(
                    f"{self.app_dir}/frontend",
                    f"{backup_path}/frontend",
                    ignore=shutil.ignore_patterns('node_modules', 'build', '.cache')
                )
            
            # Backup VERSION.json if exists
            version_file = f"{self.app_dir}/VERSION.json"
            if os.path.exists(version_file):
                shutil.copy(version_file, f"{backup_path}/VERSION.json")
            
            # Create metadata
            metadata = {
                "name": backup_name,
                "type": "manual",
                "description": description,
                "created_at": datetime.utcnow().isoformat(),
                "app_dir": self.app_dir
            }
            
            with open(f"{backup_path}/backup_info.json", 'w') as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"✓ Manual backup created: {backup_path}")
            
            # Upload to cloud if enabled
            settings = self.load_settings()
            if settings.get('cloud_backup_enabled'):
                self.upload_to_cloud(backup_path, backup_name)
            
            return {
                "success": True,
                "backup_name": backup_name,
                "backup_path": backup_path,
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Manual backup failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def create_backup_archive(self, backup_path, backup_name):
        """Create a compressed archive of the backup"""
        try:
            archive_path = f"{backup_path}.zip"
            
            logger.info(f"Creating archive: {archive_path}")
            
            with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(backup_path):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, backup_path)
                        zipf.write(file_path, arcname)
            
            logger.info(f"✓ Archive created: {archive_path}")
            return archive_path
            
        except Exception as e:
            logger.error(f"Archive creation failed: {e}")
            return None
    
    def upload_to_cloud(self, backup_path, backup_name):
        """Upload backup to configured cloud storage"""
        settings = self.load_settings()
        cloud_provider = settings.get('cloud_provider')
        
        if not cloud_provider:
            logger.info("No cloud provider configured")
            return False
        
        # Create archive for upload
        archive_path = self.create_backup_archive(backup_path, backup_name)
        if not archive_path:
            return False
        
        try:
            if cloud_provider == 'dropbox':
                return self.upload_to_dropbox(archive_path, backup_name)
            elif cloud_provider == 'google_drive':
                return self.upload_to_google_drive(archive_path, backup_name)
            elif cloud_provider == 'proton_drive':
                return self.upload_to_proton_drive(archive_path, backup_name)
            else:
                logger.warning(f"Unknown cloud provider: {cloud_provider}")
                return False
        finally:
            # Clean up archive after upload
            if os.path.exists(archive_path):
                os.remove(archive_path)
    
    def upload_to_dropbox(self, archive_path, backup_name):
        """Upload backup to Dropbox"""
        try:
            import dropbox
            from dropbox.exceptions import AuthError
            
            settings = self.load_settings()
            access_token = settings.get('dropbox_access_token')
            
            if not access_token:
                logger.error("Dropbox access token not configured")
                return False
            
            logger.info(f"Uploading to Dropbox: {backup_name}")
            
            dbx = dropbox.Dropbox(access_token)
            
            # Test authentication
            try:
                dbx.users_get_current_account()
            except AuthError:
                logger.error("Invalid Dropbox access token")
                return False
            
            # Upload file
            dropbox_path = f"/IPTV_Backups/{backup_name}.zip"
            
            with open(archive_path, 'rb') as f:
                file_size = os.path.getsize(archive_path)
                
                if file_size < 150 * 1024 * 1024:  # Less than 150MB
                    dbx.files_upload(f.read(), dropbox_path, mode=dropbox.files.WriteMode.overwrite)
                else:
                    # Use chunked upload for large files
                    chunk_size = 4 * 1024 * 1024  # 4MB chunks
                    
                    session_start = dbx.files_upload_session_start(f.read(chunk_size))
                    cursor = dropbox.files.UploadSessionCursor(session_start.session_id, f.tell())
                    commit = dropbox.files.CommitInfo(dropbox_path, mode=dropbox.files.WriteMode.overwrite)
                    
                    while f.tell() < file_size:
                        if file_size - f.tell() <= chunk_size:
                            dbx.files_upload_session_finish(f.read(chunk_size), cursor, commit)
                        else:
                            dbx.files_upload_session_append_v2(f.read(chunk_size), cursor)
                            cursor.offset = f.tell()
            
            logger.info(f"✓ Uploaded to Dropbox: {dropbox_path}")
            return True
            
        except ImportError:
            logger.error("Dropbox library not installed. Run: pip install dropbox")
            return False
        except Exception as e:
            logger.error(f"Dropbox upload failed: {e}")
            return False
    
    def upload_to_google_drive(self, archive_path, backup_name):
        """Upload backup to Google Drive using service account"""
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
            from googleapiclient.http import MediaFileUpload
            from googleapiclient.errors import HttpError
            
            settings = self.load_settings()
            
            # Support both service account and OAuth2 user credentials
            credentials_type = settings.get('google_drive_auth_type', 'service_account')
            
            if credentials_type == 'service_account':
                # Service account authentication
                credentials_data = settings.get('google_drive_service_account')
                
                if not credentials_data:
                    logger.error("Google Drive service account credentials not configured")
                    return False
                
                logger.info(f"Uploading to Google Drive (service account): {backup_name}")
                
                # Create credentials from service account JSON
                SCOPES = ['https://www.googleapis.com/auth/drive.file']
                creds = service_account.Credentials.from_service_account_info(
                    credentials_data, scopes=SCOPES
                )
                
            else:
                # OAuth2 user credentials (existing implementation)
                from google.oauth2.credentials import Credentials
                
                credentials_data = settings.get('google_drive_credentials')
                if not credentials_data:
                    logger.error("Google Drive credentials not configured")
                    return False
                
                logger.info(f"Uploading to Google Drive (OAuth2): {backup_name}")
                creds = Credentials.from_authorized_user_info(credentials_data)
            
            # Build Drive service
            service = build('drive', 'v3', credentials=creds)
            
            # Check if backup folder exists, create if not
            folder_query = "name='IPTV_Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            folders = service.files().list(
                q=folder_query, 
                spaces='drive', 
                fields='files(id, name)'
            ).execute()
            
            if folders.get('files'):
                folder_id = folders['files'][0]['id']
                logger.info(f"Using existing folder: {folder_id}")
            else:
                # Create folder
                folder_metadata = {
                    'name': 'IPTV_Backups',
                    'mimeType': 'application/vnd.google-apps.folder'
                }
                folder = service.files().create(
                    body=folder_metadata, 
                    fields='id'
                ).execute()
                folder_id = folder.get('id')
                logger.info(f"Created new folder: {folder_id}")
            
            # Upload file
            file_metadata = {
                'name': f"{backup_name}.zip",
                'parents': [folder_id]
            }
            
            media = MediaFileUpload(
                archive_path, 
                mimetype='application/zip', 
                resumable=True
            )
            
            file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()
            
            logger.info(f"✓ Uploaded to Google Drive: {file.get('id')}")
            return True
            
        except ImportError:
            logger.error("Google Drive library not installed. Run: pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client")
            return False
        except HttpError as e:
            logger.error(f"Google Drive API error: {e}")
            return False
        except Exception as e:
            logger.error(f"Google Drive upload failed: {e}")
            return False
    
    def upload_to_proton_drive(self, archive_path, backup_name):
        """Upload backup to Proton Drive using WebDAV"""
        try:
            from webdav3.client import Client
            
            settings = self.load_settings()
            proton_settings = settings.get('proton_drive', {})
            
            webdav_url = proton_settings.get('webdav_url')
            username = proton_settings.get('username')
            password = proton_settings.get('password')
            
            if not all([webdav_url, username, password]):
                logger.error("Proton Drive WebDAV credentials not configured")
                return False
            
            logger.info(f"Uploading to Proton Drive: {backup_name}")
            
            # Configure WebDAV client
            options = {
                'webdav_hostname': webdav_url,
                'webdav_login': username,
                'webdav_password': password,
                'webdav_timeout': 300
            }
            
            client = Client(options)
            
            # Create backup directory if it doesn't exist
            backup_folder = '/IPTV_Backups'
            try:
                client.mkdir(backup_folder)
            except:
                pass  # Folder might already exist
            
            # Upload file
            remote_path = f"{backup_folder}/{backup_name}.zip"
            client.upload_sync(remote_path=remote_path, local_path=archive_path)
            
            logger.info(f"✓ Uploaded to Proton Drive: {remote_path}")
            return True
            
        except ImportError:
            logger.error("WebDAV library not installed. Run: pip install webdavclient3")
            return False
        except Exception as e:
            logger.error(f"Proton Drive upload failed: {e}")
            return False
    
    def restore_backup(self, backup_name):
        """Restore from a backup"""
        try:
            backup_path = f"{self.backup_dir}/{backup_name}"
            
            if not os.path.exists(backup_path):
                raise Exception(f"Backup not found: {backup_name}")
            
            logger.info(f"Restoring from backup: {backup_name}")
            
            # SAFE: Overlay files (don't delete existing infrastructure)
            if os.path.exists(f"{backup_path}/backend"):
                for root, dirs, files in os.walk(f"{backup_path}/backend"):
                    rel_path = os.path.relpath(root, f"{backup_path}/backend")
                    target_dir = f"{self.app_dir}/backend/{rel_path}" if rel_path != '.' else f"{self.app_dir}/backend"
                    os.makedirs(target_dir, exist_ok=True)
                    
                    for file in files:
                        if file not in ['.env']:  # Don't overwrite .env
                            src = os.path.join(root, file)
                            dst = os.path.join(target_dir, file)
                            shutil.copy2(src, dst)
            
            if os.path.exists(f"{backup_path}/frontend"):
                for root, dirs, files in os.walk(f"{backup_path}/frontend"):
                    rel_path = os.path.relpath(root, f"{backup_path}/frontend")
                    target_dir = f"{self.app_dir}/frontend/{rel_path}" if rel_path != '.' else f"{self.app_dir}/frontend"
                    os.makedirs(target_dir, exist_ok=True)
                    
                    for file in files:
                        if file not in ['.env']:
                            src = os.path.join(root, file)
                            dst = os.path.join(target_dir, file)
                            shutil.copy2(src, dst)
            
            if os.path.exists(f"{backup_path}/VERSION.json"):
                shutil.copy(f"{backup_path}/VERSION.json", f"{self.app_dir}/VERSION.json")
            
            logger.info("✓ Backup restored successfully")
            return True
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False
    
    def list_backups(self):
        """List all available backups"""
        try:
            if not os.path.exists(self.backup_dir):
                return []
            
            backups = []
            for item in os.listdir(self.backup_dir):
                backup_path = f"{self.backup_dir}/{item}"
                if os.path.isdir(backup_path):
                    stat = os.stat(backup_path)
                    
                    # Try to load metadata
                    metadata_file = f"{backup_path}/backup_info.json"
                    metadata = {}
                    if os.path.exists(metadata_file):
                        with open(metadata_file, 'r') as f:
                            metadata = json.load(f)
                    
                    backup_type = "manual" if item.startswith("manual_") else "auto"
                    
                    backups.append({
                        "name": item,
                        "path": backup_path,
                        "type": backup_type,
                        "description": metadata.get("description", ""),
                        "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        "size_mb": round(sum(f.stat().st_size for f in Path(backup_path).rglob('*') if f.is_file()) / (1024 * 1024), 2)
                    })
            
            return sorted(backups, key=lambda x: x['created'], reverse=True)
            
        except Exception as e:
            logger.error(f"Failed to list backups: {e}")
            return []
    
    def delete_backup(self, backup_name):
        """Delete a backup"""
        try:
            backup_path = f"{self.backup_dir}/{backup_name}"
            
            if not os.path.exists(backup_path):
                raise Exception(f"Backup not found: {backup_name}")
            
            shutil.rmtree(backup_path)
            logger.info(f"✓ Backup deleted: {backup_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete backup: {e}")
            return False
    
    def test_cloud_connection(self, provider, credentials):
        """Test cloud storage connection"""
        try:
            if provider == 'dropbox':
                import dropbox
                from dropbox.exceptions import AuthError
                
                access_token = credentials.get('access_token')
                dbx = dropbox.Dropbox(access_token)
                
                try:
                    account = dbx.users_get_current_account()
                    return {
                        "success": True,
                        "account": account.name.display_name,
                        "email": account.email
                    }
                except AuthError:
                    return {
                        "success": False,
                        "error": "Invalid access token"
                    }
            
            elif provider == 'google_drive':
                from google.oauth2 import service_account
                from googleapiclient.discovery import build
                from googleapiclient.errors import HttpError
                
                auth_type = credentials.get('auth_type', 'service_account')
                
                if auth_type == 'service_account':
                    # Service account authentication
                    service_account_data = credentials.get('service_account')
                    
                    if not service_account_data:
                        return {
                            "success": False,
                            "error": "Service account JSON required"
                        }
                    
                    SCOPES = ['https://www.googleapis.com/auth/drive.file']
                    creds = service_account.Credentials.from_service_account_info(
                        service_account_data, scopes=SCOPES
                    )
                    
                    service = build('drive', 'v3', credentials=creds)
                    about = service.about().get(fields="user").execute()
                    
                    return {
                        "success": True,
                        "account": about['user'].get('displayName', 'Service Account'),
                        "email": about['user'].get('emailAddress', 'N/A')
                    }
                else:
                    # OAuth2 user credentials
                    from google.oauth2.credentials import Credentials
                    
                    creds = Credentials.from_authorized_user_info(credentials)
                    service = build('drive', 'v3', credentials=creds)
                    
                    about = service.about().get(fields="user").execute()
                    return {
                        "success": True,
                        "account": about['user']['displayName'],
                        "email": about['user']['emailAddress']
                    }
            
            elif provider == 'proton_drive':
                from webdav3.client import Client
                
                webdav_url = credentials.get('webdav_url')
                username = credentials.get('username')
                password = credentials.get('password')
                
                if not all([webdav_url, username, password]):
                    return {
                        "success": False,
                        "error": "WebDAV URL, username, and password required"
                    }
                
                # Configure WebDAV client
                options = {
                    'webdav_hostname': webdav_url,
                    'webdav_login': username,
                    'webdav_password': password,
                    'webdav_timeout': 10
                }
                
                client = Client(options)
                
                # Test connection by listing root
                try:
                    client.list()
                    return {
                        "success": True,
                        "account": username,
                        "email": username
                    }
                except Exception as e:
                    return {
                        "success": False,
                        "error": f"Connection failed: {str(e)}"
                    }
            
            else:
                return {
                    "success": False,
                    "error": "Unknown provider"
                }
                
        except ImportError as e:
            return {
                "success": False,
                "error": f"Required library not installed: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

# Singleton instance
backup_manager = BackupManager()

#!/bin/bash

################################################################################
# IPTV CMS - Complete Installer for Ubuntu 24.04
# 
# This script will install everything needed to run the CMS:
# - Python, Node.js, MongoDB, Nginx, Supervisor
# - Configure SSL (Certbot or Cloudflare)
# - Set up admin account
# - Install and configure the application
# - Test and verify installation
#
# Run as: sudo bash billing-panel-installer.sh
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Helper functions
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }

# Check root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Welcome
clear
cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     🚀 IPTV CMS - Complete Installer             ║
║     Version 1.0 - Ubuntu 24.04 LTS                          ║
║                                                              ║
║     This installer will set up:                             ║
║     • Python 3.12 + FastAPI backend                         ║
║     • Node.js 20 + React frontend                           ║
║     • MongoDB 7.0 database                                  ║
║     • Nginx web server                                      ║
║     • SSL/HTTPS (Let's Encrypt or Cloudflare)               ║
║     • Supervisor process manager                            ║
║     • Complete CMS                                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF

echo ""
echo -e "${YELLOW}⚠️  This installer will modify your system and install packages.${NC}"
echo -e "${YELLOW}   Make sure you're running this on a fresh Ubuntu 24.04 server.${NC}"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Configuration
print_header "Step 1: Configuration"

# Installation directory
read -p "Installation directory [/opt]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-/opt}
print_info "Installation path: $INSTALL_DIR"

# Domain configuration
read -p "Domain name (e.g., billing.yourdomain.com): " DOMAIN_NAME
while [ -z "$DOMAIN_NAME" ]; do
    print_error "Domain name is required"
    read -p "Domain name: " DOMAIN_NAME
done

# SSL choice
echo ""
echo "SSL/HTTPS Configuration:"
echo "  1) Let's Encrypt (Certbot) - Free SSL certificate"
echo "  2) Cloudflare - Using Cloudflare proxy"
echo "  3) None - HTTP only (not recommended for production)"
read -p "Choose SSL option (1/2/3) [1]: " SSL_CHOICE
SSL_CHOICE=${SSL_CHOICE:-1}

# Admin account
echo ""
print_info "Create admin account for the CMS"
read -p "Admin username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -p "Admin email: " ADMIN_EMAIL
while [ -z "$ADMIN_EMAIL" ]; do
    print_error "Admin email is required"
    read -p "Admin email: " ADMIN_EMAIL
done

while true; do
    read -s -p "Admin password (min 8 characters): " ADMIN_PASS
    echo ""
    read -s -p "Confirm password: " ADMIN_PASS2
    echo ""
    
    if [ "$ADMIN_PASS" = "$ADMIN_PASS2" ]; then
        if [ ${#ADMIN_PASS} -lt 8 ]; then
            print_error "Password must be at least 8 characters"
        else
            break
        fi
    else
        print_error "Passwords don't match"
    fi
done

# License key
echo ""
read -p "License key: " LICENSE_KEY
if [ -z "$LICENSE_KEY" ]; then
    print_warning "No license key provided. Application will show activation screen."
fi

# Update system
print_header "Step 2: System Update & Essential Tools"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y curl wget gnupg -qq
print_success "System updated and essential tools installed"

# Install Python
print_header "Step 3: Installing Python 3.12"
apt-get install -y python3.12 python3.12-venv python3-pip -qq
print_success "Python 3.12 and venv installed"
python3.12 --version

# Install Node.js 20
print_header "Step 4: Installing Node.js 20 & npm"
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        print_success "Node.js $NODE_VERSION already installed"
    else
        print_info "Upgrading to Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs -qq
    fi
else
    print_info "Installing Node.js 20 with npm..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs -qq
    print_success "Node.js and npm installed"
fi
node --version
npm --version

# Install Yarn
if ! command -v yarn &> /dev/null; then
    npm install -g yarn
    print_success "Yarn installed"
else
    print_success "Yarn already installed"
fi

# Install MongoDB
print_header "Step 5: Installing MongoDB 7.0"
if command -v mongod &> /dev/null; then
    print_success "MongoDB already installed"
else
    print_info "Installing MongoDB..."
    apt-get install -y gnupg curl -qq
    
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor 2>/dev/null
    
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
        tee /etc/apt/sources.list.d/mongodb-org-7.0.list >/dev/null
    
    apt-get update -qq
    apt-get install -y mongodb-org -qq
    
    systemctl start mongod
    systemctl enable mongod
    print_success "MongoDB installed and started"
fi

# Install Nginx
print_header "Step 6: Installing Nginx"
if command -v nginx &> /dev/null; then
    print_success "Nginx already installed"
else
    apt-get install -y nginx -qq
    systemctl start nginx
    systemctl enable nginx
    print_success "Nginx installed"
fi

# Install Supervisor
print_header "Step 7: Installing Supervisor"
if command -v supervisorctl &> /dev/null; then
    print_success "Supervisor already installed"
else
    apt-get install -y supervisor -qq
    systemctl start supervisor
    systemctl enable supervisor
    print_success "Supervisor installed"
fi

# Install Certbot if needed
if [ "$SSL_CHOICE" = "1" ]; then
    print_header "Step 8: Installing Certbot"
    if command -v certbot &> /dev/null; then
        print_success "Certbot already installed"
    else
        apt-get install -y certbot python3-certbot-nginx -qq
        print_success "Certbot installed"
    fi
fi

# Create installation directory
print_header "Step 9: Setting Up Application"
mkdir -p "$INSTALL_DIR"/{backend,frontend}
cd "$INSTALL_DIR"

# Copy application files
print_info "Looking for application files..."

# Check current directory first (if installer is run from app directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Skip copy if already in target directory
if [ "$SCRIPT_DIR" = "$INSTALL_DIR" ] || [ "$SCRIPT_DIR/backend" = "$INSTALL_DIR/backend" ]; then
    print_success "Application files already in target directory ($INSTALL_DIR)"
    print_info "Skipping file copy..."
elif [ -f "$SCRIPT_DIR/backend/server.py" ]; then
    print_info "Found application files in current directory"
    
    # Only copy if source != destination
    if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
        cp -r "$SCRIPT_DIR/backend"/* "$INSTALL_DIR/backend/"
        cp -r "$SCRIPT_DIR/frontend"/* "$INSTALL_DIR/frontend/"
        print_success "Application files copied from $SCRIPT_DIR"
    else
        print_success "Files already in place"
    fi
else
    print_warning "Application files not found!"
    print_info "Please ensure the application files are in:"
    print_info "  $INSTALL_DIR/backend/ - FastAPI backend"
    print_info "  $INSTALL_DIR/frontend/ - React frontend"
    print_info ""
    read -p "Press Enter when files are ready, or Ctrl+C to exit..."
    
    # Check again
    if [ ! -f "$INSTALL_DIR/backend/server.py" ]; then
        print_error "Backend files still not found at $INSTALL_DIR/backend/server.py"
        print_info "Please copy your application files manually to $INSTALL_DIR"
        exit 1
    fi
fi

print_success "Application files ready at $INSTALL_DIR"

# Create backend .env
print_header "Step 10: Configuring Backend"

cat > "$INSTALL_DIR/backend/.env" << EOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="iptv_billing"
CORS_ORIGINS="*"
PUBLIC_URL="https://$DOMAIN_NAME"
BACKEND_PUBLIC_URL="https://$DOMAIN_NAME"
$([ -n "$LICENSE_KEY" ] && echo "LICENSE_KEY=\"$LICENSE_KEY\"")
EOF

chmod 600 "$INSTALL_DIR/backend/.env"
print_success "Backend .env configured"

# Install Python dependencies
if [ -f "$INSTALL_DIR/backend/requirements.txt" ]; then
    print_info "Preparing Python dependencies..."
    
    # Remove emergentintegrations (only for hosted environment)
    grep -v "emergentintegrations" "$INSTALL_DIR/backend/requirements.txt" > "$INSTALL_DIR/backend/requirements_clean.txt"
    
    # Add cloud backup dependencies if not present
    if ! grep -q "gitpython" "$INSTALL_DIR/backend/requirements_clean.txt"; then
        echo "gitpython==3.1.43" >> "$INSTALL_DIR/backend/requirements_clean.txt"
    fi
    if ! grep -q "dropbox" "$INSTALL_DIR/backend/requirements_clean.txt"; then
        echo "dropbox==12.0.2" >> "$INSTALL_DIR/backend/requirements_clean.txt"
    fi
    if ! grep -q "google-api-python-client" "$INSTALL_DIR/backend/requirements_clean.txt"; then
        echo "google-auth==2.36.0" >> "$INSTALL_DIR/backend/requirements_clean.txt"
        echo "google-auth-oauthlib==1.2.1" >> "$INSTALL_DIR/backend/requirements_clean.txt"
        echo "google-auth-httplib2==0.2.0" >> "$INSTALL_DIR/backend/requirements_clean.txt"
        echo "google-api-python-client==2.155.0" >> "$INSTALL_DIR/backend/requirements_clean.txt"
    fi
    if ! grep -q "webdavclient3" "$INSTALL_DIR/backend/requirements_clean.txt"; then
        echo "webdavclient3==3.14.6" >> "$INSTALL_DIR/backend/requirements_clean.txt"
    fi
    
    print_info "Installing Python dependencies (this may take a few minutes)..."
    cd "$INSTALL_DIR/backend"
    python3.12 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements_clean.txt -q
    
    # Clean up
    rm requirements_clean.txt
    deactivate
    
    print_success "Python dependencies installed"
fi

# Create frontend .env
print_header "Step 11: Configuring Frontend"

cat > "$INSTALL_DIR/frontend/.env" << EOF
REACT_APP_BACKEND_URL=https://$DOMAIN_NAME
EOF

chmod 600 "$INSTALL_DIR/frontend/.env"
print_success "Frontend .env configured"

# Install Node dependencies and build
if [ -f "$INSTALL_DIR/frontend/package.json" ]; then
    print_info "Installing Node dependencies (this may take a few minutes)..."
    cd "$INSTALL_DIR/frontend"
    yarn install --silent
    print_success "Node dependencies installed"
    
    print_info "Building frontend..."
    yarn build
    print_success "Frontend built"
fi

# Configure Supervisor
print_header "Step 12: Configuring Supervisor"

cat > /etc/supervisor/conf.d/billing-panel.conf << EOF
[program:backend]
command=$INSTALL_DIR/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 1
directory=$INSTALL_DIR/backend
autostart=true
autorestart=true
environment=BACKEND_PUBLIC_URL="https://$DOMAIN_NAME"
stderr_logfile=/var/log/supervisor/backend.err.log
stdout_logfile=/var/log/supervisor/backend.out.log

[program:frontend]
command=/usr/bin/yarn start
directory=$INSTALL_DIR/frontend
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/frontend.err.log
stdout_logfile=/var/log/supervisor/frontend.out.log
EOF

supervisorctl reread
supervisorctl update
print_success "Supervisor configured"

# Configure Nginx based on SSL choice
print_header "Step 13: Configuring Nginx"

if [ "$SSL_CHOICE" = "1" ]; then
    # Let's Encrypt (will configure SSL after DNS is ready)
    cat > /etc/nginx/sites-available/billing-panel << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN_NAME;
    
    root $INSTALL_DIR/frontend/build;
    index index.html;
    
    client_max_body_size 100M;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    print_success "Nginx configured (SSL will be added after DNS verification)"
    
elif [ "$SSL_CHOICE" = "2" ]; then
    # Cloudflare
    cat > /etc/nginx/sites-available/billing-panel << EOF
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN_NAME;
    
    # Self-signed cert (Cloudflare handles real SSL)
    ssl_certificate /etc/ssl/certs/billing-panel.crt;
    ssl_certificate_key /etc/ssl/private/billing-panel.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Cloudflare IP ranges
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 173.245.48.0/20;
    real_ip_header CF-Connecting-IP;
    
    client_max_body_size 100M;
    
    root $INSTALL_DIR/frontend/build;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header CF-Connecting-IP \$http_cf_connecting_ip;
    }
}
EOF
    
    # Generate self-signed cert for Cloudflare
    print_info "Generating self-signed certificate for Cloudflare..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/ssl/private/billing-panel.key \
        -out /etc/ssl/certs/billing-panel.crt \
        -subj "/CN=$DOMAIN_NAME" 2>/dev/null
    
    chmod 600 /etc/ssl/private/billing-panel.key
    print_success "Nginx configured for Cloudflare"
    
else
    # HTTP only
    cat > /etc/nginx/sites-available/billing-panel << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN_NAME;
    
    client_max_body_size 100M;
    
    root $INSTALL_DIR/frontend/build;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
    
    print_success "Nginx configured (HTTP only)"
fi

# Enable site
ln -sf /etc/nginx/sites-available/billing-panel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Create admin user in MongoDB
print_header "Step 14: Creating Admin Account"

if [ -f "$INSTALL_DIR/backend/venv/bin/python" ]; then
    cd "$INSTALL_DIR/backend"
    
    # Generate password hash
    ADMIN_PASS_HASH=$($INSTALL_DIR/backend/venv/bin/python3 -c "
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
print(pwd_context.hash('$ADMIN_PASS'))
" 2>/dev/null)
    
    # Create admin user
    mongosh iptv_billing --eval "
    db.users.updateOne(
        {email: '$ADMIN_EMAIL'},
        {
            \$set: {
                email: '$ADMIN_EMAIL',
                name: '$ADMIN_USER',
                password: '$ADMIN_PASS_HASH',
                role: 'admin',
                email_verified: true,
                credit_balance: 0,
                created_at: new Date()
            }
        },
        {upsert: true}
    )
    " 2>/dev/null
    
    print_success "Admin account created"
fi

# Start services
print_header "Step 15: Starting Services"

supervisorctl start backend
supervisorctl start frontend
sleep 5

if supervisorctl status backend | grep -q RUNNING; then
    print_success "Backend started"
else
    print_error "Backend failed to start"
fi

if supervisorctl status frontend | grep -q RUNNING; then
    print_success "Frontend started"
else
    print_error "Frontend failed to start"
fi

# Configure SSL with Certbot
if [ "$SSL_CHOICE" = "1" ]; then
    print_header "Step 16: Configuring SSL with Let's Encrypt"
    
    print_info "Make sure DNS is pointing to this server before continuing"
    print_info "Add an A record: $DOMAIN_NAME → $(curl -s ifconfig.me)"
    echo ""
    read -p "Press Enter when DNS is configured (or Ctrl+C to skip SSL for now)..."
    
    certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos --email $ADMIN_EMAIL --redirect
    
    if [ $? -eq 0 ]; then
        print_success "SSL certificate installed"
    else
        print_warning "SSL installation failed. You can run 'certbot --nginx -d $DOMAIN_NAME' later"
    fi
fi

# Test installation
print_header "Step 17: Testing Installation"

# Test backend
if curl -s http://localhost:8001/api/health | grep -q "healthy"; then
    print_success "Backend API responding"
else
    print_warning "Backend API not responding yet"
fi

# Test MongoDB
if mongosh --eval "db.version()" >/dev/null 2>&1; then
    print_success "MongoDB accessible"
else
    print_warning "MongoDB connection issue"
fi

# Save credentials
print_header "Step 18: Saving Credentials"

cat > "$INSTALL_DIR/credentials.txt" << EOF
═══════════════════════════════════════════════════════════
IPTV CMS - INSTALLATION CREDENTIALS
═══════════════════════════════════════════════════════════

Domain:        https://$DOMAIN_NAME
Installation:  $INSTALL_DIR

ADMIN ACCOUNT:
--------------
Username:      $ADMIN_USER
Email:         $ADMIN_EMAIL
Password:      $ADMIN_PASS

LICENSE:
--------
$([ -n "$LICENSE_KEY" ] && echo "License Key:   $LICENSE_KEY" || echo "No license key provided")

DATABASE:
---------
MongoDB:       mongodb://localhost:27017/iptv_billing

SERVICES:
---------
Backend:       supervisorctl status backend
Frontend:      supervisorctl status frontend
Nginx:         systemctl status nginx

LOGS:
-----
Backend:       tail -f /var/log/supervisor/backend.err.log
Frontend:      tail -f /var/log/supervisor/frontend.err.log
Nginx:         tail -f /var/log/nginx/error.log

$([ "$SSL_CHOICE" = "2" ] && cat << 'CFEOF'
CLOUDFLARE SETUP:
-----------------
1. Add DNS A record: $DOMAIN_NAME → YOUR_SERVER_IP
2. Enable Proxy (orange cloud)
3. Set SSL/TLS mode to "Full"
4. Visit https://$DOMAIN_NAME

CFEOF
)

═══════════════════════════════════════════════════════════
KEEP THIS FILE SECURE!
═══════════════════════════════════════════════════════════
EOF

chmod 600 "$INSTALL_DIR/credentials.txt"
print_success "Credentials saved to $INSTALL_DIR/credentials.txt"

# Final summary
clear
cat << "EOF"
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     ✅ Installation Complete!                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF

echo ""
echo -e "${GREEN}🎉 IPTV CMS Successfully Installed!${NC}"
echo ""
echo -e "${BLUE}Access Information:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐 URL: https://$DOMAIN_NAME"
echo "  👤 Admin: $ADMIN_EMAIL"
echo "  🔑 Password: [See credentials.txt]"
echo ""

if [ "$SSL_CHOICE" = "1" ]; then
    echo -e "${YELLOW}📋 SSL Setup (Let's Encrypt):${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  1. Make sure DNS points to this server"
    echo "  2. Run: certbot --nginx -d $DOMAIN_NAME"
    echo "  3. Certificate will auto-renew"
    echo ""
elif [ "$SSL_CHOICE" = "2" ]; then
    echo -e "${YELLOW}☁️  Cloudflare Setup:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  1. Add DNS A record in Cloudflare"
    echo "  2. Enable Proxy (orange cloud)"
    echo "  3. Set SSL mode to 'Full'"
    echo "  4. Visit https://$DOMAIN_NAME"
    echo ""
fi

if [ -z "$LICENSE_KEY" ]; then
    echo -e "${YELLOW}🔐 License Activation:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  1. Purchase license from: https://t.me/iptvbilling"
    echo "  2. Add to .env: LICENSE_KEY=your-key"
    echo "  3. Restart: supervisorctl restart backend"
    echo ""
fi

echo -e "${BLUE}📋 Quick Commands:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Check status:    supervisorctl status"
echo "  Restart backend: supervisorctl restart backend"
echo "  Restart frontend: supervisorctl restart frontend"
echo "  View logs:       tail -f /var/log/supervisor/backend.err.log"
echo "  Nginx reload:    systemctl reload nginx"
echo ""
echo -e "${GREEN}Credentials saved in: $INSTALL_DIR/credentials.txt${NC}"
echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Installation completed successfully!${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Visit https://$DOMAIN_NAME to access your CMS!"
echo ""

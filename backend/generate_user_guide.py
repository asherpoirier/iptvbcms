#!/usr/bin/env python3
"""
IPTV Billing - Admin User Guide PDF Generator
Generates a comprehensive PDF user guide with Table of Contents
"""
from fpdf import FPDF
import os

class UserGuidePDF(FPDF):
    def __init__(self):
        super().__init__()
        self.toc_entries = []
        self.section_num = 0
        self.subsection_num = 0
        self.set_auto_page_break(auto=True, margin=25)
        
    def header(self):
        if self.page_no() > 1:
            self.set_font('Helvetica', 'I', 9)
            self.set_text_color(120, 120, 120)
            self.cell(0, 10, 'IPTV Billing - Admin User Guide', align='L')
            self.ln(3)
            self.set_draw_color(200, 200, 200)
            self.line(10, self.get_y(), self.w - 10, self.get_y())
            self.ln(5)
    
    def footer(self):
        if self.page_no() > 1:
            self.set_y(-20)
            self.set_draw_color(200, 200, 200)
            self.line(10, self.get_y(), self.w - 10, self.get_y())
            self.set_font('Helvetica', 'I', 8)
            self.set_text_color(128, 128, 128)
            self.cell(0, 10, f'Page {self.page_no()}', align='C')

    def cover_page(self):
        self.add_page()
        self.ln(50)
        # Title block
        self.set_fill_color(37, 99, 235)
        self.rect(0, 40, self.w, 80, 'F')
        self.set_y(55)
        self.set_font('Helvetica', 'B', 36)
        self.set_text_color(255, 255, 255)
        self.cell(0, 18, 'IPTV Billing', align='C', new_x="LMARGIN", new_y="NEXT")
        self.set_font('Helvetica', '', 18)
        self.cell(0, 12, 'Administrator User Guide', align='C', new_x="LMARGIN", new_y="NEXT")
        self.set_font('Helvetica', 'I', 12)
        self.set_text_color(200, 220, 255)
        self.cell(0, 10, 'Complete Feature Reference for System Administrators', align='C', new_x="LMARGIN", new_y="NEXT")
        
        # Info block
        self.set_y(145)
        self.set_text_color(80, 80, 80)
        self.set_font('Helvetica', '', 11)
        info_items = [
            ('Document Type', 'Admin User Guide'),
            ('Version', '1.0'),
            ('Audience', 'System Administrators'),
            ('Last Updated', 'February 2026'),
        ]
        for label, value in info_items:
            self.set_font('Helvetica', 'B', 11)
            self.cell(60, 10, f'{label}:', align='R')
            self.set_font('Helvetica', '', 11)
            self.cell(0, 10, f'  {value}', align='L', new_x="LMARGIN", new_y="NEXT")
        
        self.ln(20)
        self.set_draw_color(37, 99, 235)
        self.set_line_width(0.5)
        self.line(60, self.get_y(), self.w - 60, self.get_y())
        self.ln(10)
        self.set_font('Helvetica', 'I', 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, 'This document covers all administrative features including dashboard,', align='C', new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 8, 'customer management, panel integration, billing, and system settings.', align='C', new_x="LMARGIN", new_y="NEXT")

    def add_toc_placeholder(self):
        """Add placeholder pages for TOC - will be filled later"""
        self.toc_page_start = self.page_no() + 1
        self.add_page()
        self.toc_y_start = self.get_y()
        # Reserve 3 pages for TOC
        self.add_page()
        self.add_page()
        
    def build_toc(self):
        """Build actual TOC on the reserved pages"""
        page = self.toc_page_start
        self.page = page
        self.set_y(15)
        
        self.set_font('Helvetica', 'B', 22)
        self.set_text_color(37, 99, 235)
        self.cell(0, 14, 'Table of Contents', align='L', new_x="LMARGIN", new_y="NEXT")
        self.ln(3)
        self.set_draw_color(37, 99, 235)
        self.set_line_width(0.8)
        self.line(10, self.get_y(), 80, self.get_y())
        self.ln(8)
        
        for entry in self.toc_entries:
            level = entry['level']
            title = entry['title']
            pg = entry['page']
            
            if self.get_y() > self.h - 30:
                page += 1
                self.page = page
                self.set_y(25)
            
            if level == 1:
                self.set_font('Helvetica', 'B', 12)
                self.set_text_color(30, 30, 30)
                indent = 0
                self.ln(3)
            else:
                self.set_font('Helvetica', '', 10)
                self.set_text_color(80, 80, 80)
                indent = 10
            
            x_start = 10 + indent
            self.set_x(x_start)
            title_w = 145 - indent
            page_w = 25
            
            # Title
            self.cell(title_w, 7, title, new_x="RIGHT")
            
            # Dots
            dots_w = self.w - 10 - self.get_x() - page_w + title_w
            
            # Page number
            self.cell(page_w, 7, str(pg), align='R', new_x="LMARGIN", new_y="NEXT")
            
            if level == 1:
                self.ln(1)

    def add_section(self, title):
        self.section_num += 1
        self.subsection_num = 0
        
        if self.get_y() > self.h - 60:
            self.add_page()
        else:
            self.ln(6)
        
        num = f'{self.section_num}.'
        full_title = f'{num} {title}'
        
        self.toc_entries.append({
            'level': 1, 
            'title': full_title, 
            'page': self.page_no()
        })
        
        # Section header with blue bar
        self.set_fill_color(37, 99, 235)
        self.rect(10, self.get_y(), 4, 14, 'F')
        self.set_x(18)
        self.set_font('Helvetica', 'B', 18)
        self.set_text_color(30, 30, 30)
        self.cell(0, 14, full_title, new_x="LMARGIN", new_y="NEXT")
        self.ln(3)
        self.set_draw_color(220, 220, 220)
        self.set_line_width(0.3)
        self.line(10, self.get_y(), self.w - 10, self.get_y())
        self.ln(5)

    def add_subsection(self, title):
        self.subsection_num += 1
        
        if self.get_y() > self.h - 50:
            self.add_page()
        else:
            self.ln(4)
        
        num = f'{self.section_num}.{self.subsection_num}'
        full_title = f'{num} {title}'
        
        self.toc_entries.append({
            'level': 2, 
            'title': full_title, 
            'page': self.page_no()
        })
        
        self.set_font('Helvetica', 'B', 13)
        self.set_text_color(55, 65, 81)
        self.cell(0, 10, full_title, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def add_paragraph(self, text):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(55, 65, 81)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def add_step(self, number, text):
        if self.get_y() > self.h - 25:
            self.add_page()
        self.set_fill_color(37, 99, 235)
        # Step circle
        x = 15
        y = self.get_y() + 3
        self.set_draw_color(37, 99, 235)
        self.set_fill_color(37, 99, 235)
        self.ellipse(x - 3, y - 3, 12, 12, 'F')
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(255, 255, 255)
        self.set_xy(x - 3, y - 2)
        self.cell(12, 8, str(number), align='C')
        
        # Step text
        self.set_xy(30, y - 3)
        self.set_font('Helvetica', '', 10)
        self.set_text_color(55, 65, 81)
        self.multi_cell(self.w - 40, 6, text)
        self.ln(2)

    def add_bullet(self, text, bold_prefix=None):
        if self.get_y() > self.h - 20:
            self.add_page()
        self.set_x(18)
        self.set_font('Helvetica', '', 10)
        self.set_text_color(37, 99, 235)
        self.cell(6, 6, '-')
        if bold_prefix:
            self.set_font('Helvetica', 'B', 10)
            self.set_text_color(55, 65, 81)
            self.cell(self.get_string_width(bold_prefix) + 1, 6, bold_prefix)
            self.set_font('Helvetica', '', 10)
            self.multi_cell(0, 6, text)
        else:
            self.set_text_color(55, 65, 81)
            self.multi_cell(self.w - 34, 6, text)
        self.ln(1)

    def add_tip_box(self, text, box_type='tip'):
        if self.get_y() > self.h - 40:
            self.add_page()
        self.ln(2)
        colors = {
            'tip': (219, 234, 254, 37, 99, 235, 'Tip'),
            'warning': (254, 243, 199, 217, 119, 6, 'Warning'),
            'note': (220, 252, 231, 22, 163, 74, 'Note'),
            'important': (254, 226, 226, 220, 38, 38, 'Important'),
        }
        bg_r, bg_g, bg_b, accent_r, accent_g, accent_b, label = colors.get(box_type, colors['tip'])
        
        y_start = self.get_y()
        self.set_fill_color(bg_r, bg_g, bg_b)
        
        # Calculate height needed
        self.set_font('Helvetica', '', 9)
        # Approximate height
        lines = len(text) / 80 + 1
        box_h = max(20, lines * 6 + 16)
        
        self.rect(10, y_start, self.w - 20, box_h, 'F')
        self.set_fill_color(accent_r, accent_g, accent_b)
        self.rect(10, y_start, 3, box_h, 'F')
        
        self.set_xy(18, y_start + 4)
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(accent_r, accent_g, accent_b)
        self.cell(0, 5, label.upper(), new_x="LMARGIN", new_y="NEXT")
        self.set_x(18)
        self.set_font('Helvetica', '', 9)
        self.set_text_color(55, 65, 81)
        self.multi_cell(self.w - 30, 5, text)
        self.set_y(y_start + box_h + 4)

    def add_table(self, headers, rows, col_widths=None):
        if self.get_y() > self.h - 40:
            self.add_page()
        self.ln(2)
        
        if col_widths is None:
            col_widths = [(self.w - 20) / len(headers)] * len(headers)
        
        # Header
        self.set_fill_color(243, 244, 246)
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(55, 65, 81)
        self.set_draw_color(229, 231, 235)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 10, h, border=1, fill=True, align='C')
        self.ln()
        
        # Rows
        self.set_font('Helvetica', '', 9)
        for row in rows:
            if self.get_y() > self.h - 20:
                self.add_page()
            for i, cell_text in enumerate(row):
                self.cell(col_widths[i], 8, str(cell_text), border=1, align='C')
            self.ln()
        self.ln(3)

    def add_screenshot_placeholder(self, caption, width=160, height=60):
        """Add a styled placeholder box representing where a screenshot would go"""
        if self.get_y() > self.h - height - 20:
            self.add_page()
        self.ln(2)
        x = (self.w - width) / 2
        y = self.get_y()
        
        # Background
        self.set_fill_color(248, 250, 252)
        self.set_draw_color(203, 213, 225)
        self.set_line_width(0.5)
        self.rect(x, y, width, height, 'DF')
        
        # Inner dashed border effect
        self.set_draw_color(226, 232, 240)
        self.rect(x + 3, y + 3, width - 6, height - 6, 'D')
        
        # Icon area (monitor icon)
        icon_y = y + height/2 - 12
        self.set_fill_color(226, 232, 240)
        self.rect(x + width/2 - 15, icon_y, 30, 18, 'DF')
        self.rect(x + width/2 - 5, icon_y + 18, 10, 4, 'DF')
        
        # Caption
        self.set_xy(x, y + height + 2)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(148, 163, 184)
        self.cell(width, 6, caption, align='C')
        self.ln(10)


def generate_guide():
    pdf = UserGuidePDF()
    
    # ============================================
    # COVER PAGE
    # ============================================
    pdf.cover_page()
    
    # ============================================
    # TABLE OF CONTENTS (placeholder)
    # ============================================
    pdf.add_toc_placeholder()
    
    # ============================================
    # SECTION 1: GETTING STARTED
    # ============================================
    pdf.add_page()
    pdf.add_section('Getting Started')
    
    pdf.add_subsection('Logging In')
    pdf.add_paragraph('To access the IPTV Billing admin panel, navigate to your domain and log in with your administrator credentials.')
    pdf.add_step(1, 'Open your browser and go to your billing panel URL (e.g., https://yourdomain.com/login)')
    pdf.add_step(2, 'Enter your admin email address and password')
    pdf.add_step(3, 'If Two-Factor Authentication (2FA) is enabled, enter the 6-digit code from your authenticator app')
    pdf.add_step(4, 'Click "Login" to access the admin dashboard')
    pdf.add_screenshot_placeholder('Figure 1.1 - Admin Login Page')
    pdf.add_tip_box('If you forget your password, contact your system administrator or use the password reset function if configured via SMTP.', 'tip')
    
    pdf.add_subsection('Navigation Overview')
    pdf.add_paragraph('The admin panel uses a sidebar navigation on the left side of the dashboard. The sidebar contains the following sections:')
    pdf.add_table(
        ['Menu Item', 'Description', 'Key Actions'],
        [
            ['Dashboard', 'System overview & stats', 'View revenue, tickets, orders'],
            ['Customers', 'Manage customer accounts', 'Add, edit, delete customers'],
            ['Orders', 'View & process orders', 'Mark paid, cancel, bulk actions'],
            ['Imported Users', 'Panel users management', 'Sync, create, extend, suspend'],
            ['Products', 'Manage service packages', 'Create, edit, reorder products'],
            ['Email', 'Mass email & templates', 'Send campaigns, manage templates'],
            ['Downloads', 'File management', 'Upload apps & files for customers'],
            ['Coupons', 'Discount codes', 'Create & manage coupon codes'],
            ['Refunds', 'Process refunds', 'Review & approve refund requests'],
            ['Tickets', 'Support tickets', 'View & respond to customer tickets'],
            ['Settings', 'System configuration', 'Panels, payments, branding, etc.'],
        ],
        [40, 45, 105]
    )
    pdf.add_screenshot_placeholder('Figure 1.2 - Admin Dashboard with Sidebar Navigation')

    # ============================================
    # SECTION 2: DASHBOARD
    # ============================================
    pdf.add_page()
    pdf.add_section('Dashboard')
    
    pdf.add_subsection('Overview Statistics')
    pdf.add_paragraph('The dashboard provides a real-time snapshot of your billing system with four key metric cards:')
    pdf.add_bullet('Total number of registered customer accounts', bold_prefix='Total Customers: ')
    pdf.add_bullet('Count of currently active subscriptions vs total services', bold_prefix='Active Services: ')
    pdf.add_bullet('Cumulative revenue from all paid orders', bold_prefix='Total Revenue: ')
    pdf.add_bullet('Number of support tickets needing admin response', bold_prefix='Awaiting Reply: ')
    pdf.add_screenshot_placeholder('Figure 2.1 - Dashboard Statistics Cards')
    
    pdf.add_subsection('Revenue Chart')
    pdf.add_paragraph('The Revenue Overview chart displays a 7-day area graph showing daily revenue trends. Hover over any point on the chart to see the exact revenue amount for that day. This helps you identify sales patterns and peak periods.')
    
    pdf.add_subsection('Ticket Status')
    pdf.add_paragraph('The Ticket Status panel shows a breakdown of all support tickets by their current state:')
    pdf.add_bullet('New tickets that need initial response', bold_prefix='Awaiting Reply: ')
    pdf.add_bullet('Recently submitted tickets', bold_prefix='Open: ')
    pdf.add_bullet('Tickets currently being handled', bold_prefix='In Progress: ')
    pdf.add_bullet('Resolved and archived tickets', bold_prefix='Closed: ')
    pdf.add_paragraph('Click on "Awaiting Reply" to go directly to the Tickets page.')
    
    pdf.add_subsection('Recent Orders')
    pdf.add_paragraph('The bottom section displays the 5 most recent orders with their Order ID, Customer Name, Total Amount, Payment Status, and Date. Click "View all orders" to navigate to the full Orders management page.')

    # ============================================
    # SECTION 3: CUSTOMER MANAGEMENT
    # ============================================
    pdf.add_page()
    pdf.add_section('Customer Management')
    
    pdf.add_subsection('Viewing Customers')
    pdf.add_paragraph('The Customers page displays all registered customer accounts in a paginated table. You can search customers by name or email using the search bar at the top.')
    pdf.add_paragraph('The table shows: Name, Email, Number of Services, Number of Orders, and Join Date. Use the pagination controls at the bottom to navigate between pages and adjust the number of entries displayed (10, 15, 20, 25, 50, or 100 per page).')
    pdf.add_screenshot_placeholder('Figure 3.1 - Customers List View')
    
    pdf.add_subsection('Adding a New Customer')
    pdf.add_paragraph('To create a new customer account manually:')
    pdf.add_step(1, 'Click the "Add Customer" button (blue button, top right)')
    pdf.add_step(2, 'Enter the customer\'s Full Name')
    pdf.add_step(3, 'Enter the customer\'s Email Address')
    pdf.add_step(4, 'Enter a Password (minimum 6 characters) or click "Generate random password" to auto-create one')
    pdf.add_step(5, 'Click "Create Customer" to save')
    pdf.add_tip_box('The customer\'s email will be pre-verified automatically. They can log in immediately using the credentials you set. A referral code is also generated automatically.', 'note')
    pdf.add_screenshot_placeholder('Figure 3.2 - Add Customer Modal')
    
    pdf.add_subsection('Viewing Customer Details')
    pdf.add_paragraph('Click the eye icon on any customer row to open the Customer Details modal. This displays:')
    pdf.add_bullet('Name, Email, Customer ID, and Join Date', bold_prefix='Customer Information: ')
    pdf.add_bullet('All active, suspended, or cancelled services with their credentials', bold_prefix='Services: ')
    pdf.add_bullet('Complete order history with status and amounts', bold_prefix='Orders: ')
    pdf.add_paragraph('From this modal, you can also:')
    pdf.add_bullet('Click "Change Password" to reset the customer\'s login password')
    pdf.add_bullet('Click "Add Service" to manually provision a new service for this customer')
    
    pdf.add_subsection('Adding a Service to a Customer')
    pdf.add_paragraph('From the Customer Details modal, click "Add Service" to manually create a subscription:')
    pdf.add_step(1, 'Select the Service Type (Subscriber or Reseller)')
    pdf.add_step(2, 'Select the Panel (filters available products)')
    pdf.add_step(3, 'Select a Product from the filtered list')
    pdf.add_step(4, 'Click "Create Service" to provision the account on the panel')
    pdf.add_tip_box('The service will be provisioned with the duration and settings defined by the selected product. Credentials will be generated automatically on the panel.', 'note')
    
    pdf.add_subsection('Editing a Customer')
    pdf.add_paragraph('Click the pencil icon on any customer row to edit their Name and Email. Make your changes and click "Save Changes" to update the record.')
    
    pdf.add_subsection('Deleting a Customer')
    pdf.add_paragraph('Click the trash icon to delete a customer. This will permanently remove:')
    pdf.add_bullet('The customer account')
    pdf.add_bullet('All associated orders')
    pdf.add_bullet('All associated services')
    pdf.add_bullet('All associated invoices')
    pdf.add_tip_box('This action cannot be undone. A confirmation dialog will appear before deletion.', 'important')

    # ============================================
    # SECTION 4: ORDER MANAGEMENT
    # ============================================
    pdf.add_page()
    pdf.add_section('Order Management')
    
    pdf.add_subsection('Viewing Orders')
    pdf.add_paragraph('The Orders page displays all customer orders in a searchable, filterable, paginated table. You can search by customer name, email, or Order ID.')
    pdf.add_paragraph('Filter orders by status using the tab buttons:')
    pdf.add_bullet('Show all orders regardless of status', bold_prefix='All: ')
    pdf.add_bullet('Orders awaiting payment confirmation', bold_prefix='Pending: ')
    pdf.add_bullet('Successfully processed and provisioned orders', bold_prefix='Paid: ')
    pdf.add_bullet('Orders that were cancelled by admin or customer', bold_prefix='Cancelled: ')
    pdf.add_screenshot_placeholder('Figure 4.1 - Orders Management Page')
    
    pdf.add_subsection('Processing Individual Orders')
    pdf.add_paragraph('For each pending order, you have two actions:')
    pdf.add_bullet('Click the green "Paid" button to confirm payment. This automatically provisions the customer\'s services on the panel (creates XtreamUI/XuiOne accounts, sets up credentials, etc.)', bold_prefix='Mark as Paid: ')
    pdf.add_bullet('Click the red "Cancel" button to cancel the order. This action cannot be undone.', bold_prefix='Cancel Order: ')
    
    pdf.add_subsection('Bulk Order Actions')
    pdf.add_paragraph('For managing multiple orders efficiently:')
    pdf.add_step(1, 'Select individual orders using the checkboxes, or click the header checkbox to select all visible orders')
    pdf.add_step(2, 'Use "Select all pending" to quickly select only pending orders')
    pdf.add_step(3, 'Click "Mark Paid" to process all selected pending orders, or "Cancel" to cancel them')
    pdf.add_tip_box('Bulk actions only apply to pending orders. Already paid or cancelled orders in the selection will be skipped automatically.', 'note')

    # ============================================
    # SECTION 5: IMPORTED USERS
    # ============================================
    pdf.add_page()
    pdf.add_section('Imported Users (Panel Users)')
    
    pdf.add_paragraph('The Imported Users page manages users that exist on your XtreamUI and XuiOne IPTV panels. This is the central hub for syncing, creating, extending, and managing panel-level user accounts.')
    
    pdf.add_subsection('Understanding Imported Users')
    pdf.add_paragraph('Imported Users are accounts that exist on your IPTV streaming panels (XtreamUI or XuiOne). These are different from Customers, who are billing system accounts. A Customer may have one or more Imported Users (services) associated with them.')
    pdf.add_paragraph('Users are organized into two tabs:')
    pdf.add_bullet('End users with streaming access credentials (username, password, expiry date, connections)', bold_prefix='Subscribers: ')
    pdf.add_bullet('Sub-resellers with their own panel access, credits, and ability to create lines', bold_prefix='Resellers: ')
    
    pdf.add_subsection('Filtering and Searching')
    pdf.add_paragraph('Use the filter bar at the top to narrow down the user list:')
    pdf.add_bullet('Search by username, password, or owner name', bold_prefix='Search: ')
    pdf.add_bullet('Filter by specific XtreamUI or XuiOne panel', bold_prefix='Panel Filter: ')
    pdf.add_bullet('Filter by Active, Suspended, or Expired status', bold_prefix='Status Filter: ')
    pdf.add_paragraph('The statistics bar shows Total Imported, Subscribers count, Resellers count, Active count, and Expired count.')
    pdf.add_screenshot_placeholder('Figure 5.1 - Imported Users Page with Filters')
    
    pdf.add_subsection('Syncing Users from Panels')
    pdf.add_paragraph('The "Sync Users" button fetches all current users from all configured panels and updates the local database.')
    pdf.add_step(1, 'Click the green "Sync Users" button in the top right')
    pdf.add_step(2, 'Wait for the sync to complete (a spinner will appear)')
    pdf.add_step(3, 'Review the sync summary banner showing: new users added, updated users, and removed users')
    pdf.add_tip_box('The sync also performs cleanup: if a panel has been deleted from Settings, all users associated with that panel will be automatically removed from the imported users list.', 'note')
    pdf.add_tip_box('Sync connects to each panel individually. If a panel is offline, you will see a warning for that panel while others complete successfully.', 'warning')
    
    pdf.add_subsection('Creating a Panel User')
    pdf.add_paragraph('To create a new user directly on a panel:')
    pdf.add_step(1, 'Click the blue "Create User" button')
    pdf.add_step(2, 'Select the Panel Type: XtreamUI or XuiOne')
    pdf.add_step(3, 'Select the specific Panel from the dropdown')
    pdf.add_step(4, 'Select Account Type: Subscriber or Reseller (XtreamUI only for resellers)')
    pdf.add_step(5, 'Optionally enter a Username and Password (leave blank to auto-generate)')
    pdf.add_step(6, 'For Subscribers: Select a Package from the panel (this determines duration, connections, and bouquets)')
    pdf.add_step(7, 'For Resellers: Enter the Credits amount to assign')
    pdf.add_step(8, 'Click "Create User" to provision the account')
    pdf.add_paragraph('On success, the created user\'s credentials will be displayed. Save these credentials as the password will not be shown again.')
    pdf.add_screenshot_placeholder('Figure 5.2 - Create Panel User Modal')
    pdf.add_tip_box('Users created this way are added directly to the panel and are NOT linked to any billing system customer. They appear in the Imported Users list.', 'note')
    
    pdf.add_subsection('Extending a Subscription')
    pdf.add_paragraph('To extend an existing subscriber\'s access period:')
    pdf.add_step(1, 'Find the subscriber in the list and click the "Extend" button')
    pdf.add_step(2, 'Review the current user info (username, panel, current expiry)')
    pdf.add_step(3, 'Select a Package from the dropdown (packages are loaded from the user\'s specific panel)')
    pdf.add_step(4, 'Review the package details (duration, connections)')
    pdf.add_step(5, 'Click "Extend Subscription" to apply')
    pdf.add_paragraph('On success, the modal will show the previous expiry date, new expiry date, and the number of days added. The extension is applied on both the billing system and the actual XtreamUI/XuiOne panel.')
    pdf.add_screenshot_placeholder('Figure 5.3 - Extend Subscription Modal')
    
    pdf.add_subsection('Suspending and Activating Users')
    pdf.add_paragraph('For active subscribers, click the "Suspend" button to temporarily disable their access. For suspended users, click "Activate" to re-enable access. These actions are reflected on the panel in real-time.')
    
    pdf.add_subsection('Removing an Imported User')
    pdf.add_paragraph('Click the trash icon to remove a user from the billing panel\'s imported users list. This only removes them from the billing system tracking - it does NOT delete their account from the actual XtreamUI/XuiOne panel.')

    # ============================================
    # SECTION 6: PRODUCT MANAGEMENT
    # ============================================
    pdf.add_page()
    pdf.add_section('Product Management')
    
    pdf.add_subsection('Overview')
    pdf.add_paragraph('Products are the service packages that customers can purchase through the billing system. Each product is linked to a specific panel and defines the service parameters (channels, connections, duration, price).')
    pdf.add_paragraph('There are two product types:')
    pdf.add_bullet('Monthly/periodic subscriptions for end-user IPTV access', bold_prefix='Subscriber Packages: ')
    pdf.add_bullet('One-time payment for reseller panel access with credits', bold_prefix='Reseller Packages: ')
    pdf.add_screenshot_placeholder('Figure 6.1 - Products Management Page')
    
    pdf.add_subsection('Creating a Subscriber Package')
    pdf.add_step(1, 'Click "Add Subscriber Package" (blue button)')
    pdf.add_step(2, 'If you have multiple panels, select which panel to load packages from')
    pdf.add_step(3, 'Choose between Regular Packages or Trial Packages')
    pdf.add_step(4, 'Select a package from the panel dropdown (this auto-fills duration, connections, and bouquets)')
    pdf.add_step(5, 'Customize the Product Name and Description')
    pdf.add_step(6, 'Optionally add Setup Instructions for customers')
    pdf.add_step(7, 'Review and modify Bouquets (channel packages) if needed')
    pdf.add_step(8, 'Set your selling Price')
    pdf.add_step(9, 'Click "Create Product" to save')
    pdf.add_tip_box('The package selection from the panel is required. This ensures the product is properly mapped to the panel\'s configuration for automated provisioning.', 'important')
    
    pdf.add_subsection('Creating a Reseller Package')
    pdf.add_step(1, 'Click "Add Reseller Package" (purple button)')
    pdf.add_step(2, 'Enter the Package Name and Description')
    pdf.add_step(3, 'Set the Reseller Credits amount')
    pdf.add_step(4, 'Select the Panel (XtreamUI or XuiOne)')
    pdf.add_step(5, 'Enter the Panel URL for Customers (the URL they will use to access their reseller panel)')
    pdf.add_step(6, 'Set the Price (one-time, lifetime access)')
    pdf.add_step(7, 'Click "Create Package" to save')
    
    pdf.add_subsection('Editing Products')
    pdf.add_paragraph('Click "Edit" on any product row to modify its details. You can change the name, description, pricing, bouquets, and active status. Note that the panel assignment cannot be changed after creation.')
    
    pdf.add_subsection('Reordering Products')
    pdf.add_paragraph('Use the up/down arrow buttons in the "Order" column to change the display order of products. This affects the order in which products appear to customers on the storefront. Use the "Fix Order" button to reorganize all products into sequential order within each panel.')
    
    pdf.add_subsection('Deleting Products')
    pdf.add_paragraph('Click "Delete" on a product row to remove it. A confirmation dialog will appear. Existing services linked to the product will not be affected, but no new orders can be placed for the deleted product.')

    # ============================================
    # SECTION 7: EMAIL MANAGEMENT
    # ============================================
    pdf.add_page()
    pdf.add_section('Email Management')
    
    pdf.add_subsection('Mass Email')
    pdf.add_paragraph('The Mass Email feature allows you to send emails to multiple customers at once. Access it via the sidebar: Email > Mass Email.')
    pdf.add_paragraph('Features include:')
    pdf.add_bullet('Send to all customers or filter by specific criteria')
    pdf.add_bullet('Rich text editor for composing email body')
    pdf.add_bullet('Preview emails before sending')
    pdf.add_bullet('Track send status and delivery')
    pdf.add_tip_box('Mass email requires SMTP to be configured in Settings > Email (SMTP). Without valid SMTP settings, emails will fail to send.', 'warning')
    
    pdf.add_subsection('Email Templates')
    pdf.add_paragraph('Manage reusable email templates for automated communications. Access via the sidebar: Email > Email Templates.')
    pdf.add_paragraph('Templates are used for automated system emails such as:')
    pdf.add_bullet('Welcome emails for new registrations')
    pdf.add_bullet('Order confirmation emails')
    pdf.add_bullet('Service provisioning notifications')
    pdf.add_bullet('Expiry warning emails')
    pdf.add_bullet('Password reset emails')

    # ============================================
    # SECTION 8: DOWNLOADS
    # ============================================
    pdf.add_section('Downloads Management')
    pdf.add_paragraph('The Downloads page allows you to manage files that are available for customers to download from their dashboard. Common uses include IPTV player apps, setup guides, and configuration files.')
    pdf.add_paragraph('You can upload new files, set titles and descriptions, and manage which files are visible to customers.')

    # ============================================
    # SECTION 9: COUPONS
    # ============================================
    pdf.add_section('Coupons Management')
    pdf.add_paragraph('Create and manage discount coupon codes that customers can apply during checkout.')
    pdf.add_paragraph('Coupon options include:')
    pdf.add_bullet('Fixed amount or percentage-based discounts')
    pdf.add_bullet('Usage limits (total uses or per-customer)')
    pdf.add_bullet('Expiration dates')
    pdf.add_bullet('Product-specific or global application')

    # ============================================
    # SECTION 10: REFUNDS
    # ============================================
    pdf.add_section('Refunds Management')
    pdf.add_paragraph('Process and manage refund requests from customers. The refund system allows you to review requests, approve or deny them, and track the refund status.')
    pdf.add_paragraph('Refund settings (processing rules, automatic refund policies) can be configured in Settings > Refunds.')

    # ============================================
    # SECTION 11: TICKETS
    # ============================================
    pdf.add_section('Support Tickets')
    pdf.add_paragraph('View and manage customer support tickets. The ticket system allows customers to submit support requests which admins can respond to and track.')
    pdf.add_paragraph('Ticket statuses include:')
    pdf.add_bullet('New ticket submissions', bold_prefix='Open: ')
    pdf.add_bullet('Tickets waiting for admin response', bold_prefix='Awaiting Reply: ')
    pdf.add_bullet('Tickets currently being investigated', bold_prefix='In Progress: ')
    pdf.add_bullet('Resolved tickets', bold_prefix='Closed: ')
    pdf.add_paragraph('Click on any ticket to view the full conversation thread and add replies.')

    # ============================================
    # SECTION 12: SYSTEM SETTINGS
    # ============================================
    pdf.add_page()
    pdf.add_section('System Settings')
    pdf.add_paragraph('The Settings page is the control center for configuring all aspects of your billing system. Access it from the sidebar by clicking "Settings". The settings are organized into multiple tabs on the left sidebar.')
    
    pdf.add_subsection('XtreamUI Panels')
    pdf.add_paragraph('Configure connections to your XtreamUI IPTV panels. For each panel, you need:')
    pdf.add_bullet('A friendly name for identification', bold_prefix='Panel Name: ')
    pdf.add_bullet('The full URL of the XtreamUI panel (e.g., http://panel.example.com:8080)', bold_prefix='Panel URL: ')
    pdf.add_bullet('Admin username and password for API access', bold_prefix='Credentials: ')
    pdf.add_paragraph('You can add multiple XtreamUI panels. Each panel can have its own products and user base. Use the "Test Connection" feature to verify connectivity before saving.')
    pdf.add_tip_box('Panel credentials must have admin-level access to create users, manage packages, and handle subscriptions.', 'important')
    
    pdf.add_subsection('XuiOne Panels')
    pdf.add_paragraph('Similar to XtreamUI, configure your XuiOne panel connections. XuiOne panels support subscriber management but have some differences:')
    pdf.add_bullet('Reseller creation via API is not supported for XuiOne')
    pdf.add_bullet('Line extension uses a different mechanism (edit_line with line_id lookup)')
    pdf.add_bullet('Packages and trials may have different structures')
    
    pdf.add_subsection('Branding')
    pdf.add_paragraph('Customize the look and feel of your customer-facing billing portal:')
    pdf.add_bullet('Upload your company logo')
    pdf.add_bullet('Set your business name and tagline')
    pdf.add_bullet('Configure color themes')
    pdf.add_bullet('Customize the homepage content')
    pdf.add_screenshot_placeholder('Figure 12.1 - Branding Settings')
    
    pdf.add_subsection('Payment Gateways')
    pdf.add_paragraph('Configure payment processing for customer orders. Supported gateways include:')
    pdf.add_bullet('Stripe - Credit/debit card processing')
    pdf.add_bullet('PayPal - PayPal account and card payments')
    pdf.add_bullet('Square - Point-of-sale and online payments')
    pdf.add_bullet('Manual/Bank Transfer - For offline payment confirmation')
    pdf.add_paragraph('For each gateway, enter your API keys and configure settings. You can enable multiple gateways simultaneously and set the display order for checkout.')
    pdf.add_tip_box('Always test payment gateways in sandbox/test mode before enabling live payments.', 'warning')
    
    pdf.add_subsection('Email (SMTP)')
    pdf.add_paragraph('Configure SMTP settings for sending transactional and marketing emails:')
    pdf.add_bullet('SMTP server host and port')
    pdf.add_bullet('Authentication credentials')
    pdf.add_bullet('Sender name and email address')
    pdf.add_bullet('TLS/SSL encryption settings')
    pdf.add_paragraph('Use the "Send Test Email" feature to verify your SMTP configuration is working correctly.')
    
    pdf.add_subsection('Credits & Referrals')
    pdf.add_paragraph('Configure the credit system and referral program:')
    pdf.add_bullet('Set the credit-to-currency conversion rate', bold_prefix='Credits: ')
    pdf.add_bullet('Enable/disable referral tracking and set referral reward amounts', bold_prefix='Referrals: ')
    pdf.add_paragraph('Customers can use credits as partial or full payment during checkout and earn credits by referring new customers.')
    
    pdf.add_subsection('Notifications')
    pdf.add_paragraph('Configure notification settings for admin alerts and customer communications. This includes Telegram bot integration for real-time notifications about new orders, support tickets, and system events.')
    
    pdf.add_subsection('Refund Settings')
    pdf.add_paragraph('Configure refund processing rules including automatic refund approval thresholds, refund window periods, and whether to automatically suspend services upon refund.')
    
    pdf.add_subsection('My Account')
    pdf.add_paragraph('Change your admin password. Enter your current password and new password (minimum 6 characters) to update your login credentials.')
    
    pdf.add_subsection('Two-Factor Authentication (2FA)')
    pdf.add_paragraph('Enable or disable 2FA for your admin account using Google Authenticator or any TOTP-compatible app.')
    pdf.add_step(1, 'Click "Enable 2FA" to generate a QR code')
    pdf.add_step(2, 'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)')
    pdf.add_step(3, 'Enter the 6-digit verification code to confirm setup')
    pdf.add_tip_box('Store your 2FA backup codes in a safe place. If you lose access to your authenticator app, you will need the backup codes to log in.', 'important')
    
    pdf.add_subsection('reCAPTCHA')
    pdf.add_paragraph('Configure Google reCAPTCHA v3 to protect login and registration forms from bots and automated attacks. Enter your Site Key and Secret Key from the Google reCAPTCHA admin console.')
    
    pdf.add_subsection('License')
    pdf.add_paragraph('View and manage your IPTV Billing license. This shows your current license status, licensed domain, and expiration date. Enter or update your license key here to keep your system activated.')
    
    pdf.add_subsection('Updates')
    pdf.add_paragraph('Check for and apply system updates. The Update Manager shows your current version, available updates, and provides a one-click update process. Always backup your system before applying updates.')
    
    pdf.add_subsection('Backups')
    pdf.add_paragraph('Create, manage, and restore system backups. The Backup Manager supports:')
    pdf.add_bullet('Full system backups (database + files)')
    pdf.add_bullet('Cloud storage integration (Google Drive, Dropbox, WebDAV)')
    pdf.add_bullet('Scheduled automatic backups')
    pdf.add_bullet('One-click restore from any backup point')
    pdf.add_tip_box('It is strongly recommended to schedule regular automatic backups and store them in cloud storage for disaster recovery.', 'important')

    # ============================================
    # SECTION 13: COMMON WORKFLOWS
    # ============================================
    pdf.add_page()
    pdf.add_section('Common Workflows')
    
    pdf.add_subsection('Setting Up a New Panel')
    pdf.add_step(1, 'Go to Settings > XtreamUI Panels (or XuiOne Panels)')
    pdf.add_step(2, 'Click "Add Panel" and enter the panel name, URL, and admin credentials')
    pdf.add_step(3, 'Test the connection to verify access')
    pdf.add_step(4, 'Save the panel configuration')
    pdf.add_step(5, 'Go to Products and create new subscriber/reseller packages linked to this panel')
    pdf.add_step(6, 'Go to Imported Users and click "Sync Users" to import existing users from the panel')
    
    pdf.add_subsection('Processing a New Order')
    pdf.add_step(1, 'Navigate to Orders from the sidebar')
    pdf.add_step(2, 'Filter by "Pending" status to see orders waiting for payment')
    pdf.add_step(3, 'Verify payment was received (check your payment gateway dashboard)')
    pdf.add_step(4, 'Click "Paid" on the order to confirm and auto-provision the service')
    pdf.add_step(5, 'The customer will receive their credentials via email (if SMTP is configured)')
    
    pdf.add_subsection('Manually Creating a Customer with Service')
    pdf.add_step(1, 'Go to Customers and click "Add Customer"')
    pdf.add_step(2, 'Enter the customer\'s details and create the account')
    pdf.add_step(3, 'Open the customer\'s details by clicking the eye icon')
    pdf.add_step(4, 'Click "Add Service" and select the product/package')
    pdf.add_step(5, 'The service will be provisioned automatically on the panel')
    
    pdf.add_subsection('Extending a User\'s Subscription')
    pdf.add_step(1, 'Go to Imported Users from the sidebar')
    pdf.add_step(2, 'Find the user (use search/filters if needed)')
    pdf.add_step(3, 'Click "Extend" on the user\'s row')
    pdf.add_step(4, 'Select a package to determine the extension period')
    pdf.add_step(5, 'Confirm the extension - it updates both the billing system and the panel')

    # ============================================
    # SECTION 14: TROUBLESHOOTING
    # ============================================
    pdf.add_page()
    pdf.add_section('Troubleshooting')
    
    pdf.add_subsection('Common Issues')
    
    pdf.add_paragraph('')  # spacer
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(55, 65, 81)
    pdf.cell(0, 8, 'Cannot log in to admin panel', new_x="LMARGIN", new_y="NEXT")
    pdf.add_bullet('Verify you are using the correct admin email and password')
    pdf.add_bullet('If 2FA is enabled, ensure your device clock is synchronized')
    pdf.add_bullet('Check if reCAPTCHA is blocking the login (temporarily disable in settings if needed)')
    pdf.add_bullet('Clear browser cache and cookies')
    
    pdf.ln(3)
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(0, 8, 'Panel sync fails or shows warnings', new_x="LMARGIN", new_y="NEXT")
    pdf.add_bullet('Verify the panel URL is correct and accessible from the server')
    pdf.add_bullet('Check that admin credentials for the panel are still valid')
    pdf.add_bullet('Ensure the panel is running and not under maintenance')
    pdf.add_bullet('Check server logs for detailed error messages')
    
    pdf.ln(3)
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(0, 8, 'User creation or extension fails', new_x="LMARGIN", new_y="NEXT")
    pdf.add_bullet('Verify the panel connection is working (test in Settings)')
    pdf.add_bullet('Ensure the selected package exists on the panel')
    pdf.add_bullet('For XuiOne: extension requires an active line - verify the user has one')
    pdf.add_bullet('For XtreamUI resellers: credit application is a separate step after creation')
    
    pdf.ln(3)
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(0, 8, 'Emails are not being sent', new_x="LMARGIN", new_y="NEXT")
    pdf.add_bullet('Go to Settings > Email (SMTP) and verify all settings')
    pdf.add_bullet('Use "Send Test Email" to verify connectivity')
    pdf.add_bullet('Check if your SMTP provider has rate limits or IP restrictions')
    pdf.add_bullet('Ensure the sender email domain has proper SPF/DKIM records')
    
    pdf.ln(3)
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(0, 8, 'Payment gateway not working', new_x="LMARGIN", new_y="NEXT")
    pdf.add_bullet('Verify API keys are correctly entered in Settings > Payment Gateways')
    pdf.add_bullet('Ensure you are using live keys for production (not test/sandbox keys)')
    pdf.add_bullet('Check the payment gateway\'s dashboard for error details')
    pdf.add_bullet('Verify your domain is whitelisted in the gateway settings')
    
    pdf.add_subsection('Getting Help')
    pdf.add_paragraph('If you encounter issues not covered in this guide:')
    pdf.add_bullet('Check the server backend logs for detailed error messages')
    pdf.add_bullet('Verify your license is active and valid for your domain')
    pdf.add_bullet('Ensure all system components (database, backend, frontend) are running')
    pdf.add_bullet('Contact support with your license key and detailed description of the issue')

    # ============================================
    # BUILD TABLE OF CONTENTS
    # ============================================
    pdf.build_toc()
    
    # ============================================
    # SAVE
    # ============================================
    output_path = '/app/backend/static/IPTV_Billing_Admin_User_Guide.pdf'
    os.makedirs('/app/backend/static', exist_ok=True)
    pdf.output(output_path)
    print(f'PDF generated successfully: {output_path}')
    print(f'Total pages: {pdf.page_no()}')
    print(f'TOC entries: {len(pdf.toc_entries)}')
    return output_path

if __name__ == '__main__':
    generate_guide()

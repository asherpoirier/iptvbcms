import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/store';
import { useBrandingStore } from './store/branding';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProductsPage from './pages/ProductsPage';
import CheckoutPage from './pages/CheckoutPage';
import DashboardPage from './pages/DashboardPage';
import ServicesPage from './pages/ServicesPage';
import OrdersPage from './pages/OrdersPage';
import InvoicesPage from './pages/InvoicesPage';
import ReferralDashboard from './pages/ReferralDashboard';
import LicenseActivationRequired from './pages/LicenseActivationRequired';
import EmailVerificationPage from './pages/EmailVerificationPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminCustomers from './pages/AdminCustomers';
import AdminOrders from './pages/AdminOrders';
import AdminProducts from './pages/AdminProducts';
import AdminSettings from './pages/AdminSettings';
import AdminTickets from './pages/AdminTickets';
import AdminMassEmail from './pages/AdminMassEmail';
import AdminEmailTemplates from './pages/AdminEmailTemplates';
import AdminCoupons from './pages/AdminCoupons';
import AdminRefunds from './pages/AdminRefunds';
import AdminDownloads from './pages/AdminDownloads';
import AdminImportedUsers from './pages/AdminImportedUsers';
import TicketsPage from './pages/TicketsPage';
import DownloadsPage from './pages/DownloadsPage';
import PayPalSuccessPage from './pages/PayPalSuccessPage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Protected Route Component
function ProtectedRoute({ children }) {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/login" />;
}

// Admin Route Component
function AdminRoute({ children }) {
  const { isAdmin } = useAuthStore();
  return isAdmin() ? children : <Navigate to="/dashboard" />;
}

// License Check Component
function LicenseCheck({ children }) {
  const [licensed, setLicensed] = React.useState(null);

  React.useEffect(() => {
    const checkLicense = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/license/status`);
        const data = await response.json();
        
        if (!data.licensed && licensed === true) {
          // License became invalid, force reload to show lock screen
          window.location.reload();
        }
        
        setLicensed(data.licensed);
      } catch (error) {
        setLicensed(false);
      }
    };
    
    checkLicense();
    
    // Check license every 30 seconds
    const interval = setInterval(checkLicense, 30000);
    
    return () => clearInterval(interval);
  }, [licensed]);

  if (licensed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white text-center">Checking license...</p>
        </div>
      </div>
    );
  }

  if (!licensed) {
    return <LicenseActivationRequired />;
  }

  return children;
}

function App() {
  const { fetchBranding } = useBrandingStore();

  React.useEffect(() => {
    const loadBranding = async () => {
      await fetchBranding();
    };
    loadBranding();
  }, [fetchBranding]);

  return (
    <QueryClientProvider client={queryClient}>
      <LicenseCheck>
        <Router>
          <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<EmailVerificationPage />} />
            <Route path="/products" element={<ProductsPage />} />
            
            {/* Protected routes */}
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/services"
              element={
                <ProtectedRoute>
                  <ServicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute>
                  <InvoicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <TicketsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/referrals"
              element={
                <ProtectedRoute>
                  <ReferralDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/downloads"
              element={
                <ProtectedRoute>
                  <DownloadsPage />
                </ProtectedRoute>
              }
            />
            
            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route path="/admin/imported-users" element={<ProtectedRoute><AdminRoute><AdminImportedUsers /></AdminRoute></ProtectedRoute>} />

            <Route
              path="/admin/customers"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminCustomers />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminOrders />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminProducts />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminSettings />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tickets"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminTickets />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/mass-email"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminMassEmail />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/email-templates"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminEmailTemplates />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/coupons"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminCoupons />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/refunds"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminRefunds />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/downloads"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminDownloads />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </Router>
      </LicenseCheck>
    </QueryClientProvider>
  );
}

export default App;

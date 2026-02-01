import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ordersAPI, servicesAPI } from '../api/api';
import { useCartStore, useAuthStore } from '../store/store';
import { ArrowLeft, ShoppingCart, Trash2, AlertCircle, CreditCard, Bitcoin, Copy, CheckCircle, Loader2, RefreshCw, Plus } from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import SquarePaymentForm from '../components/SquarePaymentForm';
import CheckoutCouponCredits from '../components/CheckoutCouponCredits';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, removeItem, clearCart, getTotal, updateItemAction } = useCartStore();
  const [error, setError] = React.useState('');
  const [paymentMethod, setPaymentMethod] = useState('manual');
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [pollingSessionId, setPollingSessionId] = useState(null);
  
  // Coupon and Credits state
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedCouponCode, setAppliedCouponCode] = useState(null);
  const [creditsUsed, setCreditsUsed] = useState(0);
  
  // Reseller credentials state
  const [resellerUsername, setResellerUsername] = useState('');
  const [resellerPassword, setResellerPassword] = useState('');
  
  // Blockonomics Bitcoin payment state
  const [btcPaymentData, setBtcPaymentData] = useState(null);
  const [btcPaymentStatus, setBtcPaymentStatus] = useState(null);
  const [btcPolling, setBtcPolling] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Check if cart has reseller products
  const hasResellerProduct = items.some(item => item.account_type === 'reseller');
  
  // Check if cart has subscriber products (for extend/create option)
  const hasSubscriberProduct = items.some(item => item.account_type === 'subscriber');

  // Fetch user's existing services to show extend option
  const { data: userServices } = useQuery({
    queryKey: ['user-services'],
    queryFn: async () => {
      const response = await servicesAPI.getAll();
      return response.data?.filter(s => s.account_type === 'subscriber' && !s.is_credit_addon) || [];
    },
    enabled: hasSubscriberProduct, // Only fetch if cart has subscriber products
  });

  // Fetch payment config (public endpoint)
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ['payment-config'],
    queryFn: async () => {
      try {
        const response = await axios.get(`${API_URL}/api/payment/config`);
        console.log('Payment config loaded:', response.data);
        return response.data;
      } catch (error) {
        console.error('Payment config fetch error:', error);
        throw error;
      }
    },
  });

  console.log('Payment config:', settings);

  const createOrderMutation = useMutation({
    mutationFn: (data) => ordersAPI.create(data),
    onSuccess: (response) => {
      const orderId = response.data.order_id;
      setCurrentOrderId(orderId);
      
      if (paymentMethod === 'manual') {
        clearCart();
        navigate('/orders');
        alert('Order placed successfully! Please wait for admin to confirm payment.');
      }
      // For PayPal, buttons will handle the flow
    },
    onError: (error) => {
      setError(error.response?.data?.detail || 'Failed to create order');
    },
  });

  const handleCheckout = () => {
    if (items.length === 0) {
      setError('Cart is empty');
      return;
    }

    setError('');
    
    // Validate reseller credentials if needed
    if (hasResellerProduct && (!resellerUsername || !resellerPassword)) {
      setError('Please set username and password for your reseller panel');
      return;
    }
    
    const finalTotal = Math.max(0, getTotal() - discountAmount - creditsUsed);
    
    createOrderMutation.mutate({
      items: items,
      total: getTotal(),
      coupon_code: appliedCouponCode,
      use_credits: creditsUsed,
      reseller_credentials: hasResellerProduct ? {
        username: resellerUsername,
        password: resellerPassword
      } : null
    });
    
    // If fully paid with credits and coupon, redirect to orders
    if (finalTotal === 0) {
      setTimeout(() => {
        clearCart();
        navigate('/orders');
        alert('Order completed! Paid with credits.');
      }, 1000);
    }
  };

  const createPayPalOrder = async () => {
    try {
      // Create order first if not exists
      if (!currentOrderId) {
        const orderData = { items: items, total: getTotal() };
        const orderResponse = await ordersAPI.create(orderData);
        const orderId = orderResponse.data.order_id;
        setCurrentOrderId(orderId);
        
        // Create PayPal payment
        const token = JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token;
        const paypalResponse = await axios.post(
          `${API_URL}/api/orders/${orderId}/pay/paypal`,
          { origin: window.location.origin },
          { headers: { Authorization: `Bearer ${token}` }}
        );
        
        console.log('PayPal response:', paypalResponse.data);
        return paypalResponse.data.order_id;  // Return EC-XXX token
      }
    } catch (error) {
      console.error('PayPal order creation error:', error);
      setError(`PayPal error: ${error.response?.data?.detail || error.message}`);
      throw error;
    }
  };

  const onPayPalApprove = async (data) => {
    try {
      console.log('PayPal approved:', data);
      console.log('Order ID:', currentOrderId);
      console.log('PayPal Order ID:', data.orderID);
      
      if (!currentOrderId) {
        throw new Error('No order ID found');
      }
      
      // Capture the order via backend
      const token = JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token;
      const response = await axios.post(
        `${API_URL}/api/orders/paypal/capture`,
        { 
          order_id: currentOrderId,
          paypal_order_id: data.orderID 
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      console.log('Capture response:', response.data);
      
      clearCart();
      alert('Payment successful! Your services are being provisioned.');
      navigate('/orders');
      return response.data;
    } catch (error) {
      console.error('PayPal approval error:', error);
      setError(`Payment processing failed: ${error.response?.data?.detail || error.message}`);
      throw error;
    }
  };

  const handleStripePay = async () => {
    try {
      console.log('Starting Stripe payment...');
      
      // Create order first
      const orderData = { items: items, total: getTotal() };
      const orderResponse = await ordersAPI.create(orderData);
      const orderId = orderResponse.data.order_id;
      setCurrentOrderId(orderId);
      console.log('Order created:', orderId);
      
      // Create Stripe session
      const token = JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token;
      console.log('Creating Stripe session...');
      
      const stripeResponse = await axios.post(
        `${API_URL}/api/orders/${orderId}/pay/stripe`,
        { origin: window.location.origin },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      console.log('Stripe response:', stripeResponse.data);
      
      if (stripeResponse.data.success && stripeResponse.data.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = stripeResponse.data.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Stripe payment error:', error);
      setError(`Stripe payment failed: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleSquarePay = () => {
    // Square form will handle payment
    if (!currentOrderId) {
      // Create order first
      const orderData = { items: items, total: getTotal() };
      createOrderMutation.mutate(orderData);
    }
  };

  const handleSquareSuccess = (paymentId) => {
    console.log('Square payment successful:', paymentId);
    clearCart();
    alert('Payment successful! Your services are being provisioned.');
    navigate('/orders');
  };

  const handleSquareError = (error) => {
    console.error('Square payment error:', error);
    setError(`Square payment failed: ${error}`);
  };

  // Blockonomics Bitcoin Payment Handlers
  const handleBlockonomicsPay = async () => {
    try {
      setError('');
      console.log('Starting Blockonomics Bitcoin payment...');
      
      // Create order first
      const orderData = { items: items, total: getTotal() };
      const orderResponse = await ordersAPI.create(orderData);
      const orderId = orderResponse.data.order_id;
      setCurrentOrderId(orderId);
      console.log('Order created:', orderId);
      
      // Create Blockonomics payment
      const token = JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token;
      const btcResponse = await axios.post(
        `${API_URL}/api/orders/${orderId}/pay/blockonomics`,
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      console.log('Blockonomics response:', btcResponse.data);
      
      if (btcResponse.data.success) {
        setBtcPaymentData(btcResponse.data);
        setBtcPolling(true);
        // Start polling for payment status
        pollBlockonomicsStatus(orderId);
      } else {
        throw new Error(btcResponse.data.error || 'Failed to create Bitcoin payment');
      }
    } catch (error) {
      console.error('Blockonomics payment error:', error);
      setError(`Bitcoin payment failed: ${error.response?.data?.detail || error.message}`);
    }
  };

  const pollBlockonomicsStatus = async (orderId, attempt = 0) => {
    if (attempt >= 60) { // Poll for up to 10 minutes (60 attempts * 10 seconds)
      console.log('Bitcoin payment polling timeout');
      setBtcPolling(false);
      return;
    }
    
    try {
      const token = JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token;
      const response = await axios.get(
        `${API_URL}/api/payments/blockonomics/status/${orderId}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      console.log('BTC payment status:', response.data);
      setBtcPaymentStatus(response.data);
      
      if (response.data.payment_status === 'confirmed') {
        setBtcPolling(false);
        clearCart();
        alert('Bitcoin payment confirmed! Your services are being provisioned.');
        navigate('/orders');
      } else if (response.data.payment_status === 'unconfirmed') {
        // Payment received but waiting for confirmations
        setTimeout(() => pollBlockonomicsStatus(orderId, attempt + 1), 10000);
      } else {
        // Still pending
        setTimeout(() => pollBlockonomicsStatus(orderId, attempt + 1), 10000);
      }
    } catch (error) {
      console.error('BTC status check error:', error);
      setTimeout(() => pollBlockonomicsStatus(orderId, attempt + 1), 10000);
    }
  };

  const copyBtcAddress = () => {
    if (btcPaymentData?.btc_address) {
      navigator.clipboard.writeText(btcPaymentData.btc_address);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  // Poll for payment status if returning from Stripe
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const orderId = urlParams.get('order_id');
    const paymentStatus = urlParams.get('payment');
    
    console.log('Checking URL params:', { sessionId, orderId, paymentStatus });
    
    if (paymentStatus === 'success' && sessionId && !pollingSessionId) {
      setPollingSessionId(sessionId);
      if (orderId) {
        setCurrentOrderId(orderId);
      }
      console.log('Starting payment status polling for session:', sessionId, 'order:', orderId);
      pollPaymentStatus(sessionId, orderId);
    }
  }, [pollingSessionId]);

  const pollPaymentStatus = async (sessionId, orderId, attempt = 0) => {
    console.log(`Polling payment status (attempt ${attempt + 1})...`);
    
    if (attempt >= 5) {
      console.log('Max polling attempts reached');
      // Even if polling times out, redirect to orders page
      alert('Payment processing. Please check your orders page for status.');
      navigate('/orders');
      return;
    }
    
    try {
      const token = JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token;
      const response = await axios.get(
        `${API_URL}/api/payments/stripe/status/${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      console.log('Payment status response:', response.data);
      
      if (response.data.success && response.data.payment_status === 'paid') {
        clearCart();
        alert('Payment successful! Your services are being provisioned.');
        navigate('/orders');
      } else if (attempt < 4) {
        console.log('Payment not confirmed yet, retrying...');
        setTimeout(() => pollPaymentStatus(sessionId, orderId, attempt + 1), 2000);
      } else {
        console.log('Payment not confirmed after 5 attempts');
        alert('Payment status unclear. Please check your orders page.');
        navigate('/orders');
      }
    } catch (error) {
      console.error('Payment status check error:', error);
      if (attempt < 4) {
        setTimeout(() => pollPaymentStatus(sessionId, orderId, attempt + 1), 2000);
      } else {
        alert('Unable to verify payment. Please check your orders page.');
        navigate('/orders');
      }
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
        <header className="bg-white dark:bg-gray-900 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
              <ArrowLeft className="w-5 h-5" />
              Continue Shopping
            </Link>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Your cart is empty</h3>
            <p className="text-gray-600 mb-6">Add some products to get started</p>
            <Link to="/" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
              Browse Products
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
            <ArrowLeft className="w-5 h-5" />
            Continue Shopping
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900">Order Items</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {items.map((item, index) => (
                  <div key={index} className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{item.product_name}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {item.term_months} {item.term_months === 1 ? 'Month' : 'Months'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {item.account_type === 'subscriber' ? 'Subscriber' : 'Reseller'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xl font-bold text-gray-900">${item.price.toFixed(2)}</span>
                        <button
                          onClick={() => removeItem(item.product_id, item.term_months)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`remove-item-${index}`}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Extend/Create Option for Subscriber Products */}
                    {item.account_type === 'subscriber' && userServices && userServices.length > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">
                          What would you like to do?
                        </p>
                        <div className="space-y-2">
                          {/* Option to create new line */}
                          <label className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-2 border-transparent has-[:checked]:border-blue-500">
                            <input
                              type="radio"
                              name={`action-${index}`}
                              checked={!item.action_type || item.action_type === 'create_new'}
                              onChange={() => updateItemAction(item.product_id, item.term_months, 'create_new', null)}
                              className="w-4 h-4 text-blue-600"
                              data-testid={`create-new-${index}`}
                            />
                            <Plus className="w-5 h-5 text-green-600" />
                            <div>
                              <span className="font-medium text-gray-900 dark:text-white">Create New Line</span>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Get a new subscriber account</p>
                            </div>
                          </label>
                          
                          <p className="text-xs text-blue-700 dark:text-blue-300 px-2">Or extend one of your existing services:</p>
                          
                          {userServices.map((service) => (
                            <label 
                              key={service.id} 
                              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-2 border-transparent has-[:checked]:border-blue-500"
                            >
                              <input
                                type="radio"
                                name={`action-${index}`}
                                checked={item.action_type === 'extend' && item.renewal_service_id === service.id}
                                onChange={() => updateItemAction(item.product_id, item.term_months, 'extend', service.id)}
                                className="w-4 h-4 text-blue-600"
                                data-testid={`extend-${service.id}-${index}`}
                              />
                              <RefreshCw className="w-5 h-5 text-blue-600" />
                              <div className="flex-1">
                                <span className="font-medium text-gray-900 dark:text-white">Extend: {service.xtream_username}</span>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Expires: {service.expiry_date ? new Date(service.expiry_date).toLocaleDateString() : 'N/A'}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div>
            {/* Coupon & Credits Section */}
            <div className="mb-6">
              <CheckoutCouponCredits
                subtotal={getTotal()}
                onDiscountChange={(discount, code) => {
                  setDiscountAmount(discount);
                  setAppliedCouponCode(code);
                }}
                onCreditsChange={(amount) => {
                  setCreditsUsed(amount);
                }}
              />
            </div>

            {/* Reseller Panel Credentials */}
            {hasResellerProduct && (
              <div className="mb-6 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <h3 className="font-bold text-purple-900 dark:text-purple-200 text-lg">
                    Reseller Panel Credentials
                  </h3>
                </div>
                
                <p className="text-sm text-purple-800 dark:text-purple-300 mb-4">
                  Choose your username and password for your XtreamUI reseller panel. These will be your login credentials.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-900 dark:text-purple-200 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      required={hasResellerProduct}
                      value={resellerUsername}
                      onChange={(e) => setResellerUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full px-4 py-2 border-2 border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500"
                      placeholder="myreselleraccount"
                      maxLength="20"
                    />
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      Lowercase letters, numbers, and underscores only (max 20 chars)
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-900 dark:text-purple-200 mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      required={hasResellerProduct}
                      value={resellerPassword}
                      onChange={(e) => setResellerPassword(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-purple-300 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500"
                      placeholder="Choose a secure password"
                      minLength="8"
                    />
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      Minimum 8 characters
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 rounded-lg shadow sticky top-4">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Order Summary</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Subtotal</span>
                  <span className="font-semibold text-gray-900 dark:text-white">${getTotal().toFixed(2)}</span>
                </div>
                
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({appliedCouponCode})</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                
                {creditsUsed > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Credits Applied</span>
                    <span>-${creditsUsed.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-lg font-bold border-t pt-4">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-blue-600">${Math.max(0, getTotal() - discountAmount - creditsUsed).toFixed(2)}</span>
                </div>
              </div>

              {error && (
                <div className="px-6 pb-4">
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                </div>
              )}

              {/* Payment Method Selection */}
              <div className="px-6 pb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Method</h3>
                
                <div className="space-y-3 mb-6">
                  {/* Render payment methods in order from settings */}
                  {(settings?.payment_method_order || ['manual', 'stripe', 'paypal', 'square', 'blockonomics']).map((method) => {
                    // Manual Payment
                    if (method === 'manual') {
                      return (
                        <label key="manual" className="flex items-center p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 transition bg-white dark:bg-gray-800">
                          <input
                            type="radio"
                            name="payment"
                            value="manual"
                            checked={paymentMethod === 'manual'}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <div className="ml-3">
                            <p className="font-semibold text-gray-900 dark:text-white">Manual Payment</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Admin will confirm your payment</p>
                          </div>
                        </label>
                      );
                    }
                    
                    // Stripe
                    if (method === 'stripe' && settings?.stripe?.enabled) {
                      return (
                        <label key="stripe" className="flex items-center p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 transition bg-white dark:bg-gray-800">
                          <input
                            type="radio"
                            name="payment"
                            value="stripe"
                            checked={paymentMethod === 'stripe'}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-4 h-4 text-purple-600"
                          />
                          <div className="ml-3 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-purple-600" />
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">Stripe</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {settings?.stripe?.crypto_enabled ? 'Cards, Bitcoin, USDC, ETH' : 'Pay with card'}
                              </p>
                            </div>
                          </div>
                        </label>
                      );
                    }
                    
                    // PayPal
                    if (method === 'paypal' && settings?.paypal?.enabled) {
                      return (
                        <label key="paypal" className="flex items-center p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 transition bg-white dark:bg-gray-800">
                          <input
                            type="radio"
                            name="payment"
                            value="paypal"
                            checked={paymentMethod === 'paypal'}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <div className="ml-3 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">PayPal</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Pay securely with PayPal</p>
                            </div>
                          </div>
                        </label>
                      );
                    }
                    
                    // Square
                    if (method === 'square' && settings?.square?.enabled) {
                      return (
                        <label key="square" className="flex items-center p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-indigo-500 transition bg-white dark:bg-gray-800">
                          <input
                            type="radio"
                            name="payment"
                            value="square"
                            checked={paymentMethod === 'square'}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-4 h-4 text-indigo-600"
                          />
                          <div className="ml-3 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-indigo-600" />
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">Square</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Pay with card, Apple Pay, Google Pay</p>
                            </div>
                          </div>
                        </label>
                      );
                    }
                    
                    // Blockonomics (Bitcoin)
                    if (method === 'blockonomics' && settings?.blockonomics?.enabled) {
                      return (
                        <label key="blockonomics" className="flex items-center p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-orange-500 transition bg-white dark:bg-gray-800">
                          <input
                            type="radio"
                            name="payment"
                            value="blockonomics"
                            checked={paymentMethod === 'blockonomics'}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-4 h-4 text-orange-500"
                          />
                          <div className="ml-3 flex items-center gap-2">
                            <Bitcoin className="w-5 h-5 text-orange-500" />
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">Bitcoin</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Pay directly with Bitcoin (BTC)</p>
                            </div>
                          </div>
                        </label>
                      );
                    }
                    
                    return null;
                  })}
                </div>

                {/* Payment Button/PayPal/Stripe/Square */}
                {paymentMethod === 'manual' ? (
                  <div>
                    <button
                      onClick={handleCheckout}
                      disabled={createOrderMutation.isPending}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {createOrderMutation.isPending ? 'Processing...' : 'Place Order'}
                    </button>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 text-center">
                      Your order will be pending until payment is confirmed by admin
                    </p>
                  </div>
                ) : paymentMethod === 'paypal' && settings?.paypal?.client_id ? (
                  <PayPalScriptProvider options={{ "client-id": settings.paypal.client_id, currency: "USD" }}>
                    <PayPalButtons
                      style={{ layout: "vertical", color: "blue" }}
                      createOrder={createPayPalOrder}
                      onApprove={onPayPalApprove}
                      onError={(err) => setError('PayPal payment failed')}
                    />
                  </PayPalScriptProvider>
                ) : paymentMethod === 'stripe' && settings?.stripe?.enabled ? (
                  <button
                    onClick={handleStripePay}
                    className="w-full bg-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-purple-700 flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-6 h-6" />
                    Pay with Bitcoin/Crypto/Card
                  </button>
                ) : paymentMethod === 'square' && settings?.square?.enabled ? (
                  currentOrderId ? (
                    <SquarePaymentForm
                      amount={getTotal()}
                      orderId={currentOrderId}
                      settings={settings.square}
                      onSuccess={handleSquareSuccess}
                      onError={handleSquareError}
                    />
                  ) : (
                    <button
                      onClick={handleSquarePay}
                      className="w-full bg-indigo-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700"
                    >
                      Continue with Square
                    </button>
                  )
                ) : paymentMethod === 'blockonomics' && settings?.blockonomics?.enabled ? (
                  btcPaymentData ? (
                    <div className="space-y-4">
                      {/* Bitcoin Payment Details */}
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Bitcoin className="w-5 h-5 text-orange-500" />
                          <span className="font-semibold text-orange-800 dark:text-orange-200">
                            Send Bitcoin to complete payment
                          </span>
                        </div>
                        
                        {/* QR Code */}
                        <div className="flex justify-center mb-4 p-4 bg-white rounded-lg">
                          <QRCodeSVG 
                            value={btcPaymentData.qr_data} 
                            size={180}
                            level="H"
                            includeMargin={true}
                          />
                        </div>
                        
                        {/* Amount */}
                        <div className="mb-4 text-center">
                          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {btcPaymentData.amount_btc?.toFixed(8)} BTC
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            ≈ ${btcPaymentData.amount_usd?.toFixed(2)} USD @ ${btcPaymentData.btc_price?.toLocaleString()}/BTC
                          </p>
                        </div>
                        
                        {/* Address */}
                        <div className="mb-4">
                          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Bitcoin Address</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={btcPaymentData.btc_address}
                              readOnly
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
                            />
                            <button
                              onClick={copyBtcAddress}
                              className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                              {copiedAddress ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
                            </button>
                          </div>
                        </div>
                        
                        {/* Payment Status */}
                        {btcPaymentStatus && (
                          <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Status:</span>
                              <span className={`font-semibold ${
                                btcPaymentStatus.payment_status === 'confirmed' ? 'text-green-600' :
                                btcPaymentStatus.payment_status === 'unconfirmed' ? 'text-yellow-600' :
                                'text-gray-600'
                              }`}>
                                {btcPaymentStatus.payment_status === 'confirmed' ? 'Confirmed!' :
                                 btcPaymentStatus.payment_status === 'unconfirmed' ? 'Received - Confirming...' :
                                 'Waiting for payment...'}
                              </span>
                            </div>
                            {btcPaymentStatus.confirmations > 0 && (
                              <div className="flex items-center justify-between text-sm mt-1">
                                <span className="text-gray-600 dark:text-gray-400">Confirmations:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {btcPaymentStatus.confirmations}/{btcPaymentStatus.confirmations_required}
                                </span>
                              </div>
                            )}
                            {btcPaymentStatus.amount_received_btc > 0 && (
                              <div className="flex items-center justify-between text-sm mt-1">
                                <span className="text-gray-600 dark:text-gray-400">Received:</span>
                                <span className="font-semibold text-green-600">
                                  {btcPaymentStatus.amount_received_btc?.toFixed(8)} BTC
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Polling indicator */}
                        {btcPolling && (
                          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Monitoring for payment...</span>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        Payment expires in {btcPaymentData.expires_in_minutes} minutes. Send exact amount to avoid delays.
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={handleBlockonomicsPay}
                      className="w-full bg-orange-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-orange-600 flex items-center justify-center gap-2"
                    >
                      <Bitcoin className="w-6 h-6" />
                      Pay with Bitcoin
                    </button>
                  )
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-600 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Selected payment method is not configured. Please use manual payment.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow mt-6 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Customer Information</h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600 dark:text-gray-300">Name: <span className="text-gray-900 font-medium">{user?.name}</span></p>
                <p className="text-gray-600 dark:text-gray-300">Email: <span className="text-gray-900 font-medium">{user?.email}</span></p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

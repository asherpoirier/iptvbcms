import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Check, Loader2, AlertCircle, CreditCard, Smartphone } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function LauncherPayPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');

  // Payment state
  const [paymentData, setPaymentData] = useState(null);
  const [initiating, setInitiating] = useState(false);
  const [cardForm, setCardForm] = useState({ card_number: '', expiry: '', cvc: '', cardholder_name: '' });
  const [processing, setProcessing] = useState(false);

  // Check if returning from 3DS redirect
  useEffect(() => {
    if (searchParams.get('status') === 'success') {
      setPaymentStatus('paid');
    }
  }, [searchParams]);

  // Fetch order details
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const resp = await axios.get(`${API_URL}/api/launcher/pay-info/${orderId}`);
        setOrder(resp.data);
        setPaymentStatus(resp.data.status);
        // Auto-initiate payment if still pending
        if (resp.data.status === 'pending' && !paymentData) {
          initiatePayment(resp.data.gateway);
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Order not found');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]); // eslint-disable-line

  // Poll for payment status
  useEffect(() => {
    if (paymentStatus !== 'pending' || !paymentData) return;

    // For GhostPay: poll the invoice status
    if (paymentData.gateway === 'ghostpay' && paymentData.invoice_id) {
      const interval = setInterval(async () => {
        try {
          const resp = await axios.get(`${API_URL}/api/launcher/pay/${orderId}/ghostpay-status/${paymentData.invoice_id}`);
          if (resp.data.status === 'paid') {
            setPaymentStatus('paid');
            clearInterval(interval);
          }
        } catch {}
      }, 4000);
      return () => clearInterval(interval);
    }

    // For other gateways: poll order status
    const interval = setInterval(async () => {
      try {
        const resp = await axios.get(`${API_URL}/api/launcher/pay-info/${orderId}`);
        if (resp.data.status !== 'pending') {
          setPaymentStatus(resp.data.status);
          setOrder(resp.data);
          clearInterval(interval);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [orderId, paymentStatus, paymentData]);

  const initiatePayment = useCallback(async (gw) => {
    if (initiating) return;
    setInitiating(true);
    try {
      const resp = await axios.post(`${API_URL}/api/launcher/pay/${orderId}/initiate`, { crypto: 'BTC' });
      setPaymentData(resp.data);
    } catch (err) {
      if (err.response?.data?.status !== 'already_paid') {
        setError(err.response?.data?.detail || 'Failed to initiate payment');
      } else {
        setPaymentStatus('paid');
      }
    } finally {
      setInitiating(false);
    }
  }, [orderId, initiating]);

  const handleCardPay = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setError('');
    try {
      const resp = await axios.post(`${API_URL}/api/launcher/pay/${orderId}/tagadapay-charge`, cardForm);
      if (resp.data.requires_redirect) {
        window.location.href = resp.data.redirect_url;
        return;
      }
      if (resp.data.success || resp.data.status === 'paid') {
        setPaymentStatus('paid');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (paymentStatus === 'paid' || paymentStatus === 'provisioned') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full text-center border border-green-800">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Payment Complete</h1>
          <p className="text-gray-400 mb-6">Your service is being activated. You can close this window.</p>
          <div className="bg-gray-800 rounded-xl p-4 text-left space-y-2">
            <p className="text-sm text-gray-500">Package</p>
            <p className="text-lg font-semibold text-white">{order?.package}</p>
          </div>
        </div>
      </div>
    );
  }

  // Pending payment — show gateway-specific UI
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-lg w-full border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
          <h1 className="text-xl font-bold text-white">{order?.package || 'Package'}</h1>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold text-white">${order?.amount?.toFixed(2)}</span>
            <span className="text-blue-200 text-sm">{order?.currency}</span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {initiating && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-gray-400">Preparing payment...</p>
            </div>
          )}

          {/* GhostPay: Show QR + wallet */}
          {paymentData?.gateway === 'ghostpay' && (
            <div className="space-y-4 text-center">
              <div className="bg-gray-800 rounded-xl p-6">
                <Smartphone className="w-10 h-10 text-orange-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Send {paymentData.amount_crypto} {paymentData.crypto}</p>
                <p className="text-gray-400 text-sm mb-4">to the address below</p>
                <div className="bg-gray-950 rounded-lg p-3 break-all">
                  <code className="text-xs text-green-400 select-all">{paymentData.wallet}</code>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(paymentData.wallet)}
                  className="mt-3 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
                >
                  Copy Address
                </button>
              </div>
              {paymentData.payment_url && (
                <a href={paymentData.payment_url} target="_blank" rel="noopener noreferrer"
                  className="block w-full py-3 bg-orange-600 text-white rounded-xl font-semibold text-center hover:bg-orange-700">
                  Open Payment Page
                </a>
              )}
              <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for payment confirmation...
              </div>
            </div>
          )}

          {/* TagadaPay: Show card form */}
          {paymentData?.gateway === 'tagadapay' && paymentData?.requires_card && (
            <form onSubmit={handleCardPay} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-teal-400" />
                <span className="text-white font-medium">Card Payment</span>
              </div>
              <input
                type="text" placeholder="Card Number" value={cardForm.card_number}
                onChange={(e) => setCardForm({ ...cardForm, card_number: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-lg tracking-wider focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                required autoComplete="cc-number" inputMode="numeric" data-testid="launcher-card-number"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text" placeholder="MM/YY" value={cardForm.expiry}
                  onChange={(e) => setCardForm({ ...cardForm, expiry: e.target.value })}
                  className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  required autoComplete="cc-exp" data-testid="launcher-card-expiry"
                />
                <input
                  type="text" placeholder="CVC" value={cardForm.cvc}
                  onChange={(e) => setCardForm({ ...cardForm, cvc: e.target.value })}
                  className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                  required autoComplete="cc-csc" inputMode="numeric" data-testid="launcher-card-cvc"
                />
              </div>
              <input
                type="text" placeholder="Cardholder Name" value={cardForm.cardholder_name}
                onChange={(e) => setCardForm({ ...cardForm, cardholder_name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                autoComplete="cc-name" data-testid="launcher-card-name"
              />
              <button
                type="submit" disabled={processing}
                className="w-full py-4 bg-teal-600 text-white rounded-xl font-bold text-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="launcher-pay-btn"
              >
                {processing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                ) : (
                  <><CreditCard className="w-5 h-5" /> Pay ${order?.amount?.toFixed(2)}</>
                )}
              </button>
            </form>
          )}

          {/* Order info footer */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Order</span>
              <span className="text-gray-400 font-mono text-xs">{orderId?.slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Gateway</span>
              <span className="text-gray-300">{order?.gateway || paymentData?.gateway}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

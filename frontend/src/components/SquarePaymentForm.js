import React from 'react';
import { PaymentForm, CreditCard } from 'react-square-web-payments-sdk';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function SquarePaymentForm({ amount, orderId, settings, onSuccess, onError }) {
  const handlePaymentToken = async (token) => {
    try {
      console.log('Square token received:', token);
      
      // Send token to backend for payment processing
      const authToken = JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token;
      const response = await axios.post(
        `${API_URL}/api/orders/${orderId}/pay/square`,
        { source_id: token.token },
        { headers: { Authorization: `Bearer ${authToken}` }}
      );
      
      console.log('Square payment response:', response.data);
      
      if (response.data.success) {
        onSuccess(response.data.payment_id);
      } else {
        onError(response.data.error || 'Payment failed');
      }
    } catch (error) {
      console.error('Square payment error:', error);
      onError(error.response?.data?.detail || error.message);
    }
  };

  if (!settings?.application_id || !settings?.location_id) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-600 rounded-lg p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Square is not fully configured. Please complete setup in Payment Gateway settings.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Pay ${amount.toFixed(2)} with Square
      </h3>
      
      <PaymentForm
        applicationId={settings.application_id}
        locationId={settings.location_id}
        cardTokenizeResponseReceived={handlePaymentToken}
        createPaymentRequest={() => ({
          countryCode: 'US',
          currencyCode: 'USD',
          total: {
            amount: amount.toString(),
            label: 'Total',
          },
        })}
      >
        <CreditCard />
      </PaymentForm>
      
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
        Secured by Square - Your card information is never stored on our servers
      </p>
    </div>
  );
}

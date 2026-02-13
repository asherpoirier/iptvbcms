import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import { Mail, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function LinkEmailPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user?.needs_email_link) {
    navigate('/dashboard');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/auth/link-email`, { email }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSent(true);
      toast.success('Verification email sent!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to link email');
    }
    setSubmitting(false);
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Link Your Email</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Welcome, <strong>{user?.name || user?.panel_username}</strong>! Please link an email address to your account for notifications and password recovery.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200 font-medium">
                Verification email sent to <strong>{email}</strong>
              </p>
              <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                Please check your inbox and click the verification link.
              </p>
            </div>
            <button onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
              Continue to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? 'Sending...' : <><ArrowRight className="w-5 h-5" /> Link Email & Verify</>}
            </button>
            <button type="button" onClick={handleSkip}
              className="w-full py-2 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700">
              Skip for now
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

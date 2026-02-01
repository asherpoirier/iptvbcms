import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft, DollarSign, Check, X, FileText } from 'lucide-react';

export default function AdminRefunds() {
  const queryClient = useQueryClient();

  const { data: refunds, isLoading } = useQuery({
    queryKey: ['pending-refunds'],
    queryFn: async () => {
      const response = await adminAPI.getPendingRefunds();
      return response.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }) => adminAPI.approveRefund(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-refunds']);
      alert('Refund approved and processed');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }) => adminAPI.rejectRefund(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-refunds']);
      alert('Refund rejected');
    },
  });

  const handleApprove = (refund) => {
    const notes = prompt('Add any notes (optional):');
    if (window.confirm(`Approve $${refund.amount} refund for ${refund.user_email}?`)) {
      approveMutation.mutate({ id: refund.id, notes: notes || '' });
    }
  };

  const handleReject = (refund) => {
    const notes = prompt('Reason for rejection (optional):');
    if (window.confirm(`Reject refund request from ${refund.user_email}?`)) {
      rejectMutation.mutate({ id: refund.id, notes: notes || '' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/admin" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600">
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Refund Requests</h1>
          <p className="text-gray-600 dark:text-gray-400">Review and process customer refund requests</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : refunds && refunds.length > 0 ? (
          <div className="space-y-4">
            {refunds.map((refund) => (
              <div key={refund.id} className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <DollarSign className="w-6 h-6 text-blue-600" />
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          ${refund.amount.toFixed(2)} Refund Request
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {refund.user_name} ({refund.user_email})
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Order ID</p>
                        <p className="text-sm font-mono text-gray-900 dark:text-white">#{refund.order_id.substring(0, 8)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Order Total</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">${refund.order_total?.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Refund Type</p>
                        <p className="text-sm text-gray-900 dark:text-white capitalize">{refund.refund_type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Refund Method</p>
                        <p className="text-sm text-gray-900 dark:text-white capitalize">{refund.method}</p>
                      </div>
                    </div>

                    {refund.reason && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reason</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                          {refund.reason}
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Requested: {new Date(refund.requested_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleApprove(refund)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      data-testid={`approve-refund-${refund.id}`}
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(refund)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      data-testid={`reject-refund-${refund.id}`}
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Pending Refunds</h3>
            <p className="text-gray-600 dark:text-gray-400">All refund requests have been processed</p>
          </div>
        )}
      </main>
    </div>
  );
}

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft, DollarSign, Check, X, FileText, Eye, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export default function AdminRefunds() {
  const queryClient = useQueryClient();
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

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
      alert('Refund approved and service cancelled');
      setShowDetailsModal(false);
    },
    onError: (error) => {
      alert('Failed to approve refund: ' + (error.response?.data?.detail || error.message));
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }) => adminAPI.rejectRefund(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-refunds']);
      alert('Refund rejected');
      setShowDetailsModal(false);
    },
    onError: (error) => {
      alert('Failed to reject refund: ' + (error.response?.data?.detail || error.message));
    }
  });

  // Filter and paginate
  const filteredRefunds = React.useMemo(() => {
    if (!refunds) return [];
    
    let filtered = refunds;
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.user_name?.toLowerCase().includes(query) ||
        r.user_email?.toLowerCase().includes(query) ||
        r.order_id?.toLowerCase().includes(query) ||
        r.reason?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [refunds, statusFilter, searchQuery]);
  
  const totalPages = Math.ceil(filteredRefunds.length / itemsPerPage);
  const paginatedRefunds = filteredRefunds.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleViewDetails = (refund) => {
    setSelectedRefund(refund);
    setShowDetailsModal(true);
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

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by customer, email, order ID, or reason..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
          
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredRefunds.length} of {refunds?.length || 0} refunds
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : paginatedRefunds && paginatedRefunds.length > 0 ? (
          <>
            {/* Refunds List */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedRefunds.map((refund) => (
                    <tr key={refund.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {refund.user_name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {refund.user_email || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          ${refund.amount?.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {refund.refund_type || 'full'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(refund.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(refund)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4" />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRefunds.length)} of {filteredRefunds.length} refunds
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
            <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Pending Refunds</h3>
            <p className="text-gray-600 dark:text-gray-400">All caught up! No refund requests to review.</p>
          </div>
        )}
      </main>

      {/* Refund Details Modal */}
      {showDetailsModal && selectedRefund && (
        <RefundDetailsModal
          refund={selectedRefund}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedRefund(null);
          }}
          onApprove={(notes) => approveMutation.mutate({ id: selectedRefund.id, notes })}
          onReject={(notes) => rejectMutation.mutate({ id: selectedRefund.id, notes })}
          isApproving={approveMutation.isLoading}
          isRejecting={rejectMutation.isLoading}
        />
      )}
    </div>
  );
}

// Refund Details Modal Component
function RefundDetailsModal({ refund, onClose, onApprove, onReject, isApproving, isRejecting }) {
  const [notes, setNotes] = useState('');

  const handleApprove = () => {
    if (window.confirm(`Approve $${refund.amount?.toFixed(2)} refund for ${refund.user_name}?\n\nThe associated service will be cancelled immediately.`)) {
      onApprove(notes);
    }
  };

  const handleReject = () => {
    if (!notes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    if (window.confirm(`Reject refund request from ${refund.user_name}?`)) {
      onReject(notes);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Refund Request Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Customer Information</h3>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-blue-700 dark:text-blue-300">Name:</span>
                <span className="ml-2 font-medium text-blue-900 dark:text-blue-100">{refund.user_name || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">Email:</span>
                <span className="ml-2 font-medium text-blue-900 dark:text-blue-100">{refund.user_email || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Refund Details */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Refund Amount</label>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                ${refund.amount?.toFixed(2)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order Total</label>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                ${refund.order_total?.toFixed(2)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Order ID</label>
              <code className="block bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-sm font-mono text-gray-900 dark:text-white">
                {refund.order_id}
              </code>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Refund Type</label>
              <div className="text-sm text-gray-900 dark:text-white capitalize">
                {refund.refund_type || 'full'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Refund Method</label>
              <div className="text-sm text-gray-900 dark:text-white capitalize">
                {refund.method || 'credit'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Requested Date</label>
              <div className="text-sm text-gray-900 dark:text-white">
                {new Date(refund.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Customer Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer's Reason</label>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                {refund.reason || 'No reason provided'}
              </p>
            </div>
          </div>

          {/* Admin Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Admin Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes or reason for decision..."
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>⚠️ Warning:</strong> Approving this refund will:
              <ul className="list-disc list-inside mt-2">
                <li>Issue ${refund.amount?.toFixed(2)} credit to customer</li>
                <li>Cancel the associated service immediately</li>
                <li>Mark the service as "refunded" in customer's account</li>
              </ul>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReject}
              disabled={isRejecting || isApproving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50"
            >
              <X className="w-5 h-5" />
              {isRejecting ? 'Rejecting...' : 'Reject Refund'}
            </button>
            <button
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
              {isApproving ? 'Approving...' : 'Approve Refund'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft, MessageSquare, X, Send, Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const TICKETS_PER_PAGE = 15;
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function AdminTickets() {
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: async () => {
      const response = await adminAPI.getTickets();
      return response.data;
    },
  });

  // Filter, sort, and paginate
  const { paginatedTickets, totalPages, totalFiltered } = useMemo(() => {
    let filtered = tickets || [];
    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.subject.toLowerCase().includes(q) ||
        (t.customer_name || '').toLowerCase().includes(q) ||
        (t.customer_email || '').toLowerCase().includes(q)
      );
    }
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return new Date(a.created_at) - new Date(b.created_at);
        case 'priority_high': return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        case 'priority_low': return (PRIORITY_ORDER[b.priority] ?? 3) - (PRIORITY_ORDER[a.priority] ?? 3);
        case 'date_desc': default: return new Date(b.created_at) - new Date(a.created_at);
      }
    });
    const pages = Math.max(1, Math.ceil(sorted.length / TICKETS_PER_PAGE));
    const start = (currentPage - 1) * TICKETS_PER_PAGE;
    return { paginatedTickets: sorted.slice(start, start + TICKETS_PER_PAGE), totalPages: pages, totalFiltered: sorted.length };
  }, [tickets, searchTerm, statusFilter, priorityFilter, sortBy, currentPage]);

  const handleFilterChange = (setter) => (value) => { setter(value); setCurrentPage(1); };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'closed':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Support Tickets</h1>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {totalFiltered} ticket{totalFiltered !== 1 ? 's' : ''}
            {(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all') && ` (of ${tickets?.length || 0})`}
          </span>
        </div>

        {/* Search + Filters + Sort */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search subject, name, email..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => handleFilterChange(setPriorityFilter)(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Priority</option>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
            {/* Sort */}
            <div className="flex items-center gap-2 ml-auto">
              <ArrowUpDown className="w-4 h-4 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="priority_high">Priority: High → Low</option>
                <option value="priority_low">Priority: Low → High</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : totalFiltered === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {tickets?.length === 0 ? 'No tickets yet' : 'No tickets match your filters'}
            </h3>
            {(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all') && (
              <button
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); setPriorityFilter('all'); setCurrentPage(1); }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {ticket.subject}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        From: {ticket.customer_name} ({ticket.customer_email})
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(ticket.created_at).toLocaleDateString()} at {new Date(ticket.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {ticket.messages[0]?.message.substring(0, 150)}...
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {ticket.messages.length} {ticket.messages.length === 1 ? 'message' : 'messages'}
                  </p>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 bg-white dark:bg-gray-900 rounded-lg shadow px-4 py-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">Page {currentPage} of {totalPages}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) { page = i + 1; }
                    else if (currentPage <= 3) { page = i + 1; }
                    else if (currentPage >= totalPages - 2) { page = totalPages - 4 + i; }
                    else { page = currentPage - 2 + i; }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-sm rounded-lg border ${
                          page === currentPage
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* View/Reply Ticket Modal */}
      {selectedTicket && (
        <AdminTicketModal
          ticket={selectedTicket}
          onClose={() => {
            setSelectedTicket(null);
            queryClient.invalidateQueries(['admin-tickets']);
          }}
        />
      )}
    </div>
  );
}

function AdminTicketModal({ ticket, onClose }) {
  const queryClient = useQueryClient();
  const [replyMessage, setReplyMessage] = useState('');
  const [newStatus, setNewStatus] = useState(ticket.status);

  const replyMutation = useMutation({
    mutationFn: (data) => adminAPI.replyToTicket(ticket.id, data),
    onSuccess: () => {
      toast.success('Reply sent successfully!');
      setReplyMessage('');
      queryClient.invalidateQueries(['admin-tickets']);
    },
  });

  const handleReply = () => {
    if (!replyMessage.trim()) return;
    replyMutation.mutate({
      message: replyMessage,
      status: newStatus,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{ticket.subject}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                From: {ticket.customer_name} ({ticket.customer_email})
              </p>
              <div className="flex gap-2 mt-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  ticket.status === 'open' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                  ticket.status === 'in_progress' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}>
                  {ticket.status.replace('_', ' ')}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  ticket.priority === 'high' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                  ticket.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                  'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                }`}>
                  {ticket.priority}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Messages */}
          {ticket.messages?.map((msg, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg ${
                msg.is_admin
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                  : 'bg-gray-50 dark:bg-gray-700 border-l-4 border-gray-400 dark:border-gray-500'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {msg.is_admin ? 'Support Team (You)' : ticket.customer_name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.message}</p>
            </div>
          ))}

          {/* Reply Form */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reply to Ticket</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Update Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Reply
              </label>
              <textarea
                rows={4}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Type your reply..."
              />
            </div>

            <button
              onClick={handleReply}
              disabled={!replyMessage.trim() || replyMutation.isPending}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
            >
              <Send className="w-5 h-5" />
              {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

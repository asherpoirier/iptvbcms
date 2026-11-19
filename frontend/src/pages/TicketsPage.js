import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, Plus, X, Send, Package, ChevronLeft, ChevronRight, Filter, ArrowUpDown } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const TICKETS_PER_PAGE = 10;

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const ticketsAPI = {
  create: (data) => axios.post(`${API_URL}/api/tickets`, data, {
    headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token}` }
  }),
  getAll: () => axios.get(`${API_URL}/api/tickets`, {
    headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token}` }
  }),
  getOne: (id) => axios.get(`${API_URL}/api/tickets/${id}`, {
    headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token}` }
  }),
  reply: (id, message) => axios.post(`${API_URL}/api/tickets/${id}/reply`, { message }, {
    headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token}` }
  }),
};

export default function TicketsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const response = await ticketsAPI.getAll();
      return response.data;
    },
  });

  // Filter, sort, and paginate tickets
  const { paginatedTickets, totalPages, totalFiltered } = useMemo(() => {
    let filtered = tickets || [];
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
        case 'date_asc':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'priority_high':
          return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        case 'priority_low':
          return (PRIORITY_ORDER[b.priority] ?? 3) - (PRIORITY_ORDER[a.priority] ?? 3);
        case 'date_desc':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });
    const pages = Math.max(1, Math.ceil(sorted.length / TICKETS_PER_PAGE));
    const start = (currentPage - 1) * TICKETS_PER_PAGE;
    return { paginatedTickets: sorted.slice(start, start + TICKETS_PER_PAGE), totalPages: pages, totalFiltered: sorted.length };
  }, [tickets, statusFilter, priorityFilter, sortBy, currentPage]);

  // Reset page when filters change
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
          <div className="flex justify-between items-center">
            <Link to="/dashboard" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600">
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              New Ticket
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-8">Support Tickets</h1>

        {/* Filters & Sort Controls */}
        {tickets?.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 mb-6">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => handleFilterChange(setStatusFilter)(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              {/* Priority Filter */}
              <div>
                <select
                  value={priorityFilter}
                  onChange={(e) => handleFilterChange(setPriorityFilter)(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">All Priority</option>
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>
              {/* Sort */}
              <div className="flex items-center gap-2 ml-auto">
                <ArrowUpDown className="w-4 h-4 text-gray-500" />
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="priority_high">Priority: High → Low</option>
                  <option value="priority_low">Priority: Low → High</option>
                </select>
              </div>
              {/* Count */}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {totalFiltered} ticket{totalFiltered !== 1 ? 's' : ''}
                {(statusFilter !== 'all' || priorityFilter !== 'all') && ` (filtered from ${tickets?.length})`}
              </span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : tickets?.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No tickets yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Create a ticket if you need help</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Create Ticket
            </button>
          </div>
        ) : totalFiltered === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
            <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No tickets match your filters</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Try adjusting status or priority filters</p>
            <button
              onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); setCurrentPage(1); }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Clear filters
            </button>
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
                      {ticket.service_name && (
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            Re: {ticket.service_name}
                          </span>
                        </div>
                      )}
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {ticket.subject}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
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
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  {/* Page numbers */}
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
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <CreateTicketModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['tickets']);
            setShowCreateModal(false);
          }}
        />
      )}

      {/* View Ticket Modal */}
      {selectedTicket && (
        <ViewTicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}

function CreateTicketModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    priority: 'medium',
    service_id: '',
  });

  // Fetch user's services
  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      const token = JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token;
      const response = await fetch(`${backendUrl}/api/services`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => ticketsAPI.create(data),
    onSuccess: () => {
      toast.success('Ticket created successfully!');
      onSuccess();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create Support Ticket</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Related Service (Optional)
            </label>
            <select
              value={formData.service_id}
              onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">General Question</option>
              {services?.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.product_name} - {service.xtream_username}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Select a service if your question is about a specific subscription
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subject *
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of your issue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message *
            </label>
            <textarea
              required
              rows={6}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="Describe your issue in detail..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewTicketModal({ ticket, onClose }) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState(ticket.messages || []);
  const queryClient = useQueryClient();
  const messagesEndRef = React.useRef(null);
  const isClosed = ticket.status === 'closed';

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      await ticketsAPI.reply(ticket.id, replyText);
      setMessages([...messages, { message: replyText, is_admin: false, created_at: new Date().toISOString() }]);
      setReplyText('');
      queryClient.invalidateQueries(['tickets']);
      toast.success('Reply sent!');
    } catch (err) {
      toast.error('Failed to send reply: ' + (err.response?.data?.detail || err.message));
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{ticket.subject}</h2>
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

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {messages.map((msg, idx) => (
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
                  {msg.is_admin ? 'Support Team' : 'You'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.message}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply form */}
        {isClosed ? (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">This ticket is closed. Open a new ticket if you need further help.</p>
          </div>
        ) : (
          <form onSubmit={handleReply} className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex gap-3">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                rows={2}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                data-testid="ticket-reply-input"
              />
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 self-end"
                data-testid="ticket-reply-submit"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Reply'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

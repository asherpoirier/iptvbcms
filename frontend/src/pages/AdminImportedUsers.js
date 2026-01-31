import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft, Users, Filter, Ban, CheckCircle, Server, UserCog, CreditCard, Search, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

export default function AdminImportedUsers() {
  const queryClient = useQueryClient();
  const [selectedPanel, setSelectedPanel] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('subscribers');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  // Reset to page 1 when filters or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, selectedPanel, activeTab]);

  // Fetch imported users (get all, filter on frontend)
  const { data: allUsers, isLoading } = useQuery({
    queryKey: ['imported-users'],
    queryFn: async () => {
      const response = await adminAPI.getImportedUsers();  // Get all users
      return response.data;
    },
  });

  // Fetch settings for panel names
  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const response = await adminAPI.getSettings();
      return response.data;
    },
  });

  const xtreamPanels = settings?.xtream?.panels || [];
  const xuionePanels = settings?.xuione?.panels || [];
  
  // Combine both panel types for filter dropdown
  const allPanels = [
    ...xtreamPanels.map((panel, index) => ({ 
      ...panel, 
      type: 'xtream', 
      index: index,
      value: `xtream-${index}`,
      label: `${panel.name} (XtreamUI)`
    })),
    ...xuionePanels.map((panel, index) => ({ 
      ...panel, 
      type: 'xuione', 
      index: index,
      value: `xuione-${index}`,
      label: `${panel.name} (XuiOne)`
    }))
  ];
  
  const panels = allPanels;

  const suspendMutation = useMutation({
    mutationFn: (id) => adminAPI.suspendImportedUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['imported-users']);
      alert('User suspended successfully!');
    },
    onError: (error) => {
      alert('Failed to suspend user: ' + (error.response?.data?.detail || error.message));
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id) => adminAPI.activateImportedUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['imported-users']);
      alert('User activated successfully!');
    },
    onError: (error) => {
      alert('Failed to activate user: ' + (error.response?.data?.detail || error.message));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminAPI.deleteImportedUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['imported-users']);
      alert('User removed from billing panel');
    },
    onError: (error) => {
      alert('Failed to remove user: ' + (error.response?.data?.detail || error.message));
    },
  });

  const handleDelete = (user) => {
    if (window.confirm(`Remove "${user.username}" from billing panel?\n\nNote: This only removes from the billing panel, NOT from XtreamUI.`)) {
      deleteMutation.mutate(user.id);
    }
  };

  // Filter users by panel selection
  const users = React.useMemo(() => {
    if (!allUsers) return null;
    
    if (selectedPanel === 'all') {
      return allUsers;
    }
    
    // Parse panel selection: "xtream-0" or "xuione-0"
    const [panelType, panelIndexStr] = selectedPanel.split('-');
    const panelIndex = parseInt(panelIndexStr);
    
    return allUsers.filter(u => 
      (u.panel_type || 'xtream') === panelType && u.panel_index === panelIndex
    );
  }, [allUsers, selectedPanel]);

  // Separate users by account type
  const subscribers = users?.filter(u => u.account_type === 'subscriber') || [];
  const resellers = users?.filter(u => u.account_type === 'reseller') || [];

  // Filter users by status and search query
  const filterUsers = (userList) => {
    let filtered = userList;
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => u.status === statusFilter);
    }
    
    // Filter by search query (username, password, owner)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(u => 
        u.username?.toLowerCase().includes(query) ||
        u.password?.toLowerCase().includes(query) ||
        u.owner?.toLowerCase().includes(query) ||
        u.member_group?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const filteredSubscribers = filterUsers(subscribers);
  const filteredResellers = filterUsers(resellers);

  // Pagination logic
  const getCurrentData = () => {
    const data = activeTab === 'subscribers' ? filteredSubscribers : filteredResellers;
    const totalPages = Math.ceil(data.length / entriesPerPage);
    const startIndex = (currentPage - 1) * entriesPerPage;
    const endIndex = startIndex + entriesPerPage;
    const paginatedData = data.slice(startIndex, endIndex);
    
    return {
      data: paginatedData,
      totalItems: data.length,
      totalPages,
      startIndex: startIndex + 1,
      endIndex: Math.min(endIndex, data.length)
    };
  };

  const { data: paginatedData, totalItems, totalPages, startIndex, endIndex } = getCurrentData();

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'expired':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <header className="bg-white dark:bg-gray-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/admin" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Imported Users</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Users and resellers synced from XtreamUI and XuiOne panels
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Search className="w-4 h-4 inline mr-1" />
                Search Users
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username, password..."
                  className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                  data-testid="search-input"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Server className="w-4 h-4 inline mr-1" />
                Filter by Panel
              </label>
              <select
                value={selectedPanel}
                onChange={(e) => setSelectedPanel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                data-testid="panel-filter"
              >
                <option value="all">All Panels</option>
                {panels.map((panel, idx) => (
                  <option key={idx} value={panel.value}>
                    {panel.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                data-testid="status-filter"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Imported</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{users?.length || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <p className="text-sm text-blue-600">Subscribers</p>
            <p className="text-2xl font-bold text-blue-600">{subscribers.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <p className="text-sm text-purple-600">Resellers</p>
            <p className="text-2xl font-bold text-purple-600">{resellers.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <p className="text-sm text-green-600">Active</p>
            <p className="text-2xl font-bold text-green-600">{users?.filter(u => u.status === 'active').length || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <p className="text-sm text-red-600">Expired</p>
            <p className="text-2xl font-bold text-red-600">{users?.filter(u => u.status === 'expired').length || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('subscribers')}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'subscribers'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
                data-testid="subscribers-tab"
              >
                <Users className="w-4 h-4 inline mr-2" />
                Subscribers ({filteredSubscribers.length})
              </button>
              <button
                onClick={() => setActiveTab('resellers')}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'resellers'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
                data-testid="resellers-tab"
              >
                <UserCog className="w-4 h-4 inline mr-2" />
                Resellers ({filteredResellers.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Content based on active tab */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : activeTab === 'subscribers' ? (
          // Subscribers Table
          filteredSubscribers.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No subscribers found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Sync users from XtreamUI panel to see them here
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" data-testid="subscribers-table">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Username</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Password</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Panel</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Expiry</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Connections</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Last Synced</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedData.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono text-gray-600 dark:text-gray-300">{user.password || '••••••'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                          {user.panel_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                          {user.expiry_date ? new Date(user.expiry_date).toLocaleDateString() : 'Unlimited'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                          {user.max_connections || 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.status)}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {user.last_synced ? new Date(user.last_synced).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center gap-2 justify-end">
                            {user.status === 'active' ? (
                              <button
                                onClick={() => suspendMutation.mutate(user.id)}
                                disabled={suspendMutation.isPending}
                                className="text-yellow-600 hover:text-yellow-900 dark:hover:text-yellow-400"
                                data-testid={`suspend-${user.username}`}
                              >
                                <Ban className="w-4 h-4 inline mr-1" />
                                Suspend
                              </button>
                            ) : user.status === 'suspended' ? (
                              <button
                                onClick={() => activateMutation.mutate(user.id)}
                                disabled={activateMutation.isPending}
                                className="text-green-600 hover:text-green-900 dark:hover:text-green-400"
                                data-testid={`activate-${user.username}`}
                              >
                                <CheckCircle className="w-4 h-4 inline mr-1" />
                                Activate
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleDelete(user)}
                              disabled={deleteMutation.isPending}
                              className="text-red-600 hover:text-red-900 dark:hover:text-red-400 ml-2"
                              data-testid={`delete-${user.username}`}
                              title="Remove from billing panel"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {startIndex} to {endIndex} of {totalItems} entries
                  </span>
                  <select
                    value={entriesPerPage}
                    onChange={(e) => {
                      setEntriesPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    data-testid="entries-per-page"
                  >
                    <option value={10}>10 per page</option>
                    <option value={15}>15 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="prev-page"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  
                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        data-testid={`page-${page}`}
                      >
                        {page}
                      </button>
                    )
                  ))}
                  
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="next-page"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          // Resellers Table
          filteredResellers.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-12 text-center">
              <UserCog className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No resellers found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Sync users from XtreamUI panel to see resellers here
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" data-testid="resellers-table">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Username</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Panel</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Member Group</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Credits</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Owner</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Last Synced</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedData.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <UserCog className="w-4 h-4 text-purple-500 mr-2" />
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                          {user.panel_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            {user.member_group || 'Reseller'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900 dark:text-white">
                            <CreditCard className="w-4 h-4 text-green-500 mr-1" />
                            {user.credits || 0}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                          {user.owner || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.status)}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {user.last_synced ? new Date(user.last_synced).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={deleteMutation.isPending}
                            className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                            data-testid={`delete-reseller-${user.username}`}
                            title="Remove from billing panel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {startIndex} to {endIndex} of {totalItems} entries
                  </span>
                  <select
                    value={entriesPerPage}
                    onChange={(e) => {
                      setEntriesPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    data-testid="entries-per-page-resellers"
                  >
                    <option value={10}>10 per page</option>
                    <option value={15}>15 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  
                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))}
                  
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}

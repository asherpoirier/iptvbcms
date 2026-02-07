import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft, Users, Filter, Ban, CheckCircle, Server, UserCog, CreditCard, Search, ChevronLeft, ChevronRight, Trash2, Plus, X, RefreshCw, Clock, Download } from 'lucide-react';

export default function AdminImportedUsers() {
  const queryClient = useQueryClient();
  const [selectedPanel, setSelectedPanel] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('subscribers');
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedUserForExtend, setSelectedUserForExtend] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

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
  const onestreamPanels = settings?.onestream?.panels || [];
  
  // Combine all panel types for filter dropdown
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
    })),
    ...onestreamPanels.map((panel, index) => ({ 
      ...panel, 
      type: 'onestream', 
      index: index,
      value: `onestream-${index}`,
      label: `${panel.name} (1-Stream)`
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
              Users and resellers synced from XtreamUI, XuiOne, and 1-Stream panels
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                setIsSyncing(true);
                setSyncResult(null);
                try {
                  const response = await adminAPI.syncAllUsers();
                  setSyncResult(response.data);
                  queryClient.invalidateQueries(['imported-users']);
                } catch (error) {
                  setSyncResult({ success: false, error: error.response?.data?.detail || error.message });
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-semibold disabled:opacity-50"
              data-testid="sync-users-btn"
            >
              <Download className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Users'}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
              data-testid="create-user-btn"
            >
              <Plus className="w-5 h-5" />
              Create User
            </button>
          </div>
        </div>

        {/* Sync Result Banner */}
        {syncResult && (
          <div className={`mb-6 p-4 rounded-lg ${syncResult.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
            <div className="flex items-center justify-between">
              <div>
                {syncResult.success ? (
                  <>
                    <p className="font-semibold text-green-800 dark:text-green-200">
                      Sync Complete: {syncResult.total_synced} new users, {syncResult.total_updated} updated
                      {syncResult.total_removed > 0 && `, ${syncResult.total_removed} removed (from deleted panels)`}
                    </p>
                    {syncResult.panels_synced?.length > 0 && (
                      <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                        Panels: {syncResult.panels_synced.map(p => `${p.name} (${p.synced} new, ${p.updated} updated)`).join(', ')}
                      </p>
                    )}
                    {syncResult.errors?.length > 0 && (
                      <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                        Warnings: {syncResult.errors.join(', ')}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-semibold text-red-800 dark:text-red-200">
                    Sync Failed: {syncResult.error}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSyncResult(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

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
                            {/* Extend Button - only for subscribers */}
                            <button
                              onClick={() => {
                                setSelectedUserForExtend(user);
                                setShowExtendModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400"
                              data-testid={`extend-${user.username}`}
                              title="Extend subscription"
                            >
                              <Clock className="w-4 h-4 inline mr-1" />
                              Extend
                            </button>
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

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          panels={panels}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries(['imported-users']);
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Extend User Modal */}
      {showExtendModal && selectedUserForExtend && (
        <ExtendUserModal
          user={selectedUserForExtend}
          onClose={() => {
            setShowExtendModal(false);
            setSelectedUserForExtend(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries(['imported-users']);
            setShowExtendModal(false);
            setSelectedUserForExtend(null);
          }}
        />
      )}
    </div>
  );
}

// Create User Modal Component
function CreateUserModal({ panels, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    panel_type: 'xtream',
    panel_index: 0,
    account_type: 'subscriber',
    username: '',
    password: '',
    package_id: '',
    duration_months: 1,
    max_connections: 1,
    credits: 0,
    member_group_id: 2
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);

  // Fetch packages for the selected panel
  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const response = await adminAPI.getSettings();
      return response.data;
    },
  });

  // Get the panel list based on panel_type
  const getPanelList = () => {
    if (formData.panel_type === 'xtream') {
      return settings?.xtream?.panels?.map((p, i) => ({ ...p, index: i, label: `${p.name} (XtreamUI)` })) || [];
    } else if (formData.panel_type === 'onestream') {
      return settings?.onestream?.panels?.map((p, i) => ({ ...p, index: i, label: `${p.name} (1-Stream)` })) || [];
    } else {
      return settings?.xuione?.panels?.map((p, i) => ({ ...p, index: i, label: `${p.name} (XuiOne)` })) || [];
    }
  };

  const panelList = getPanelList();

  // Fetch packages for XtreamUI
  const { data: xtreamPackages } = useQuery({
    queryKey: ['xtream-packages', formData.panel_index],
    queryFn: async () => {
      const response = await adminAPI.syncPackagesFromPanel(formData.panel_index);
      return response.data;
    },
    enabled: formData.panel_type === 'xtream' && formData.account_type === 'subscriber',
  });

  // Fetch packages for XuiOne
  const { data: xuionePackages } = useQuery({
    queryKey: ['xuione-packages', formData.panel_index],
    queryFn: async () => {
      const response = await adminAPI.syncXuiOnePackages(formData.panel_index);
      return response.data;
    },
    enabled: formData.panel_type === 'xuione' && formData.account_type === 'subscriber',
  });

  // Fetch packages for 1-Stream
  const { data: onestreamPackages } = useQuery({
    queryKey: ['onestream-packages', formData.panel_index],
    queryFn: async () => {
      const response = await adminAPI.syncOneStreamPackages(formData.panel_index);
      return response.data;
    },
    enabled: formData.panel_type === 'onestream' && formData.account_type === 'subscriber',
  });

  const packages = formData.panel_type === 'xtream' ? (xtreamPackages?.packages || []) 
    : formData.panel_type === 'onestream' ? (onestreamPackages?.packages || [])
    : (xuionePackages?.packages || []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = {
        panel_type: formData.panel_type,
        panel_index: parseInt(formData.panel_index),
        account_type: formData.account_type,
        username: formData.username || null,
        password: formData.password || null,
      };

      if (formData.account_type === 'subscriber') {
        submitData.package_id = parseInt(formData.package_id);
        submitData.duration_months = parseInt(formData.duration_months);
        submitData.max_connections = parseInt(formData.max_connections);
      } else {
        submitData.credits = parseFloat(formData.credits);
        submitData.member_group_id = parseInt(formData.member_group_id);
      }

      const response = await adminAPI.createImportedUser(submitData);
      setCreatedUser(response.data.user);
      
    } catch (error) {
      alert('Failed to create user: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // If user was created, show success view
  if (createdUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
          <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <CheckCircle className="w-6 h-6" />
              User Created Successfully
            </h3>
            <button onClick={onSuccess} className="text-white hover:text-gray-200">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Panel</p>
                <p className="font-semibold text-gray-900 dark:text-white">{createdUser.panel_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Account Type</p>
                <p className="font-semibold text-gray-900 dark:text-white capitalize">{createdUser.account_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Username</p>
                <p className="font-mono font-semibold text-gray-900 dark:text-white">{createdUser.username}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Password</p>
                <p className="font-mono font-semibold text-gray-900 dark:text-white">{createdUser.password}</p>
              </div>
              {createdUser.expiry_date && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Expiry Date</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {new Date(createdUser.expiry_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              {createdUser.max_connections && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Max Connections</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{createdUser.max_connections}</p>
                </div>
              )}
              {createdUser.duration_months && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{createdUser.duration_months} month(s)</p>
                </div>
              )}
              {createdUser.credits !== undefined && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Credits</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{createdUser.credits}</p>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> Save these credentials. The password will not be shown again.
              </p>
            </div>

            <button
              onClick={onSuccess}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create Panel User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Panel Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Panel Type *
            </label>
            <select
              value={formData.panel_type}
              onChange={(e) => setFormData({ ...formData, panel_type: e.target.value, panel_index: 0, package_id: '' })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="panel-type-select"
            >
              <option value="xtream">XtreamUI</option>
              <option value="xuione">XuiOne</option>
              <option value="onestream">1-Stream</option>
            </select>
          </div>

          {/* Panel Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Panel *
            </label>
            <select
              value={formData.panel_index}
              onChange={(e) => setFormData({ ...formData, panel_index: parseInt(e.target.value), package_id: '' })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="panel-select"
            >
              {panelList.length === 0 ? (
                <option value="">No panels configured</option>
              ) : (
                panelList.map((panel) => (
                  <option key={panel.index} value={panel.index}>{panel.label || panel.name}</option>
                ))
              )}
            </select>
          </div>

          {/* Account Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Account Type *
            </label>
            <select
              value={formData.account_type}
              onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="account-type-select"
            >
              <option value="subscriber">Subscriber</option>
              {(formData.panel_type === 'xtream' || formData.panel_type === 'onestream') && <option value="reseller">Reseller</option>}
            </select>
            {formData.panel_type === 'xuione' && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Note: XuiOne reseller creation is not supported via API
              </p>
            )}
          </div>

          {/* Username (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username <span className="text-gray-400">(leave blank to auto-generate)</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Auto-generate if blank"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="username-input"
            />
          </div>

          {/* Password (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password <span className="text-gray-400">(leave blank to auto-generate)</span>
            </label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Auto-generate if blank"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="password-input"
            />
          </div>

          {/* Subscriber-specific fields */}
          {formData.account_type === 'subscriber' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Package *
                </label>
                <select
                  required
                  value={formData.package_id}
                  onChange={(e) => setFormData({ ...formData, package_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  data-testid="package-select"
                >
                  <option value="">Select a package...</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                  ))}
                </select>
                {packages.length === 0 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    No packages found. Click sync to fetch packages from the panel.
                  </p>
                )}
              </div>

              {/* Show selected package details */}
              {formData.package_id && (() => {
                const selectedPkg = packages.find(p => String(p.id) === String(formData.package_id));
                if (selectedPkg) {
                  return (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Package Details</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Duration:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {selectedPkg.duration} {selectedPkg.duration_unit || 'months'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Max Connections:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {selectedPkg.max_connections || '1'}
                          </span>
                        </div>
                        {selectedPkg.credits && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Credits Cost:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {selectedPkg.credits}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </>
          )}

          {/* Reseller-specific fields */}
          {formData.account_type === 'reseller' && formData.panel_type === 'xtream' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Credits
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.credits}
                onChange={(e) => setFormData({ ...formData, credits: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                data-testid="credits-input"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Initial credits to assign to the reseller
              </p>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> This will create a user directly on the panel. The user will not be linked to any customer account in the billing system.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (formData.account_type === 'subscriber' && !formData.package_id)}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="create-user-submit"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Create User
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Extend User Modal Component
function ExtendUserModal({ user, onClose, onSuccess }) {
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Fetch packages for the user's panel
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ['packages', user.panel_type, user.panel_index],
    queryFn: async () => {
      // Determine panel type - default to xtream if not set or null
      const panelType = user.panel_type || 'xtream';
      
      if (panelType === 'xtream') {
        const response = await adminAPI.syncPackagesFromPanel(user.panel_index || 0);
        return response.data?.packages || [];
      } else if (panelType === 'onestream') {
        const response = await adminAPI.syncOneStreamPackages(user.panel_index || 0);
        return response.data?.packages || [];
      } else {
        const response = await adminAPI.syncXuiOnePackages(user.panel_index || 0);
        return response.data?.packages || [];
      }
    },
  });

  // Get selected package details
  const selectedPackage = packages?.find(p => String(p.id) === String(selectedPackageId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPackageId) {
      alert('Please select a package');
      return;
    }
    setIsSubmitting(true);

    try {
      const response = await adminAPI.extendImportedUser(user.id, {
        package_id: parseInt(selectedPackageId)
      });
      setResult(response.data);
    } catch (error) {
      alert('Failed to extend user: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success view
  if (result) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
          <div className="bg-green-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <CheckCircle className="w-6 h-6" />
              Subscription Extended
            </h3>
            <button onClick={onSuccess} className="text-white hover:text-gray-200">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Username</p>
                <p className="font-mono font-semibold text-gray-900 dark:text-white">{user.username}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Previous Expiry</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {result.previous_expiry ? new Date(result.previous_expiry).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">New Expiry</p>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  {new Date(result.new_expiry).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Days Added</p>
                <p className="font-semibold text-gray-900 dark:text-white">{result.days_added} days</p>
              </div>
            </div>

            <button
              onClick={onSuccess}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Extend Subscription</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* User Info */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Username:</span>
                <span className="ml-2 font-mono font-medium text-gray-900 dark:text-white">{user.username}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Panel:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{user.panel_name}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Current Expiry:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {user.expiry_date ? new Date(user.expiry_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Package Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Package to Extend *
            </label>
            {packagesLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading packages...
              </div>
            ) : (
              <select
                required
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                data-testid="extend-package-select"
              >
                <option value="">Select a package...</option>
                {packages?.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Show selected package details */}
          {selectedPackage && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Package Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-blue-600 dark:text-blue-300">Duration:</span>
                  <span className="ml-2 font-medium text-blue-900 dark:text-blue-100">
                    {selectedPackage.duration} {selectedPackage.duration_unit || 'months'}
                  </span>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-300">Max Connections:</span>
                  <span className="ml-2 font-medium text-blue-900 dark:text-blue-100">
                    {selectedPackage.max_connections || '1'}
                  </span>
                </div>
                {selectedPackage.credits && (
                  <div className="col-span-2">
                    <span className="text-blue-600 dark:text-blue-300">Credit Cost:</span>
                    <span className="ml-2 font-medium text-blue-900 dark:text-blue-100">
                      {selectedPackage.credits} credits
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>Note:</strong> This will extend the subscription on both the billing system and the {user.panel_type === 'xtream' ? 'XtreamUI' : user.panel_type === 'onestream' ? '1-Stream' : 'XuiOne'} panel.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedPackageId}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="extend-user-submit"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Extending...
                </>
              ) : (
                <>
                  <Clock className="w-5 h-5" />
                  Extend Subscription
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

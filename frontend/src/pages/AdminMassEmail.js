import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { ArrowLeft, Mail, Send, Users, History, AlertCircle, CheckCircle, Eye, Clock, Trash2 } from 'lucide-react';
import RichTextEditor from '../components/RichTextEditor';
import FileUploader from '../components/FileUploader';
import EmailPreview from '../components/EmailPreview';
import axios from 'axios';

export default function AdminMassEmail() {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [sendStatus, setSendStatus] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadedAttachments, setUploadedAttachments] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['email-logs'],
    queryFn: async () => {
      const response = await adminAPI.getEmailLogs();
      return response.data;
    },
  });

  const { data: scheduledEmails, refetch: refetchScheduled } = useQuery({
    queryKey: ['scheduled-emails'],
    queryFn: async () => {
      const response = await adminAPI.getScheduledEmails();
      return response.data;
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => adminAPI.sendMassEmail(subject, content, recipientFilter),
    onSuccess: (response) => {
      setSendStatus({
        type: 'success',
        message: response.data.message
      });
      setSubject('');
      setContent('');
      setAttachedFiles([]);
      setUploadedAttachments([]);
      refetchLogs();
    },
    onError: (error) => {
      setSendStatus({
        type: 'error',
        message: error.response?.data?.detail || error.message
      });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: (scheduledFor) => adminAPI.scheduleEmail(subject, content, recipientFilter, scheduledFor),
    onSuccess: () => {
      alert('Email scheduled successfully!');
      setSubject('');
      setContent('');
      setIsScheduling(false);
      setScheduledDate('');
      setScheduledTime('');
      refetchScheduled();
    },
    onError: (error) => {
      alert('Failed to schedule email: ' + error.response?.data?.detail);
    },
  });

  const handleFilesChange = async (files) => {
    setAttachedFiles(files);
    
    // Upload files
    const uploaded = [];
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const token = localStorage.getItem('auth-storage');
        const authData = token ? JSON.parse(token) : null;
        const bearerToken = authData?.state?.token;
        
        const response = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/admin/upload/attachment`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${bearerToken}`
            }
          }
        );
        
        uploaded.push(response.data);
      } catch (error) {
        console.error('Upload failed:', error);
        alert(`Failed to upload ${file.name}`);
      }
    }
    
    setUploadedAttachments(uploaded);
  };

  const handleSend = () => {
    if (!subject.trim() || !content.trim()) {
      alert('Please fill in both subject and content');
      return;
    }
    
    if (!window.confirm(`Send email to ${recipientFilter === 'all' ? 'ALL' : recipientFilter.toUpperCase()} customers?\n\nSubject: ${subject}`)) {
      return;
    }
    
    sendMutation.mutate();
  };

  const handleSchedule = () => {
    if (!subject.trim() || !content.trim()) {
      alert('Please fill in both subject and content');
      return;
    }
    
    if (!scheduledDate || !scheduledTime) {
      alert('Please select date and time');
      return;
    }
    
    const scheduledFor = `${scheduledDate}T${scheduledTime}:00Z`;
    scheduleMutation.mutate(scheduledFor);
  };

  const handlePreview = () => {
    if (!content.trim()) {
      alert('Please add some content first');
      return;
    }
    setShowPreview(true);
  };

  const getPreviewContent = () => {
    // Simulate how the email will look with sample data
    let previewHtml = content;
    previewHtml = previewHtml.replace(/\{\{name\}\}/g, 'John Doe');
    previewHtml = previewHtml.replace(/\{\{customer_name\}\}/g, 'John Doe');
    previewHtml = previewHtml.replace(/\{\{email\}\}/g, 'customer@example.com');
    
    // Wrap with email template
    return `
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${subject || 'Email Subject'}</h1>
        </div>
        <div style="padding: 30px;">
          ${previewHtml}
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; margin: 0; font-size: 14px;">© 2024 Digital Services. All rights reserved.</p>
          <p style="color: #6c757d; margin: 10px 0 0 0; font-size: 12px;">This is an automated message.</p>
          <p style="margin-top: 15px; font-size: 11px;">
            <a href="#" style="color: #6c757d; text-decoration: underline;">Unsubscribe from marketing emails</a>
          </p>
        </div>
      </div>
    `;
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Mail className="w-8 h-8 text-blue-600" />
                Mass Email
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Send bulk emails to your customers</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Compose Email */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Compose Email</h2>
              
              {/* Status Message */}
              {sendStatus && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
                  sendStatus.type === 'success' 
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700' 
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700'
                }`}>
                  {sendStatus.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {sendStatus.message}
                </div>
              )}

              {/* Recipient Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Users className="w-4 h-4 inline mr-2" />
                  Recipients
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    <input
                      type="radio"
                      name="filter"
                      value="all"
                      checked={recipientFilter === 'all'}
                      onChange={(e) => setRecipientFilter(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-900 dark:text-white">All Customers</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    <input
                      type="radio"
                      name="filter"
                      value="active"
                      checked={recipientFilter === 'active'}
                      onChange={(e) => setRecipientFilter(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-900 dark:text-white">Active Services</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    <input
                      type="radio"
                      name="filter"
                      value="inactive"
                      checked={recipientFilter === 'inactive'}
                      onChange={(e) => setRecipientFilter(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-900 dark:text-white">Inactive/Expired</span>
                  </label>
                </div>
              </div>

              {/* Available Variables */}
              <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">
                  📝 Available Variables for Personalization
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                  Use these variables in your subject or content to personalize emails. They will be automatically replaced with customer-specific data.
                </p>
                <div className="flex flex-wrap gap-2">
                  <code className="px-3 py-1.5 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 rounded text-xs font-mono border border-blue-200 dark:border-blue-600">
                    {'{{name}}'}
                  </code>
                  <code className="px-3 py-1.5 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 rounded text-xs font-mono border border-blue-200 dark:border-blue-600">
                    {'{{email}}'}
                  </code>
                  <code className="px-3 py-1.5 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 rounded text-xs font-mono border border-blue-200 dark:border-blue-600">
                    {'{{customer_name}}'}
                  </code>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-3">
                  Example: "Hi {'{{name}}'}, we have a special offer for you!"
                </p>
              </div>

              {/* Subject */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  data-testid="mass-email-subject"
                />
              </div>

              {/* Rich Text Content */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content *
                </label>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Write your email content here. Use {{name}} for personalization."
                  height="400px"
                />
              </div>

              {/* Attachments */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attachments (Optional)
                </label>
                <FileUploader
                  onFilesChange={handleFilesChange}
                  maxFiles={5}
                  maxSizeMB={10}
                />
              </div>

              {/* Schedule Section */}
              {isScheduling && (
                <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                  <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-3">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Schedule for Later
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        data-testid="schedule-date"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        data-testid="schedule-time"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handlePreview}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  data-testid="preview-email-btn"
                >
                  <Eye className="w-5 h-5" />
                  Preview Email
                </button>
                
                <button
                  onClick={handleSend}
                  disabled={sendMutation.isLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  data-testid="send-mass-email-btn"
                >
                  <Send className="w-5 h-5" />
                  {sendMutation.isLoading ? 'Sending...' : 'Send Now'}
                </button>
                
                {!isScheduling ? (
                  <button
                    onClick={() => setIsScheduling(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    data-testid="schedule-toggle-btn"
                  >
                    <Clock className="w-5 h-5" />
                    Schedule for Later
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSchedule}
                      className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      data-testid="confirm-schedule-btn"
                    >
                      <Clock className="w-5 h-5" />
                      Confirm Schedule
                    </button>
                    <button
                      onClick={() => setIsScheduling(false)}
                      className="px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Scheduled Emails */}
            {scheduledEmails && scheduledEmails.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">Scheduled Emails</h2>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {scheduledEmails.slice(0, 5).map((email) => (
                    <div key={email.id} className="p-4">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {email.subject}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(email.scheduled_for).toLocaleString()}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={async () => {
                            if (window.confirm('Send this email now?')) {
                              await adminAPI.sendScheduledEmailNow(email.id);
                              refetchScheduled();
                            }
                          }}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Send Now
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Cancel this scheduled email?')) {
                              await adminAPI.cancelScheduledEmail(email.id);
                              refetchScheduled();
                            }
                          }}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          <Trash2 className="w-3 h-3 inline" /> Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Campaigns */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-600" />
                <h2 className="font-semibold text-gray-900 dark:text-white">Recent Campaigns</h2>
              </div>
              {logsLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : logs && logs.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.slice(0, 5).map((log) => (
                    <div key={log.id} className="p-4">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {log.subject}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {log.total_recipients} recipients
                        </span>
                        <div className="flex gap-2 text-xs">
                          <span className="text-green-600">{log.sent} sent</span>
                          {log.failed > 0 && <span className="text-red-600">{log.failed} failed</span>}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No email campaigns yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Preview Modal */}
      {showPreview && (
        <EmailPreview
          htmlContent={getPreviewContent()}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

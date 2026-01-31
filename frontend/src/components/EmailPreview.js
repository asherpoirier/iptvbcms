import React, { useState } from 'react';
import { Monitor, Smartphone, Tablet, X } from 'lucide-react';

const EmailPreview = ({ htmlContent, onClose }) => {
  const [viewMode, setViewMode] = useState('desktop'); // desktop, tablet, mobile
  const [emailClient, setEmailClient] = useState('modern'); // modern, outlook, gmail

  const getPreviewWidth = () => {
    switch (viewMode) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      case 'desktop':
      default:
        return '100%';
    }
  };

  const getEmailClientStyles = () => {
    switch (emailClient) {
      case 'outlook':
        return {
          fontFamily: 'Calibri, sans-serif',
          fontSize: '14px',
          lineHeight: '1.5',
        };
      case 'gmail':
        return {
          fontFamily: 'Roboto, Arial, sans-serif',
          fontSize: '14px',
          lineHeight: '1.4',
        };
      case 'modern':
      default:
        return {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '16px',
          lineHeight: '1.6',
        };
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Email Preview</h3>
            
            {/* View Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('desktop')}
                className={`p-2 rounded ${viewMode === 'desktop' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                title="Desktop View"
                data-testid="preview-desktop"
              >
                <Monitor className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('tablet')}
                className={`p-2 rounded ${viewMode === 'tablet' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                title="Tablet View"
                data-testid="preview-tablet"
              >
                <Tablet className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('mobile')}
                className={`p-2 rounded ${viewMode === 'mobile' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
                title="Mobile View"
                data-testid="preview-mobile"
              >
                <Smartphone className="w-5 h-5" />
              </button>
            </div>

            {/* Email Client Selector */}
            <select
              value={emailClient}
              onChange={(e) => setEmailClient(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              data-testid="email-client-selector"
            >
              <option value="modern">Modern Email Client</option>
              <option value="gmail">Gmail Style</option>
              <option value="outlook">Outlook Style</option>
            </select>
          </div>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            data-testid="close-preview"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-800 p-8 flex justify-center">
          <div
            className="bg-white rounded-lg shadow-lg transition-all duration-300"
            style={{
              width: getPreviewWidth(),
              maxWidth: '100%',
            }}
          >
            <div
              className="email-preview-content"
              style={getEmailClientStyles()}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400">
          <p>
            <strong>Note:</strong> This is a preview simulation. Actual rendering may vary across different email clients and devices.
            Always send test emails to verify appearance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailPreview;

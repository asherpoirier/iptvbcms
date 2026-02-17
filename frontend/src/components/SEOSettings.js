import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import { Search, Globe, Share2, Code, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function SEOSettings({ settings }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    meta_title: '', meta_description: '', meta_keywords: '',
    og_title: '', og_description: '', og_image: '',
    twitter_card: 'summary_large_image',
    favicon_url: '',
    google_analytics_id: '', google_tag_manager_id: '',
    robots_txt: 'User-agent: *\nAllow: /\nSitemap: /sitemap.xml',
    schema_type: 'Organization', schema_name: '', schema_description: '',
    schema_url: '', schema_logo: '', schema_phone: '', schema_email: '',
    custom_head_code: '',
  });

  useEffect(() => {
    if (settings?.seo) {
      setFormData(prev => ({ ...prev, ...settings.seo }));
    }
  }, [settings?.seo]);

  const f = (key) => ({ value: formData[key] || '', onChange: (e) => setFormData({ ...formData, [key]: e.target.value }) });
  const cls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm";

  const saveMutation = useMutation({
    mutationFn: () => adminAPI.updateSettings({ ...settings, seo: formData }),
    onSuccess: () => { queryClient.invalidateQueries(['admin-settings']); toast.success('SEO settings saved'); },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to save'),
  });

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
          <Search className="w-5 h-5 text-blue-600" /> SEO Management
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Optimize your site for search engines. Changes apply to the public homepage.</p>
      </div>

      {/* Meta Tags */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Globe className="w-4 h-4 text-green-600" /> Meta Tags</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Page Title <span className="text-xs text-gray-400">({(formData.meta_title || '').length}/60)</span></label>
          <input {...f('meta_title')} placeholder="Your IPTV Service — Premium Streaming" className={cls} maxLength={70} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meta Description <span className="text-xs text-gray-400">({(formData.meta_description || '').length}/160)</span></label>
          <textarea {...f('meta_description')} placeholder="Premium IPTV subscriptions with thousands of channels. Instant activation, multiple connections, 24/7 support." className={cls} rows={3} maxLength={170} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keywords <span className="text-xs text-gray-400">(comma separated)</span></label>
          <input {...f('meta_keywords')} placeholder="IPTV, streaming, channels, subscription, live TV" className={cls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Favicon URL</label>
          <input {...f('favicon_url')} placeholder="https://yourdomain.com/favicon.ico" className={cls} />
        </div>
        {/* Live Preview */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
          <p className="text-xs text-gray-500 mb-2">Google Search Preview:</p>
          <div className="text-blue-700 text-lg hover:underline cursor-default">{formData.meta_title || 'Your Site Title'}</div>
          <div className="text-green-700 text-sm">{formData.schema_url || 'https://yourdomain.com'}</div>
          <div className="text-sm text-gray-600 line-clamp-2">{formData.meta_description || 'Your meta description will appear here...'}</div>
        </div>
      </section>

      {/* Open Graph / Social */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Share2 className="w-4 h-4 text-blue-500" /> Social Sharing (Open Graph)</h4>
        <p className="text-xs text-gray-500">Controls how your site appears when shared on Facebook, Twitter, Discord, etc.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">OG Title</label>
            <input {...f('og_title')} placeholder="Defaults to Page Title" className={cls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">OG Image URL</label>
            <input {...f('og_image')} placeholder="https://yourdomain.com/og-image.jpg (1200x630px)" className={cls} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">OG Description</label>
          <textarea {...f('og_description')} placeholder="Defaults to Meta Description" className={cls} rows={2} />
        </div>
      </section>

      {/* Schema / Structured Data */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-purple-600" /> Structured Data (Schema.org)</h4>
        <p className="text-xs text-gray-500">Helps search engines understand your business. Generates JSON-LD automatically.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Name</label>
            <input {...f('schema_name')} placeholder="Your IPTV Service" className={cls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website URL</label>
            <input {...f('schema_url')} placeholder="https://yourdomain.com" className={cls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
            <input {...f('schema_phone')} placeholder="+1-555-123-4567" className={cls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Email</label>
            <input {...f('schema_email')} placeholder="support@yourdomain.com" className={cls} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Description</label>
          <textarea {...f('schema_description')} placeholder="Premium IPTV streaming service..." className={cls} rows={2} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo URL</label>
          <input {...f('schema_logo')} placeholder="Defaults to site logo" className={cls} />
        </div>
      </section>

      {/* Analytics */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Code className="w-4 h-4 text-orange-600" /> Analytics & Custom Code</h4>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Analytics ID</label>
            <input {...f('google_analytics_id')} placeholder="G-XXXXXXXXXX" className={cls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Tag Manager ID</label>
            <input {...f('google_tag_manager_id')} placeholder="GTM-XXXXXXX" className={cls} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Robots.txt</label>
          <textarea {...f('robots_txt')} className={`${cls} font-mono`} rows={4} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custom &lt;head&gt; Code</label>
          <textarea {...f('custom_head_code')} placeholder="<!-- Any custom scripts, meta tags, or verification codes -->" className={`${cls} font-mono`} rows={4} />
          <p className="text-xs text-gray-500 mt-1">Injected into the &lt;head&gt; of every page. Use for verification codes, custom fonts, etc.</p>
        </div>
      </section>

      <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
        {saveMutation.isPending ? 'Saving...' : 'Save SEO Settings'}
      </button>
    </div>
  );
}

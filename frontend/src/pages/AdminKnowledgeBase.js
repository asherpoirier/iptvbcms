import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/api';
import api from '../api/api';
import { ArrowLeft, Plus, Edit, Trash2, X, Save, BookOpen, Eye, EyeOff, Search, Image, Video, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminKnowledgeBase() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const contentRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '', content: '', category: 'General', is_published: true, display_order: 0,
  });

  const { data: articles, isLoading } = useQuery({
    queryKey: ['admin-kb'],
    queryFn: async () => {
      const res = await adminAPI.getKBArticles();
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingArticle
      ? adminAPI.updateKBArticle(editingArticle.id, data)
      : adminAPI.createKBArticle(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-kb']);
      closeModal();
      toast.success(editingArticle ? 'Article updated!' : 'Article created!');
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminAPI.deleteKBArticle(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-kb']);
      toast.success('Article deleted');
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingArticle(null);
    setFormData({ title: '', content: '', category: 'General', is_published: true, display_order: 0 });
  };

  const openEdit = (article) => {
    setEditingArticle(article);
    setFormData({
      title: article.title, content: article.content, category: article.category,
      is_published: article.is_published, display_order: article.display_order,
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const handleMediaUpload = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/api/admin/kb/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { url, type } = res.data;
      const tag = type === 'video' ? `[video:${url}]` : `[image:${url}]`;
      const textarea = contentRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const before = formData.content.substring(0, start);
        const after = formData.content.substring(textarea.selectionEnd);
        const newContent = before + (before.length > 0 && !before.endsWith('\n') ? '\n' : '') + tag + '\n' + after;
        setFormData(prev => ({ ...prev, content: newContent }));
      } else {
        setFormData(prev => ({ ...prev, content: prev.content + '\n' + tag + '\n' }));
      }
      toast.success(`${type === 'video' ? 'Video' : 'Image'} uploaded!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const categories = [...new Set((articles || []).map(a => a.category))];
  const filtered = (articles || []).filter(a =>
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const countMedia = (content) => {
    const images = (content.match(/\[image:/g) || []).length;
    const videos = (content.match(/\[video:/g) || []).length;
    return { images, videos };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/admin" className="text-gray-600 dark:text-gray-300 hover:text-blue-600" data-testid="kb-back-link">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Knowledge Base</h1>
              </div>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              data-testid="kb-add-article-btn">
              <Plus className="w-4 h-4" /> Add Article
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search articles..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
            data-testid="kb-search-input" />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{(articles || []).length}</p>
            <p className="text-xs text-gray-500">Total Articles</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <p className="text-2xl font-bold text-green-600">{(articles || []).filter(a => a.is_published).length}</p>
            <p className="text-xs text-gray-500">Published</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <p className="text-2xl font-bold text-amber-600">{categories.length}</p>
            <p className="text-xs text-gray-500">Categories</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No articles yet. Click "Add Article" to get started.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full" data-testid="kb-articles-table">
              <thead>
                <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Media</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((article) => {
                  const media = countMedia(article.content);
                  return (
                    <tr key={article.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3 text-sm text-gray-500">{article.display_order}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{article.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {article.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {media.images > 0 && <span className="flex items-center gap-1 text-xs text-gray-500"><Image className="w-3 h-3" />{media.images}</span>}
                          {media.videos > 0 && <span className="flex items-center gap-1 text-xs text-gray-500"><Video className="w-3 h-3" />{media.videos}</span>}
                          {media.images === 0 && media.videos === 0 && <span className="text-xs text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {article.is_published
                          ? <span className="flex items-center gap-1 text-xs text-green-600"><Eye className="w-3 h-3" /> Published</span>
                          : <span className="flex items-center gap-1 text-xs text-gray-400"><EyeOff className="w-3 h-3" /> Draft</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(article)} className="text-gray-600 hover:text-blue-600 dark:text-gray-400" data-testid={`kb-edit-${article.id}`}>
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => { if (window.confirm('Delete this article?')) deleteMutation.mutate(article.id); }} className="text-gray-600 hover:text-red-600 dark:text-gray-400" data-testid={`kb-delete-${article.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Hidden file inputs */}
      <input type="file" ref={imageInputRef} className="hidden" accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => { if (e.target.files[0]) handleMediaUpload(e.target.files[0]); e.target.value = ''; }} />
      <input type="file" ref={videoInputRef} className="hidden" accept="video/mp4,video/webm,video/ogg"
        onChange={(e) => { if (e.target.files[0]) handleMediaUpload(e.target.files[0]); e.target.value = ''; }} />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingArticle ? 'Edit Article' : 'New Article'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4" data-testid="kb-article-form">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input type="text" value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                  placeholder="e.g. How to Install the APK" required data-testid="kb-title-input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <input type="text" value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                    placeholder="e.g. Setup Guides" list="kb-categories" data-testid="kb-category-input" />
                  <datalist id="kb-categories">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Order</label>
                  <input type="number" value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                    data-testid="kb-order-input" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
                  <div className="flex items-center gap-1">
                    {uploading && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                    <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                      data-testid="kb-upload-image-btn">
                      <Image className="w-3.5 h-3.5" /> Image
                    </button>
                    <button type="button" onClick={() => videoInputRef.current?.click()} disabled={uploading}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                      data-testid="kb-upload-video-btn">
                      <Video className="w-3.5 h-3.5" /> Video
                    </button>
                  </div>
                </div>
                <textarea ref={contentRef} value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={12}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm font-mono"
                  placeholder={"Write article content here.\n\nUse the Image/Video buttons above to embed media.\nTags like [image:/api/uploads/kb/file.jpg] and [video:/api/uploads/kb/file.mp4] will render for customers."}
                  required data-testid="kb-content-input" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_published" checked={formData.is_published}
                  onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                  className="rounded" data-testid="kb-published-checkbox" />
                <label htmlFor="is_published" className="text-sm text-gray-700 dark:text-gray-300">Published (visible to customers)</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 border rounded-lg text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                  data-testid="kb-save-btn">
                  <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Saving...' : 'Save Article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

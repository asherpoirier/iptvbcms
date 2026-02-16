import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/api';
import { ArrowLeft, BookOpen, ChevronRight, Search, ChevronDown } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

function RichContent({ content }) {
  const parts = content.split(/(\[image:[^\]]+\]|\[video:[^\]]+\])/g);
  return (
    <div className="space-y-3">
      {parts.map((part, i) => {
        const imageMatch = part.match(/^\[image:(.+)\]$/);
        if (imageMatch) {
          const src = imageMatch[1].startsWith('http') ? imageMatch[1] : `${API_URL}${imageMatch[1]}`;
          return <img key={i} src={src} alt="" className="rounded-lg max-w-full max-h-[500px] object-contain" data-testid="kb-content-image" loading="lazy" />;
        }
        const videoMatch = part.match(/^\[video:(.+)\]$/);
        if (videoMatch) {
          const src = videoMatch[1].startsWith('http') ? videoMatch[1] : `${API_URL}${videoMatch[1]}`;
          return (
            <video key={i} controls className="rounded-lg max-w-full max-h-[500px]" data-testid="kb-content-video" preload="metadata">
              <source src={src} />
            </video>
          );
        }
        if (!part.trim()) return null;
        return <p key={i} className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{part}</p>;
      })}
    </div>
  );
}

export default function KnowledgeBasePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const { data: articles, isLoading } = useQuery({
    queryKey: ['kb-articles'],
    queryFn: async () => {
      const res = await api.get('/api/kb');
      return res.data;
    },
  });

  const categories = ['All', ...new Set((articles || []).map(a => a.category))];

  const filtered = (articles || []).filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const grouped = filtered.reduce((acc, article) => {
    if (!acc[article.category]) acc[article.category] = [];
    acc[article.category].push(article);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 mb-3" data-testid="kb-page-back">
            <ArrowLeft className="w-5 h-5" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="kb-page-title">Knowledge Base</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Guides, tutorials and helpful articles</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search articles..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm"
              data-testid="kb-page-search" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                data-testid={`kb-filter-${cat}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-500">Loading articles...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No articles found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, categoryArticles]) => (
              <div key={category}>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{category}</h2>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y dark:divide-gray-700">
                  {categoryArticles.map((article) => (
                    <div key={article.id} data-testid={`kb-article-${article.id}`}>
                      <button
                        onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition"
                        data-testid={`kb-article-toggle-${article.id}`}>
                        <span className="text-sm font-medium text-gray-900 dark:text-white pr-4">{article.title}</span>
                        {expandedId === article.id
                          ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        }
                      </button>
                      {expandedId === article.id && (
                        <div className="px-5 pb-5 pt-1" data-testid={`kb-article-content-${article.id}`}>
                          <RichContent content={article.content} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

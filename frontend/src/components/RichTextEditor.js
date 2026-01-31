import React, { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Image, Heading1, Heading2 } from 'lucide-react';

const RichTextEditor = ({ value, onChange, placeholder = "Write your email content here...", height = "300px" }) => {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const insertImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      execCommand('insertImage', url);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className="rich-text-editor border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden" data-testid="rich-text-editor">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Bold"
        >
          <Bold className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Italic"
        >
          <Italic className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Underline"
        >
          <Underline className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        
        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        
        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h1>')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h2>')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        
        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Bullet List"
        >
          <List className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        
        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        
        <button
          type="button"
          onClick={insertLink}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Insert Link"
        >
          <LinkIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          type="button"
          onClick={insertImage}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Insert Image"
        >
          <Image className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        
        <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        
        <select
          onChange={(e) => execCommand('foreColor', e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          defaultValue=""
        >
          <option value="">Text Color</option>
          <option value="#000000">Black</option>
          <option value="#dc2626">Red</option>
          <option value="#2563eb">Blue</option>
          <option value="#16a34a">Green</option>
          <option value="#9333ea">Purple</option>
          <option value="#ea580c">Orange</option>
        </select>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none overflow-auto"
        style={{ minHeight: height, maxHeight: '600px' }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      
      <style>{`
        [contentEditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contentEditable] {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 15px;
          line-height: 1.6;
        }
        [contentEditable] h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 0.67em 0;
        }
        [contentEditable] h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.75em 0;
        }
        [contentEditable] ul, [contentEditable] ol {
          margin: 1em 0;
          padding-left: 2em;
        }
        [contentEditable] a {
          color: #2563eb;
          text-decoration: underline;
        }
        [contentEditable] img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;

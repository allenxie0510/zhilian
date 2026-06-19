import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { Note, NodeType } from '../types';

interface Props {
  onNoteCreated: (note: Note) => void;
  onClose: () => void;
}

export default function NoteEditor({ onNoteCreated, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !content.trim()) {
      setError('标题和内容不能为空');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const note = await api.createNote({
        title: title.trim(),
        content: content.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      });

      // Trigger AI extraction
      try {
        await api.extractEntities(content.trim(), note.id);
      } catch (e) {
        console.warn('AI extraction failed:', e);
      }

      onNoteCreated(note);
      setTitle('');
      setContent('');
      setTags('');
    } catch (e: any) {
      setError(e.message || '保存失败');
    } finally {
      setLoading(false);
    }
  }, [title, content, tags, onNoteCreated]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold">新建笔记</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">&times;</button>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div>
          <label className="block text-sm text-slate-400 mb-1">标题</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="输入笔记标题..."
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex-1 flex flex-col">
          <label className="block text-sm text-slate-400 mb-1">
            内容 <span className="text-slate-500">（支持 Markdown）</span>
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="输入笔记内容...&#10;&#10;支持 Markdown 格式：&#10;# 标题&#10;**加粗** *斜体*&#10;- 列表"
            rows={12}
            className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">
            标签 <span className="text-slate-500">（逗号分隔）</span>
          </label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="如：技术, AI, 笔记"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-700">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg py-2.5 font-medium transition-colors"
        >
          {loading ? '处理中...' : '保存并构建图谱'}
        </button>
      </div>
    </div>
  );
}

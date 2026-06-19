import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { Note } from '../types';

interface Props {
  notes: Note[];
  selectedNoteId: string | null;
  onSelect: (note: Note) => void;
  onRefresh: () => void;
}

export default function Sidebar({ notes, selectedNoteId, onSelect, onRefresh }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Note[] | null>(null);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const results = await api.searchNotes(searchQuery.trim());
      setSearchResults(results);
    } catch {
      // ignore
    }
  }, [searchQuery]);

  const displayedNotes = searchResults ?? notes;

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold mb-3">📝 笔记列表</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="搜索笔记..."
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            🔍
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {displayedNotes.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">
            {searchResults ? '无匹配结果' : '暂无笔记，开始创建吧'}
          </p>
        )}
        {displayedNotes.map(note => (
          <button
            key={note.id}
            onClick={() => onSelect(note)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              note.id === selectedNoteId
                ? 'bg-blue-600/30 border border-blue-500/50'
                : 'hover:bg-slate-800 border border-transparent'
            }`}
          >
            <div className="text-sm font-medium truncate">{note.title || '无标题'}</div>
            <div className="text-xs text-slate-400 mt-1 truncate">
              {note.content.slice(0, 60)}{note.content.length > 60 ? '...' : ''}
            </div>
            <div className="flex gap-1 mt-2">
              {note.tags?.map(tag => (
                <span key={tag} className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-slate-700">
        <button
          onClick={onRefresh}
          className="w-full text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg py-2 transition-colors"
        >
          🔄 刷新列表
        </button>
      </div>
    </div>
  );
}

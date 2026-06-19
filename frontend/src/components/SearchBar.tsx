import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { GraphNode } from '../types';
import { NODE_COLORS, NODE_TYPE_LABELS } from '../types';

interface Props {
  onNodeClick: (node: GraphNode) => void;
}

export default function SearchBar({ onNodeClick }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GraphNode[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const nodes = await api.searchGraphNodes(query.trim());
      setResults(nodes);
      setOpen(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleSelect = (node: GraphNode) => {
    onNodeClick(node);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSearch();
            if (e.key === 'Escape') setOpen(false);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="搜索图谱节点..."
          className="w-64 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm"
        >
          {loading ? '...' : '🔍'}
        </button>
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
          {results.map(node => (
            <button
              key={node.id}
              onClick={() => handleSelect(node)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-left text-sm"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: NODE_COLORS[node.type] }}
              />
              <span className="text-slate-200">{node.name}</span>
              <span className="text-xs text-slate-500 ml-auto">
                {NODE_TYPE_LABELS[node.type]}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && query && results.length === 0 && !loading && (
        <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 p-3 text-sm text-slate-500 text-center">
          无匹配节点
        </div>
      )}
    </div>
  );
}

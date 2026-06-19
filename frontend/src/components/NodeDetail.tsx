import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { GraphNode, GraphData, Note } from '../types';
import { NODE_COLORS, NODE_TYPE_LABELS, RELATION_TYPE_LABELS } from '../types';

interface Props {
  node: GraphNode | null;
  onClose: () => void;
  onNodeClick: (node: GraphNode) => void;
}

export default function NodeDetail({ node, onClose, onNodeClick }: Props) {
  const [neighbors, setNeighbors] = useState<GraphNode[]>([]);
  const [sourceNote, setSourceNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!node) return;
    setLoading(true);
    Promise.all([
      api.getNeighbors(node.id, 1).catch(() => []),
      api.getNote(node.source_note_id).catch(() => null),
    ]).then(([nbrs, note]) => {
      setNeighbors(nbrs);
      setSourceNote(note);
    }).finally(() => setLoading(false));
  }, [node]);

  if (!node) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold">节点详情</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Node info */}
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: NODE_COLORS[node.type] }}
            />
            <h3 className="text-xl font-semibold text-white">{node.name}</h3>
          </div>
          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex justify-between">
              <span>类型</span>
              <span
                className="px-2 py-0.5 rounded text-xs"
                style={{ backgroundColor: NODE_COLORS[node.type] + '30', color: NODE_COLORS[node.type] }}
              >
                {NODE_TYPE_LABELS[node.type]}
              </span>
            </div>
            <div className="flex justify-between">
              <span>节点ID</span>
              <span className="text-slate-500 font-mono text-xs">{node.id}</span>
            </div>
          </div>
        </div>

        {/* Source note */}
        {sourceNote && (
          <div className="bg-slate-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">📄 来源笔记</h4>
            <p className="text-sm font-medium text-white">{sourceNote.title}</p>
            <p className="text-xs text-slate-400 mt-1 line-clamp-3">{sourceNote.content}</p>
          </div>
        )}

        {/* Neighbors */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-slate-300 mb-3">
            🔗 关联节点 ({neighbors.length})
          </h4>
          {loading ? (
            <p className="text-sm text-slate-500">加载中...</p>
          ) : neighbors.length === 0 ? (
            <p className="text-sm text-slate-500">暂无关联节点</p>
          ) : (
            <div className="space-y-1">
              {neighbors.map(n => (
                <button
                  key={n.id}
                  onClick={() => onNodeClick(n)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700 text-left transition-colors"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: NODE_COLORS[n.type] }}
                  />
                  <span className="text-sm text-slate-300">{n.name}</span>
                  <span className="text-xs text-slate-500 ml-auto">
                    {NODE_TYPE_LABELS[n.type]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

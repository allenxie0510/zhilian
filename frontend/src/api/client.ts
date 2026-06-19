/* ── API client for 知链 backend ── */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

import type {
  Note,
  GraphData,
  GraphNode,
  AIExtractResponse,
  QuestionResponse,
  NodeType,
} from '../types';

/* ── Notes ── */

export const api = {
  // Notes
  createNote: (data: { title: string; content: string; type?: string; tags?: string[] }) =>
    request<Note>('/api/notes', { method: 'POST', body: JSON.stringify(data) }),

  getNotes: (limit = 50, offset = 0) =>
    request<Note[]>(`/api/notes?limit=${limit}&offset=${offset}`),

  getNote: (id: string) => request<Note>(`/api/notes/${id}`),

  updateNote: (id: string, data: Partial<Note>) =>
    request<Note>(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteNote: (id: string) =>
    request<{ ok: boolean }>(`/api/notes/${id}`, { method: 'DELETE' }),

  searchNotes: (q: string) =>
    request<Note[]>(`/api/notes/search?q=${encodeURIComponent(q)}`),

  // Graph
  getGraphData: (noteId?: string, nodeType?: NodeType) => {
    const params = new URLSearchParams();
    if (noteId) params.set('note_id', noteId);
    if (nodeType) params.set('node_type', nodeType);
    return request<GraphData>(`/api/graph/data?${params}`);
  },

  getNode: (nodeId: string) => request<GraphNode>(`/api/graph/node/${nodeId}`),

  getNeighbors: (nodeId: string, depth = 1) =>
    request<GraphNode[]>(`/api/graph/node/${nodeId}/neighbors?depth=${depth}`),

  getSubgraph: (nodeId: string, depth = 1) =>
    request<GraphData>(`/api/graph/node/${nodeId}/subgraph?depth=${depth}`),

  searchGraphNodes: (query: string, nodeTypes?: NodeType[]) =>
    request<GraphNode[]>('/api/graph/search', {
      method: 'POST',
      body: JSON.stringify({ query, node_types: nodeTypes || null }),
    }),

  getGraphStats: () => request<Record<string, unknown>>('/api/graph/stats'),

  // AI
  extractEntities: (text: string, noteId: string) =>
    request<AIExtractResponse>('/api/ai/extract', {
      method: 'POST',
      body: JSON.stringify({ text, note_id: noteId }),
    }),

  askQuestion: (question: string) =>
    request<QuestionResponse>('/api/ai/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
};

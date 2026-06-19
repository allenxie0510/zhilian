import { useState, useEffect, useCallback } from 'react';
import { api } from './api/client';
import type { Note, GraphNode, GraphData } from './types';
import Sidebar from './components/Sidebar';
import NoteEditor from './components/NoteEditor';
import GraphView from './components/GraphView';
import NodeDetail from './components/NodeDetail';
import AIAskPanel from './components/AIAskPanel';
import SearchBar from './components/SearchBar';

type Panel = 'editor' | 'detail' | 'ask' | null;

function App() {
  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Graph state
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Panel state
  const [rightPanel, setRightPanel] = useState<Panel>(null);

  // Load initial data
  const loadNotes = useCallback(async () => {
    try {
      const data = await api.getNotes();
      setNotes(data);
    } catch (e) {
      console.error('Failed to load notes:', e);
    }
  }, []);

  const loadGraph = useCallback(async () => {
    try {
      const data = await api.getGraphData();
      setGraphData(data);
    } catch (e) {
      console.error('Failed to load graph:', e);
    }
  }, []);

  useEffect(() => {
    loadNotes();
    loadGraph();
  }, [loadNotes, loadGraph]);

  // Handlers
  const handleNoteCreated = useCallback((note: Note) => {
    setNotes(prev => [note, ...prev]);
    loadGraph();
    setRightPanel(null);
  }, [loadGraph]);

  const handleNoteSelect = useCallback((note: Note) => {
    setSelectedNote(note);
    setSelectedNode(null);
    setRightPanel('detail');
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setRightPanel('detail');
  }, []);

  const handleNewNote = useCallback(() => {
    console.log('[DEBUG] handleNewNote triggered');
    setSelectedNode(null);
    setRightPanel('editor');
  }, []);

  const handleAskPanel = useCallback(() => {
    console.log('[DEBUG] handleAskPanel triggered');
    setRightPanel('ask');
  }, []);

  const handleClosePanel = useCallback(() => {
    setRightPanel(null);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">
            <span className="text-blue-400">知</span>链
            <span className="text-xs text-slate-500 ml-2 font-normal">AI知识图谱</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <SearchBar onNodeClick={handleNodeClick} />

          <button
            onClick={handleNewNote}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            + 新建笔记
          </button>

          <button
            onClick={handleAskPanel}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded-lg text-sm transition-colors"
          >
            🤖 AI问答
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-72 flex-shrink-0">
          <Sidebar
            notes={notes}
            selectedNoteId={selectedNote?.id ?? null}
            onSelect={handleNoteSelect}
            onRefresh={() => { loadNotes(); loadGraph(); }}
          />
        </aside>

        {/* Center - Graph view  */}
        <main className="flex-1 relative">
          {graphData.nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
              <div className="text-center">
                <div className="text-6xl mb-4">🧠</div>
                <h2 className="text-xl font-semibold text-slate-300 mb-2">欢迎使用知链</h2>
                <p className="text-slate-500 mb-6 max-w-md">
                  点击 <span className="text-blue-400 font-medium">+ 新建笔记</span> 开始，
                  AI将自动从你的内容中抽取知识并构建可视化图谱。
                </p>
                <div className="flex gap-3 justify-center text-sm text-slate-600">
                  <div className="bg-slate-800 rounded-lg px-4 py-2">
                    ✍️ 写笔记 → 🤖 AI分析 → 🗺️ 生成图谱
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <GraphView
              data={graphData}
              onNodeClick={handleNodeClick}
              selectedNodeId={selectedNode?.id}
            />
          )}
        </main>

        {/* Right panel */}
        {rightPanel && (
          <aside className="w-80 flex-shrink-0 bg-slate-900 border-l border-slate-700">
            {rightPanel === 'editor' && (
              <NoteEditor onNoteCreated={handleNoteCreated} onClose={handleClosePanel} />
            )}
            {rightPanel === 'detail' && selectedNode && (
              <NodeDetail
                node={selectedNode}
                onClose={handleClosePanel}
                onNodeClick={handleNodeClick}
              />
            )}
            {rightPanel === 'detail' && !selectedNode && selectedNote && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">笔记详情</h2>
                  <button onClick={handleClosePanel} className="text-slate-400 hover:text-white text-xl">&times;</button>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">{selectedNote.title}</h3>
                <div className="text-xs text-slate-400 mb-3">
                  更新于 {new Date(selectedNote.updated_at).toLocaleString('zh-CN')}
                </div>
                <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed markdown-body">
                  {selectedNote.content}
                </div>
                {selectedNote.tags.length > 0 && (
                  <div className="flex gap-1 mt-4 flex-wrap">
                    {selectedNote.tags.map(tag => (
                      <span key={tag} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {rightPanel === 'ask' && <AIAskPanel />}
          </aside>
        )}
      </div>
    </div>
  );
}

export default App;

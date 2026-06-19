import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { QuestionResponse } from '../types';

export default function AIAskPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  const handleAsk = useCallback(async () => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setLoading(true);
    setAnswer('');
    try {
      const resp = await api.askQuestion(q);
      setAnswer(resp.answer);
      setSources(resp.sources);
      setHistory(prev => [...prev, { q, a: resp.answer }]);
    } catch (e: any) {
      setAnswer('抱歉，问答服务暂时不可用：' + (e.message || ''));
    } finally {
      setLoading(false);
      setQuestion('');
    }
  }, [question, loading]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold">🤖 AI 问答</h2>
        <p className="text-xs text-slate-500 mt-1">基于知识图谱的智能问答（配置LLM后可用）</p>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {history.length === 0 && !answer && (
          <div className="text-center text-slate-500 py-8">
            <p className="text-3xl mb-2">💡</p>
            <p className="text-sm">尝试问一些关于你笔记的问题</p>
            <p className="text-xs text-slate-600 mt-1">例如："我记录过哪些技术概念？"</p>
          </div>
        )}

        {history.map((item, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-blue-400 text-sm mt-0.5">👤</span>
              <div className="bg-blue-600/20 rounded-lg px-3 py-2 text-sm text-blue-200">
                {item.q}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400 text-sm mt-0.5">🤖</span>
              <div className="bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 flex-1">
                {item.a}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <span className="text-green-400 text-sm mt-0.5">🤖</span>
            <div className="bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-500">
              <span className="animate-pulse">思考中...</span>
            </div>
          </div>
        )}

        {answer && !loading && history.length === 0 && (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-blue-400 text-sm mt-0.5">👤</span>
              <div className="bg-blue-600/20 rounded-lg px-3 py-2 text-sm text-blue-200">
                {question}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400 text-sm mt-0.5">🤖</span>
              <div className="bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 flex-1">
                {answer}
              </div>
            </div>
          </div>
        )}

        {sources.length > 0 && (
          <div className="text-xs text-slate-500">
            📎 参考节点：{sources.length} 个
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAsk()}
            placeholder="向知识图谱提问..."
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

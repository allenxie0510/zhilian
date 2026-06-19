/* ── Shared types for 知链 frontend ── */

export type NodeType = 'concept' | 'person' | 'project' | 'note' | 'topic';

export type RelationType =
  | 'belongs_to'
  | 'depends_on'
  | 'references'
  | 'similar_to'
  | 'derives_from';

export type NoteKind = 'text' | 'doc' | 'link';

export interface Note {
  id: string;
  title: string;
  content: string;
  type: NoteKind;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface GraphNode {
  id: string;
  name: string;
  type: NodeType;
  source_note_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  source_note_id: string;
  confidence: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: Relation[];
}

export interface AIEntity {
  name: string;
  type: NodeType;
}

export interface AIRelation {
  source: string;
  target: string;
  type: RelationType;
}

export interface AIExtractResponse {
  entities: AIEntity[];
  relations: AIRelation[];
}

export interface QuestionResponse {
  answer: string;
  sources: string[];
}

/* ── Color mapping for node types ── */

export const NODE_COLORS: Record<NodeType, string> = {
  concept: '#3b82f6',
  person: '#f59e0b',
  project: '#10b981',
  note: '#8b5cf6',
  topic: '#ef4444',
};

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  concept: '概念',
  person: '人物',
  project: '项目/工具',
  note: '笔记',
  topic: '主题',
};

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  belongs_to: '属于',
  depends_on: '依赖',
  references: '引用',
  similar_to: '相似',
  derives_from: '派生',
};

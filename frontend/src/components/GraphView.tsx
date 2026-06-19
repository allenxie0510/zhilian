import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { GraphData, GraphNode, NodeType, RelationType } from '../types';
import { NODE_COLORS, NODE_TYPE_LABELS, RELATION_TYPE_LABELS } from '../types';

cytoscape.use(dagre);

interface Props {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  selectedNodeId?: string | null;
}

type ViewMode = 'hierarchy' | 'network' | 'radial';

/* ── Helpers ──────────────────────────────────────── */

function computeDegrees(data: GraphData): Map<string, number> {
  const deg = new Map<string, number>();
  for (const n of data.nodes) deg.set(n.id, 0);
  for (const e of data.edges) {
    deg.set(e.source, (deg.get(e.source) || 0) + 1);
    deg.set(e.target, (deg.get(e.target) || 0) + 1);
  }
  return deg;
}

function nodeSize(degree: number, maxDegree: number): number {
  if (maxDegree <= 1) return 36;
  const ratio = degree / maxDegree;
  // Map to 24–52px range
  return Math.round(24 + ratio * 28);
}

function fontSize(degree: number, maxDegree: number): number {
  if (maxDegree <= 1) return 12;
  const ratio = degree / maxDegree;
  return Math.round(10 + ratio * 6);
}

const EDGE_STYLES: Record<string, { color: string; dash: number[] | undefined; width: number }> = {
  belongs_to:  { color: '#a78bfa', dash: undefined, width: 2.5 },
  depends_on:  { color: '#f87171', dash: [6, 3], width: 2 },
  references:  { color: '#60a5fa', dash: [4, 4], width: 1.5 },
  similar_to:  { color: '#34d399', dash: [2, 4], width: 1.5 },
  derives_from:{ color: '#fbbf24', dash: [8, 3, 2, 3], width: 2 },
};

export default function GraphView({ data, onNodeClick, selectedNodeId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('hierarchy');
  const [activeTypes, setActiveTypes] = useState<Set<NodeType>>(
    new Set(['concept', 'person', 'project', 'topic', 'note'])
  );
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const degrees = useMemo(() => computeDegrees(data), [data]);
  const maxDegree = useMemo(
    () => Math.max(1, ...Array.from(degrees.values())),
    [degrees]
  );

  // ── Filter data ──────────────────
  const filteredData = useMemo(() => {
    const filteredNodes = data.nodes.filter(n => activeTypes.has(n.type));
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = data.edges.filter(
      e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [data, activeTypes]);

  // ── Initialize cytoscape ──────────

  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: [
        // Base node
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#f1f5f9',
            'font-size': 'data(fontSize)',
            'font-weight': 'bold',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 6,
            'text-wrap': 'wrap',
            'text-max-width': '140px',
            'text-outline-width': 3,
            'text-outline-color': '#0f172a',
            'text-outline-opacity': 0.85,
            'width': 'data(size)',
            'height': 'data(size)',
            'border-width': 2,
            'border-color': '#1e293b',
            'transition-property': 'width, height, font-size',
            'transition-duration': 300,
          },
        },
        // Base edge
        {
          selector: 'edge',
          style: {
            'width': 'data(edgeWidth)',
            'line-color': 'data(edgeColor)',
            'target-arrow-color': 'data(edgeColor)',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.7,
            'curve-style': 'bezier',
            'label': 'data(label)',
            'color': '#64748b',
            'font-size': '7px',
            'text-rotation': 'autorotate',
            'text-opacity': 0.6,
            'text-outline-width': 2,
            'text-outline-color': '#0f172a',
            'text-outline-opacity': 0.7,
          },
        },
        // Selected
        {
          selector: 'node:selected',
          style: {
            'border-color': '#fbbf24',
            'border-width': 3,
          },
        },
        // Highlighted
        {
          selector: 'node.highlighted',
          style: {
            'border-color': '#fbbf24',
            'border-width': 4,
            'z-index': 999,
          },
        },
        // Dimmed
        { selector: 'node.dimmed', style: { 'opacity': 0.15 } },
        { selector: 'edge.dimmed', style: { 'opacity': 0.05 } },
        {
          selector: 'node.neighbor-highlight',
          style: { 'border-color': '#60a5fa', 'border-width': 2, 'z-index': 100 },
        },
        {
          selector: 'edge.neighbor-highlight',
          style: { 'opacity': 0.8, 'z-index': 99 },
        },
        // Color by type
        ...Object.entries(NODE_COLORS).map(([type, color]) => ({
          selector: `node[type="${type}"]`,
          style: { 'background-color': color },
        })),
        // Edge styles by type
        ...Object.entries(EDGE_STYLES).map(([type, s]) => ({
          selector: `edge[relType="${type}"]`,
          style: {
            'line-color': s.color,
            'target-arrow-color': s.color,
          },
        })),
        // Dashed edges (depends_on, similar_to, derives_from)
        {
          selector: 'edge[isDashed]',
          style: { 'line-style': 'dashed' },
        },
      ],
      wheelSensitivity: 0.4,
      minZoom: 0.06,
      maxZoom: 4,
      pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1,
    });

    // Events
    cy.on('tap', 'node', (evt: cytoscape.EventObject) => {
      const nd = evt.target.data();
      onNodeClick({
        id: nd.id, name: nd.name, type: nd.type as NodeType,
        source_note_id: nd.sourceNoteId, created_at: nd.createdAt || '', metadata: {},
      });
    });

    cy.on('mouseover', 'node', (evt: cytoscape.EventObject) => {
      const nd = evt.target.data();
      const pos = evt.target.renderedPosition();
      setHoveredNode({
        id: nd.id, name: nd.name, type: nd.type as NodeType,
        source_note_id: nd.sourceNoteId, created_at: nd.createdAt || '', metadata: {},
      });
      setHoverPos({ x: pos.x, y: pos.y });
    });

    cy.on('mouseout', 'node', () => setHoveredNode(null));

    // Double-click focus
    cy.on('dbltap', 'node', (evt: cytoscape.EventObject) => {
      const node = evt.target;
      const neighbors = node.closedNeighborhood();
      cy.elements().difference(neighbors).addClass('dimmed');
      neighbors.removeClass('dimmed');
      neighbors.nodes().addClass('neighbor-highlight');
      neighbors.edges().addClass('neighbor-highlight');
      cy.animate({
        center: { eles: neighbors },
        zoom: Math.min(cy.zoom() * 1.6, 3),
        duration: 400,
      });
    });

    cy.on('tap', (evt: cytoscape.EventObject) => {
      if (evt.target === cy) {
        cy.elements().removeClass('dimmed neighbor-highlight');
      }
    });

    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update graph data ─────────────

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || filteredData.nodes.length === 0) return;

    cy.elements().remove();

    const elements: cytoscape.ElementDefinition[] = [];

    // Nodes
    for (const node of filteredData.nodes) {
      const deg = degrees.get(node.id) || 0;
      const sz = nodeSize(deg, maxDegree);
      const fs = fontSize(deg, maxDegree);
      const displayName = node.name.length > 16 ? node.name.slice(0, 16) + '…' : node.name;

      elements.push({
        data: {
          id: node.id,
          label: displayName,
          name: node.name,
          type: node.type,
          sourceNoteId: node.source_note_id,
          createdAt: node.created_at,
          size: sz,
          fontSize: fs,
          degree: deg,
        },
      });
    }

    // Edges
    for (const edge of filteredData.edges) {
      const relLabel = RELATION_TYPE_LABELS[edge.type] || edge.type;
      const style = EDGE_STYLES[edge.type] || EDGE_STYLES.references;
      elements.push({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: relLabel,
          relType: edge.type,
          edgeColor: style.color,
          edgeWidth: style.width,
          isDashed: !!style.dash,
        },
      });
    }

    cy.add(elements);
    runLayout(cy, viewMode);

    // Auto-fit after layout settles
    cy.one('layoutstop', () => {
      cy.fit(undefined, 50);
    });
  }, [filteredData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Layout runner ─────────────────

  const runLayout = useCallback((cy: cytoscape.Core, mode: ViewMode) => {
    if (mode === 'hierarchy') {
      // Build parent-child edges for hierarchy
      const hierarchicalEdges: { src: string; tgt: string }[] = [];
      for (const e of filteredData.edges) {
        if (e.type === 'belongs_to' || e.type === 'derives_from') {
          hierarchicalEdges.push({ src: e.source, tgt: e.target });
        }
      }

      if (hierarchicalEdges.length > 0) {
        // Use dagre for hierarchical relationships
        try {
          cy.layout({
            name: 'dagre',
            rankDir: 'TB',       // top → bottom
            align: 'UL',
            ranker: 'network-simplex',
            nodeSep: 60,
            edgeSep: 20,
            rankSep: 80,
            animate: true,
            animationDuration: 1000,
            animationEasing: 'ease-in-out-cubic',
            // Only layout nodes in hierarchy; others use cose
          } as any).run();
          return;
        } catch { /* fall through */ }
      }
    }

    if (mode === 'radial') {
      // Find center node (highest degree)
      const centerId = Array.from(degrees.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      cy.layout({
        name: 'concentric',
        concentric: (node: any) => {
          if (node.data('id') === centerId) return 1;
          const deg = node.data('degree') || 0;
          return Math.max(2, 6 - deg);  // closer to center = more connections
        },
        minNodeSpacing: 50,
        animate: true,
        animationDuration: 1000,
      } as any).run();
      return;
    }

    // Default: cose network
    cy.layout({
      name: 'cose',
      animate: true,
      animationDuration: 1200,
      animationEasing: 'ease-in-out-cubic',
      nodeRepulsion: () => 5000,
      idealEdgeLength: () => 100,
      gravity: 0.15,
      numIter: 2000,
      componentSpacing: 100,
    }).run();
  }, [filteredData.edges, degrees]);

  // ── View mode switcher ────────────

  const switchView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass('dimmed neighbor-highlight');
    runLayout(cy, mode);
    cy.one('layoutstop', () => cy.fit(undefined, 50));
  }, [runLayout]);

  // ── Highlight selected node ───────

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass('highlighted dimmed neighbor-highlight');
    if (selectedNodeId) {
      const node = cy.getElementById(selectedNodeId);
      if (node.length) {
        node.addClass('highlighted');
        const neighbors = node.closedNeighborhood();
        cy.elements().difference(neighbors).addClass('dimmed');
        neighbors.removeClass('dimmed');
        neighbors.nodes().addClass('neighbor-highlight');
        neighbors.edges().addClass('neighbor-highlight');
        cy.animate({
          center: { eles: neighbors },
          zoom: Math.min(cy.zoom() * 1.5, 2.5),
          duration: 500,
        });
      }
    }
  }, [selectedNodeId]);

  // ── Toolbar ───────────────────────

  const toggleType = (type: NodeType) => {
    const next = new Set(activeTypes);
    if (next.has(type)) {
      if (next.size > 1) next.delete(type);
    } else {
      next.add(type);
    }
    setActiveTypes(next);
  };

  return (
    <div className="graph-container relative">
      <div ref={containerRef} className="w-full h-full" />

      {/* ── Top bar: view modes + filters ── */}
      <div className="absolute top-3 left-3 right-3 flex items-center gap-2 flex-wrap pointer-events-none">
        {/* View mode buttons */}
        <div className="flex rounded-lg overflow-hidden border border-slate-600 bg-slate-800/90 backdrop-blur pointer-events-auto">
          {([
            ['hierarchy', '📐 层级'],
            ['network', '🕸️ 网络'],
            ['radial', '🎯 径向'],
          ] as [ViewMode, string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => switchView(m)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === m
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div className="flex gap-1.5 pointer-events-auto flex-1 justify-end">
          {(Object.keys(NODE_TYPE_LABELS) as NodeType[]).map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all border ${
                activeTypes.has(type)
                  ? 'border-current text-white'
                  : 'border-transparent text-slate-600 opacity-40 hover:opacity-70'
              }`}
              style={{
                backgroundColor: activeTypes.has(type)
                  ? (NODE_COLORS[type] + '30')
                  : 'transparent',
                borderColor: activeTypes.has(type) ? NODE_COLORS[type] + '80' : 'transparent',
              }}
            >
              {NODE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur rounded-lg px-3 py-2 text-xs text-slate-400 pointer-events-none">
        {filteredData.nodes.length} 节点 · {filteredData.edges.length} 关联
      </div>

      {/* ── Hover tooltip ── */}
      {hoveredNode && (
        <div
          className="absolute z-50 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none"
          style={{
            left: hoverPos.x + 15,
            top: hoverPos.y - 15,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: NODE_COLORS[hoveredNode.type] }}
            />
            <span className="text-white font-medium">{hoveredNode.name}</span>
          </div>
          <div className="text-slate-400 mt-1">
            {NODE_TYPE_LABELS[hoveredNode.type]} · 连接数 {degrees.get(hoveredNode.id) || 0}
          </div>
        </div>
      )}

      {/* ── Toolbar (right) ── */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        {(['+', '−', '⊡', '↻'] as const).map((icon, i) => (
          <button
            key={icon}
            onClick={() => {
              const cy = cyRef.current; if (!cy) return;
              if (i === 0) cy.animate({ zoom: Math.min(cy.zoom() * 1.3, 4), duration: 200 });
              else if (i === 1) cy.animate({ zoom: Math.max(cy.zoom() / 1.3, 0.06), duration: 200 });
              else if (i === 2) { cy.elements().removeClass('dimmed neighbor-highlight'); cy.fit(undefined, 50); }
              else { cy.elements().removeClass('dimmed neighbor-highlight'); runLayout(cy, viewMode); cy.one('layoutstop', () => cy.fit(undefined, 50)); }
            }}
            className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-lg text-white text-lg flex items-center justify-center backdrop-blur transition-colors"
            title={['放大', '缩小', '适应画布', '重新布局'][i]}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* ── Legend ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur rounded-lg px-3 py-1.5 flex items-center gap-3 text-[10px] text-slate-500">
        <span>💡 滚轮缩放 · 拖拽平移 · 双击聚焦</span>
        <span className="text-slate-600">|</span>
        {Object.entries(EDGE_STYLES).slice(0, 3).map(([type, s]) => (
          <span key={type} className="flex items-center gap-1">
            <svg width="16" height="2">
              <line x1="0" y1="1" x2="16" y2="1"
                stroke={s.color} strokeWidth={s.width}
                strokeDasharray={s.dash?.join(',') || 'none'}
              />
            </svg>
            {RELATION_TYPE_LABELS[type as RelationType]}
          </span>
        ))}
      </div>
    </div>
  );
}

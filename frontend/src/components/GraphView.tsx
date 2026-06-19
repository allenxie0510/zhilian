import { useEffect, useRef, useCallback } from 'react';
import cytoscape from 'cytoscape';
import type { GraphData, GraphNode, NodeType } from '../types';
import { NODE_COLORS, NODE_TYPE_LABELS, RELATION_TYPE_LABELS } from '../types';

interface Props {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  selectedNodeId?: string | null;
}

/* ── Adaptive sizing ──────────────────────────────── */

function nodeSize(nodeCount: number): number {
  if (nodeCount <= 10) return 42;
  if (nodeCount <= 30) return 36;
  if (nodeCount <= 60) return 30;
  return 24;
}

function edgeLength(nodeCount: number): number {
  if (nodeCount <= 10) return 200;
  if (nodeCount <= 30) return 160;
  if (nodeCount <= 60) return 130;
  return 100;
}

function repulsion(nodeCount: number): number {
  if (nodeCount <= 10) return 8000;
  if (nodeCount <= 30) return 6000;
  if (nodeCount <= 60) return 4000;
  return 3000;
}

/* ── Component ─────────────────────────────────────── */

export default function GraphView({ data, onNodeClick, selectedNodeId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const nSize = nodeSize(data.nodes.length);
  const eLen = edgeLength(data.nodes.length);
  const rep = repulsion(data.nodes.length);
  const fontSize = Math.max(10, nSize * 0.28);

  // ── Initialize cytoscape ──────

  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#475569',
            'label': 'data(label)',
            'color': '#e2e8f0',
            'font-size': `${fontSize}px`,
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'width': nSize,
            'height': nSize,
            'border-width': 2,
            'border-color': '#1e293b',
            // Subtle glow
            'shadow-blur': 6,
            'shadow-color': '#00000040',
            'shadow-opacity': 0.3,
            'transition-property': 'width, height, font-size, border-width',
            'transition-duration': 200,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.8,
            'curve-style': 'bezier',
            'label': 'data(label)',
            'color': '#64748b',
            'font-size': '8px',
            'text-rotation': 'autorotate',
            'text-opacity': 0.7,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#fbbf24',
            'border-width': 4,
          },
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-color': '#fbbf24',
            'border-width': 4,
            'z-index': 999,
            'shadow-blur': 16,
            'shadow-color': '#fbbf24',
            'shadow-opacity': 0.5,
          },
        },
        // Dim non-neighbor nodes when highlighted
        {
          selector: 'node.dimmed',
          style: {
            'opacity': 0.25,
          },
        },
        {
          selector: 'edge.dimmed',
          style: {
            'opacity': 0.1,
          },
        },
        {
          selector: 'node.neighbor-highlight',
          style: {
            'border-color': '#60a5fa',
            'border-width': 2,
            'z-index': 100,
          },
        },
        // Color nodes by type
        ...Object.entries(NODE_COLORS).map(([type, color]) => ({
          selector: `node[type="${type}"]`,
          style: { 'background-color': color },
        })),
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 1200,
        animationEasing: 'ease-in-out-cubic',
        nodeRepulsion: () => rep,
        idealEdgeLength: () => eLen,
        gravity: 0.2,
        numIter: 2000,
        // Spread disconnected components
        componentSpacing: 80,
      },
      wheelSensitivity: 0.4,
      minZoom: 0.08,
      maxZoom: 4,
      // Pixel ratio for sharp rendering
      pixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1,
    });

    // ── Event handlers ──

    // Click node
    cy.on('tap', 'node', (evt: cytoscape.EventObject) => {
      const nodeData = evt.target.data();
      onNodeClick({
        id: nodeData.id,
        name: nodeData.name || nodeData.label,
        type: nodeData.type as NodeType,
        source_note_id: nodeData.sourceNoteId,
        created_at: nodeData.createdAt || '',
        metadata: {},
      });
    });

    // Double-click to focus
    cy.on('dbltap', 'node', (evt: cytoscape.EventObject) => {
      const node = evt.target;
      const neighbors = node.closedNeighborhood();
      // Dim everything else
      cy.elements().difference(neighbors).addClass('dimmed');
      neighbors.removeClass('dimmed');
      neighbors.nodes().addClass('neighbor-highlight');
      cy.animate({
        center: { eles: neighbors },
        zoom: Math.min(cy.zoom() * 1.8, 2.5),
        duration: 400,
      });
    });

    // Click background to clear dim
    cy.on('tap', (evt: cytoscape.EventObject) => {
      if (evt.target === cy) {
        cy.elements().removeClass('dimmed neighbor-highlight');
      }
    });

    // Auto-fit after layout
    cy.on('layoutstop', () => {
      cy.fit(undefined, 60);
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update graph data ──────────

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || data.nodes.length === 0) return;

    // Remove old
    cy.elements().remove();

    // Build elements
    const elements: cytoscape.ElementDefinition[] = [];

    for (const node of data.nodes) {
      const displayName = node.name.length > 18 ? node.name.slice(0, 18) + '…' : node.name;
      elements.push({
        data: {
          id: node.id,
          label: displayName,
          name: node.name,
          type: node.type,
          sourceNoteId: node.source_note_id,
          createdAt: node.created_at,
        },
      });
    }

    for (const edge of data.edges) {
      const relLabel = RELATION_TYPE_LABELS[edge.type] || edge.type;
      elements.push({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: relLabel,
          type: edge.type,
        },
      });
    }

    cy.add(elements);

    // Run constrained layout — more spacing for fewer nodes
    const layout = cy.layout({
      name: 'cose',
      animate: true,
      animationDuration: 1200,
      animationEasing: 'ease-in-out-cubic',
      nodeRepulsion: () => rep,
      idealEdgeLength: () => eLen,
      gravity: 0.2,
      numIter: 2000,
      componentSpacing: 80,
    });

    // Auto-fit once layout settles
    layout.one('layoutstop', () => {
      cy.fit(undefined, 60);
    });

    layout.run();
  }, [data, rep, eLen]);

  // ── Highlight selected node ────

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
        cy.animate({
          center: { eles: neighbors },
          zoom: Math.min(cy.zoom() * 1.6, 2.5),
          duration: 500,
        });
      }
    }
  }, [selectedNodeId]);

  // ── Toolbar ────────────────────

  const handleZoomIn = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({ zoom: Math.min(cy.zoom() * 1.3, 4), duration: 200 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({ zoom: Math.max(cy.zoom() / 1.3, 0.08), duration: 200 });
  }, []);

  const handleFit = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass('dimmed neighbor-highlight');
    cy.animate({ fit: { eles: cy.elements(), padding: 60 }, duration: 400 });
  }, []);

  const handleReset = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass('dimmed neighbor-highlight');
    const layout = cy.layout({
      name: 'cose',
      animate: true,
      animationDuration: 1000,
      nodeRepulsion: () => rep,
      idealEdgeLength: () => eLen,
      gravity: 0.2,
      numIter: 2000,
      componentSpacing: 80,
    });
    layout.one('layoutstop', () => cy.fit(undefined, 60));
    layout.run();
  }, [rep, eLen]);

  return (
    <div className="graph-container relative">
      <div ref={containerRef} className="w-full h-full" />

      {/* Toolbar */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-lg text-white text-xl flex items-center justify-center backdrop-blur transition-colors"
          title="放大"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-lg text-white text-xl flex items-center justify-center backdrop-blur transition-colors"
          title="缩小"
        >
          −
        </button>
        <button
          onClick={handleFit}
          className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center justify-center backdrop-blur transition-colors"
          title="适应画布"
        >
          ⊡
        </button>
        <button
          onClick={handleReset}
          className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center justify-center backdrop-blur transition-colors"
          title="重新布局"
        >
          ↻
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur rounded-lg p-3 text-xs">
        <div className="font-medium mb-2 text-slate-300">图例</div>
        {Object.entries(NODE_TYPE_LABELS).map(([type, label]) => (
          <div key={type} className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: NODE_COLORS[type as NodeType] }}
            />
            <span className="text-slate-400">{label}</span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-slate-700 text-slate-500 text-[10px]">
          💡 双击节点聚焦 · 滚轮缩放
        </div>
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur rounded-lg px-3 py-2 text-xs text-slate-400">
        {data.nodes.length} 节点 · {data.edges.length} 关联
      </div>
    </div>
  );
}

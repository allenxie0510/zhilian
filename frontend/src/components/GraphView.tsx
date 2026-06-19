import { useEffect, useRef, useCallback } from 'react';
import cytoscape from 'cytoscape';
import type { GraphData, GraphNode, NodeType } from '../types';
import { NODE_COLORS, NODE_TYPE_LABELS, RELATION_TYPE_LABELS } from '../types';

interface Props {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  selectedNodeId?: string | null;
}

export default function GraphView({ data, onNodeClick, selectedNodeId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Initialize cytoscape
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
            'font-size': '11px',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'text-wrap': 'wrap',
            'text-max-width': '100px',
            'width': 20,
            'height': 20,
            'border-width': 2,
            'border-color': '#1e293b',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'color': '#64748b',
            'font-size': '9px',
            'text-rotation': 'autorotate',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#fbbf24',
            'border-width': 3,
          },
        },
        {
          selector: 'node.highlighted',
          style: {
            'border-color': '#fbbf24',
            'border-width': 3,
            'z-index': 999,
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
        animationDuration: 1000,
        nodeRepulsion: () => 4000,
        idealEdgeLength: () => 120,
        gravity: 0.25,
        numIter: 1000,
      },
      wheelSensitivity: 0.3,
      minZoom: 0.1,
      maxZoom: 3,
    });

    // Click handler
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

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update graph data
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Build elements
    const elements: cytoscape.ElementDefinition[] = [];

    for (const node of data.nodes) {
      elements.push({
        data: {
          id: node.id,
          label: node.name.length > 15 ? node.name.slice(0, 15) + '…' : node.name,
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

    cy.elements().remove();
    cy.add(elements);

    // Run layout
    const layout = cy.layout({
      name: 'cose',
      animate: true,
      animationDuration: 800,
      nodeRepulsion: () => 4000,
      idealEdgeLength: () => 120,
      gravity: 0.25,
      numIter: 1000,
    });
    layout.run();
  }, [data]);

  // Highlight selected node
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.nodes().removeClass('highlighted');
    if (selectedNodeId) {
      const node = cy.getElementById(selectedNodeId);
      if (node.length) {
        node.addClass('highlighted');
        cy.animate({
          center: { eles: node },
          zoom: 1.5,
          duration: 500,
        });
      }
    }
  }, [selectedNodeId]);

  // Toolbar actions
  const handleZoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  }, []);

  const handleZoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() / 1.2);
  }, []);

  const handleFit = useCallback(() => {
    cyRef.current?.fit(undefined, 50);
  }, []);

  const handleReset = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.fit(undefined, 50);
    const layout = cy.layout({
      name: 'cose',
      animate: true,
      animationDuration: 800,
      nodeRepulsion: () => 4000,
      idealEdgeLength: () => 120,
    });
    layout.run();
  }, []);

  return (
    <div className="graph-container relative">
      <div ref={containerRef} className="w-full h-full" />

      {/* Toolbar */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-lg text-white text-xl flex items-center justify-center backdrop-blur"
          title="放大"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-lg text-white text-xl flex items-center justify-center backdrop-blur"
          title="缩小"
        >
          −
        </button>
        <button
          onClick={handleFit}
          className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center justify-center backdrop-blur"
          title="适应画布"
        >
          ⊡
        </button>
        <button
          onClick={handleReset}
          className="w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-lg text-white text-sm flex items-center justify-center backdrop-blur"
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
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur rounded-lg px-3 py-2 text-xs text-slate-400">
        {data.nodes.length} 节点 · {data.edges.length} 关联
      </div>
    </div>
  );
}

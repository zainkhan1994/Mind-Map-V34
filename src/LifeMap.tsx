import React, { useMemo, useState } from "react";
import { rawNodes } from "./data";

function ChevronDown({ size = 12 }) {
  return <span style={{ fontSize: size, lineHeight: 1 }}>▼</span>;
}

function ChevronRight({ size = 12 }) {
  return <span style={{ fontSize: size, lineHeight: 1 }}>▶</span>;
}

function NetworkIcon() {
  return <span className="inline mr-1">◇</span>;
}

function CalendarIcon() {
  return <span className="inline mr-1">□</span>;
}

function ZoomInIcon() {
  return <span className="inline mr-1">🔍+</span>;
}

function ZoomOutIcon() {
  return <span className="inline mr-1">🔍−</span>;
}

const palette: Record<string, string> = {
  black: "bg-black text-white border-black",
  red: "bg-red-500 text-white border-red-500",
  green: "bg-green-800 text-white border-green-800",
  yellow: "bg-yellow-300 text-black border-yellow-300",
  blue: "bg-blue-600 text-white border-blue-600",
  purple: "bg-purple-600 text-white border-purple-600",
  default: "bg-black text-white border-black",
};
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

const clampZoom = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded));
};

interface TreeNode {
  uid: string;
  id: number;
  name: string;
  description: string;
  type: "folder" | "file";
  parentUid: string | null;
  color?: string;
  children: TreeNode[];
}

function buildTree(nodes: any[]): TreeNode[] {
  const map = new Map(nodes.map((n) => [n.uid, { ...n, children: [] }]));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parentUid === null || !map.has(node.parentUid)) roots.push(node);
    else map.get(node.parentUid).children.push(node);
  });
  return roots;
}

function collectIds(node: TreeNode): string[] {
  return [node.uid, ...node.children.flatMap(collectIds)];
}

interface SquareNodeProps {
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  toggle: (id: string) => void;
  locked: Set<string>;
  toggleLock: (id: string) => void;
  onNodeRef: (uid: string, element: HTMLDivElement | null) => void;
  drawingMode: boolean;
  onNodeSelect: (uid: string) => void;
  selectedForConnection: string | null;
}

function SquareNode({ node, depth, collapsed, toggle, locked, toggleLock, onNodeRef, drawingMode, onNodeSelect, selectedForConnection }: SquareNodeProps) {
  const hasChildren = node.children.length > 0;
  const colorClass = palette[node.color as keyof typeof palette] || palette.default;
  const isLocked = locked.has(node.uid);
  const isSelected = selectedForConnection === node.uid;
  
  const minWidth = 70;
  const minHeight = 50;
  const fontSize = 10;
  const gap = 4;
  
  return (
    <div className="flex flex-col items-center relative" ref={(el) => onNodeRef(node.uid, el)}>
      {depth > 0 && <div className="h-8 w-px bg-slate-300" style={{ height: `${8 + gap * 2}px` }} />}
      <div className="relative group">
        <button
          onClick={() => hasChildren && toggle(node.uid)}
          className={`rounded-lg border shadow-sm px-3 py-2 font-bold uppercase tracking-tight flex items-center justify-center gap-1 transition-all hover:shadow-lg ${colorClass} ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
          style={{ 
            minWidth: `${minWidth}px`, 
            minHeight: `${minHeight}px`,
            fontSize: `${fontSize}px`,
            opacity: drawingMode ? 0.8 : 1,
            cursor: drawingMode ? 'pointer' : 'default'
          }}
          title={node.description}
          onMouseDown={() => drawingMode && onNodeSelect(node.uid)}
        >
          {hasChildren ? collapsed.has(node.uid) ? <ChevronRight size={12} /> : <ChevronDown size={12} /> : null}
          <span>{node.name}</span>
        </button>
        
        {/* Lock Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleLock(node.uid);
          }}
          className={`absolute -top-2 -right-2 w-5 h-5 rounded-full text-xs flex items-center justify-center transition-all ${
            isLocked 
              ? 'bg-amber-500 text-white' 
              : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
          }`}
          title={isLocked ? "Unlock node" : "Lock node"}
        >
          {isLocked ? '🔒' : '🔓'}
        </button>
      </div>
      
      {hasChildren && !collapsed.has(node.uid) && (
        <div className="flex flex-col items-center">
          <div className="h-8 w-px bg-slate-300" style={{ height: `${8 + gap * 2}px` }} />
          <div className="flex items-start border-t border-slate-300 pt-0" style={{ gap: `${gap + 16}px` }}>
            {node.children.map((child) => (
              <SquareNode 
                key={child.uid} 
                node={child} 
                depth={depth + 1} 
                collapsed={collapsed} 
                toggle={toggle} 
                locked={locked}
                toggleLock={toggleLock}
                onNodeRef={onNodeRef}
                drawingMode={drawingMode}
                onNodeSelect={onNodeSelect}
                selectedForConnection={selectedForConnection}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LifeNodeTogglePrototype() {
  const roots = useMemo(() => buildTree(rawNodes), []);
  const [collapsed, setCollapsed] = useState(new Set(rawNodes.filter((n: any) => n.parentUid !== null).map((n: any) => n.uid)));
  const [mode, setMode] = useState<"map" | "agenda">("map");
  const [zoomScale, setZoomScale] = useState(1);
  const [locked, setLocked] = useState(new Set<string>());
  const [drawingMode, setDrawingMode] = useState(false);
  const [selectedForConnection, setSelectedForConnection] = useState<string | null>(null);
  const [connections, setConnections] = useState<Array<{ from: string; to: string }>>([]);
  const nodeRefs = new Map<string, HTMLDivElement>();
  const svgRef = React.useRef<SVGSVGElement>(null);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleLock = (id: string) => {
    setLocked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const showOnly = (rootId: number) => {
    const allIds = roots.flatMap(collectIds);
    const root = roots.find((r) => r.id === rootId);
    const keepOpen = new Set(allIds);
    if (root) collectIds(root).forEach((id) => keepOpen.delete(id));
    setCollapsed(keepOpen);
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => clampZoom(prev + ZOOM_STEP));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => clampZoom(prev - ZOOM_STEP));
  };

  const handleResetZoom = () => {
    setZoomScale(1);
  };

  const handleWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    setZoomScale((prev) => clampZoom(prev + direction * ZOOM_STEP));
  };

  const handleNodeSelect = (uid: string) => {
    if (!selectedForConnection) {
      setSelectedForConnection(uid);
    } else if (selectedForConnection === uid) {
      setSelectedForConnection(null);
    } else {
      setConnections((prev) => [...prev, { from: selectedForConnection, to: uid }]);
      setSelectedForConnection(null);
    }
  };

  const deleteConnection = (from: string, to: string) => {
    setConnections((prev) => prev.filter((c) => !(c.from === from && c.to === to)));
  };

  const getNodePosition = (uid: string) => {
    const element = nodeRefs.get(uid);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const svg = svgRef.current;
    if (!svg) return null;
    const svgRect = svg.getBoundingClientRect();
    return {
      x: rect.left - svgRect.left + rect.width / 2,
      y: rect.top - svgRect.top + rect.height / 2,
    };
  };

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 flex flex-col overflow-hidden">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 p-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setMode("map")} className={`rounded-lg px-3 py-2 text-sm font-semibold border transition-colors ${mode === "map" ? "bg-black text-white" : "bg-white hover:bg-slate-50"}`}>
          <NetworkIcon /> Life Map
        </button>
        <button onClick={() => setMode("agenda")} className={`rounded-lg px-3 py-2 text-sm font-semibold border transition-colors ${mode === "agenda" ? "bg-black text-white" : "bg-white hover:bg-slate-50"}`}>
          <CalendarIcon /> Everyday Agenda
        </button>
        
        <div className="border-l border-slate-300 h-8 mx-1" />
        
        <button onClick={() => setCollapsed(new Set())} className="rounded-lg px-3 py-2 text-sm border bg-white hover:bg-slate-50 transition-colors">Expand All</button>
        <button onClick={() => setCollapsed(new Set(rawNodes.map((n: any) => n.uid)))} className="rounded-lg px-3 py-2 text-sm border bg-white hover:bg-slate-50 transition-colors">Collapse All</button>
        
        <div className="border-l border-slate-300 h-8 mx-1" />
        
        <button onClick={() => showOnly(1)} className="rounded-lg px-3 py-2 text-sm border bg-red-100 hover:bg-red-200 transition-colors font-medium">Personal</button>
        <button onClick={() => showOnly(500)} className="rounded-lg px-3 py-2 text-sm border bg-yellow-100 hover:bg-yellow-200 transition-colors font-medium">Health</button>
        <button onClick={() => showOnly(600)} className="rounded-lg px-3 py-2 text-sm border bg-green-100 hover:bg-green-200 transition-colors font-medium">Work</button>
        <button onClick={() => showOnly(700)} className="rounded-lg px-3 py-2 text-sm border bg-slate-100 hover:bg-slate-200 transition-colors font-medium">Projects</button>
        
        <div className="border-l border-slate-300 h-8 mx-1" />
        
        <button onClick={handleZoomOut} disabled={zoomScale <= MIN_ZOOM} className="rounded-lg px-3 py-2 text-sm border bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Zoom out">
          <ZoomOutIcon />
        </button>
        
        <button onClick={handleResetZoom} className="rounded-lg px-2 py-2 text-xs border bg-white hover:bg-slate-50 transition-colors font-semibold min-w-[50px]" title="Reset zoom">
          {Math.round(zoomScale * 100)}%
        </button>
        
        <button onClick={handleZoomIn} disabled={zoomScale >= MAX_ZOOM} className="rounded-lg px-3 py-2 text-sm border bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Zoom in">
          <ZoomInIcon />
        </button>

        <span className="text-xs text-slate-500">Ctrl/Cmd + scroll to zoom</span>

        <div className="border-l border-slate-300 h-8 mx-1" />

        <button 
          onClick={() => {
            setDrawingMode(!drawingMode);
            setSelectedForConnection(null);
          }}
          className={`rounded-lg px-3 py-2 text-sm border font-medium transition-colors ${
            drawingMode
              ? 'bg-blue-500 text-white'
              : 'bg-white hover:bg-slate-50'
          }`}
          title="Draw connections between nodes"
        >
          ➜ Draw Arrows
        </button>

        {connections.length > 0 && (
          <span className="text-xs text-slate-600 ml-2">
            {connections.length} connection{connections.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {mode === "agenda" ? (
        <div className="p-8 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Everyday Agenda</h1>
          <div className="grid gap-3">
            {["Health: schedule labs", "Work: review pipeline", "Finance: check payment due dates", "Projects: update notes"].map((task) => (
              <div key={task} className="rounded-xl border p-4 shadow-sm bg-white flex items-center justify-between hover:shadow-md transition-shadow">
                <span className="font-semibold">{task}</span>
                <span className="text-xs rounded-full bg-slate-100 px-2 py-1">Today</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto relative" onWheel={handleWheelZoom}>
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            style={{ background: 'transparent' }}
          >
            {connections.map((conn, idx) => {
              const fromPos = getNodePosition(conn.from);
              const toPos = getNodePosition(conn.to);
              if (!fromPos || !toPos) return null;

              return (
                <g key={idx}>
                  <line
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke="#3b82f6"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                  {/* Click area to delete connection */}
                  <line
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke="transparent"
                    strokeWidth="10"
                    className="cursor-pointer hover:stroke-red-300"
                    style={{ pointerEvents: 'auto' }}
                    onClick={() => deleteConnection(conn.from, conn.to)}
                  />
                </g>
              );
            })}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
              </marker>
            </defs>
          </svg>

          <div
            className="min-w-max min-h-full p-12 flex items-start justify-center relative z-1"
            style={{
              backgroundImage: "radial-gradient(#d9e2ec 1px, transparent 1px)",
              backgroundSize: "14px 14px",
              transform: `scale(${zoomScale})`,
              transformOrigin: "top left",
              transition: "transform 0.2s ease",
              willChange: "transform",
            }}
          >
            <div className="flex gap-12 items-start">
              {roots.map((root) => (
                <SquareNode 
                  key={root.uid} 
                  node={root} 
                  depth={0} 
                  collapsed={collapsed} 
                  toggle={toggle} 
                  locked={locked}
                  toggleLock={toggleLock}
                  onNodeRef={(uid, el) => {
                    if (el) {
                      nodeRefs.set(uid, el);
                    } else {
                      nodeRefs.delete(uid);
                    }
                  }}
                  drawingMode={drawingMode}
                  onNodeSelect={handleNodeSelect}
                  selectedForConnection={selectedForConnection}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

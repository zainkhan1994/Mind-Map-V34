import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Arrow, Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from "react-konva";
import { rawNodes } from "./data";
import { preloadLogos, getCachedLogo } from "./logoUtils";

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

const palette: Record<string, { fill: string; stroke: string; text: string }> = {
  black: { fill: "#111827", stroke: "#111827", text: "#ffffff" },
  red: { fill: "#ef4444", stroke: "#ef4444", text: "#ffffff" },
  green: { fill: "#166534", stroke: "#166534", text: "#ffffff" },
  yellow: { fill: "#fde047", stroke: "#fde047", text: "#111827" },
  blue: { fill: "#2563eb", stroke: "#2563eb", text: "#ffffff" },
  purple: { fill: "#9333ea", stroke: "#9333ea", text: "#ffffff" },
  default: { fill: "#111827", stroke: "#111827", text: "#ffffff" },
};

/**
 * LogoImage component - displays logo for a node
 * Handles async image loading and fallback
 */
function LogoImage({
  x,
  y,
  width,
  height,
  logoUrl,
  nodeName,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  logoUrl: string;
  nodeName: string;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Don't attempt to load if already failed
    if (failed || !logoUrl) return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setFailed(true);
    img.src = logoUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [logoUrl, failed]);

  // If image loaded successfully, render it
  if (image) {
    return <KonvaImage x={x} y={y} width={width} height={height} image={image} listening={false} />;
  }

  // Fallback: render a generic app emoji
  return (
    <Text
      x={x}
      y={y}
      width={width}
      height={height}
      text="📦"
      fontSize={width * 0.8}
      align="center"
      verticalAlign="middle"
      listening={false}
    />
  );
}

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

interface LayoutNode {
  node: TreeNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutConnection {
  from: string;
  to: string;
}

interface ViewState {
  x: number;
  y: number;
  scale: number;
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

function isRectVisible(
  x: number,
  y: number,
  width: number,
  height: number,
  viewport: { minX: number; minY: number; maxX: number; maxY: number },
  padding = 140,
) {
  return !(
    x + width < viewport.minX - padding ||
    x > viewport.maxX + padding ||
    y + height < viewport.minY - padding ||
    y > viewport.maxY + padding
  );
}

function isLineVisible(
  points: [number, number, number, number],
  viewport: { minX: number; minY: number; maxX: number; maxY: number },
  padding = 140,
) {
  const [x1, y1, x2, y2] = points;
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return !(
    maxX < viewport.minX - padding ||
    minX > viewport.maxX + padding ||
    maxY < viewport.minY - padding ||
    minY > viewport.maxY + padding
  );
}

export default function LifeNodeTogglePrototype() {
  const roots = useMemo(() => buildTree(rawNodes), []);
  const [collapsed, setCollapsed] = useState(
    new Set(rawNodes.filter((n: any) => n.parentUid !== null).map((n: any) => n.uid)),
  );
  const [mode, setMode] = useState<"map" | "agenda">("map");
  const [zoom, setZoom] = useState(0);
  const [locked, setLocked] = useState(new Set<string>());
  const [drawingMode, setDrawingMode] = useState(false);
  const [selectedForConnection, setSelectedForConnection] = useState<string | null>(null);
  const [connections, setConnections] = useState<Array<{ from: string; to: string }>>([]);
  const [showLogos, setShowLogos] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1000, height: 700 });
  const [view, setView] = useState<ViewState>({ x: 80, y: 80, scale: 1 });
  const targetViewRef = useRef<ViewState>({ x: 80, y: 80, scale: 1 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setViewportSize({
          width: Math.max(1, entry.contentRect.width),
          height: Math.max(1, entry.contentRect.height),
        });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Preload logos for visible nodes (F4: Smart Preloading)
  useEffect(() => {
    if (!showLogos) return;
    // Preload logos will be triggered via a separate memoized computation
  }, [showLogos]);

  const scheduleViewUpdate = useCallback((updater: (prev: ViewState) => ViewState) => {
    targetViewRef.current = updater(targetViewRef.current);
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setView(targetViewRef.current);
    });
  }, []);

  const updateZoom = useCallback(
    (nextZoom: number, focus?: { x: number; y: number }) => {
      const clampedZoom = Math.max(-10, Math.min(20, nextZoom));
      const nextScale = Math.max(0.5, Math.min(2, 1 + clampedZoom * 0.05));
      setZoom(clampedZoom);
      scheduleViewUpdate((prev) => {
        const pivot = focus ?? { x: viewportSize.width / 2, y: viewportSize.height / 2 };
        const worldX = (pivot.x - prev.x) / prev.scale;
        const worldY = (pivot.y - prev.y) / prev.scale;
        return {
          x: pivot.x - worldX * nextScale,
          y: pivot.y - worldY * nextScale,
          scale: nextScale,
        };
      });
    },
    [scheduleViewUpdate, viewportSize.height, viewportSize.width],
  );

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

  const handleZoomIn = () => updateZoom(zoom + 2);
  const handleZoomOut = () => updateZoom(zoom - 2);

  const handleResetZoom = () => {
    setZoom(0);
    scheduleViewUpdate((prev) => {
      const pivot = { x: viewportSize.width / 2, y: viewportSize.height / 2 };
      const worldX = (pivot.x - prev.x) / prev.scale;
      const worldY = (pivot.y - prev.y) / prev.scale;
      return {
        x: pivot.x - worldX,
        y: pivot.y - worldY,
        scale: 1,
      };
    });
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

  const nodeSize = useMemo(
    () => ({
      width: Math.max(80, 160 + zoom * 3),
      height: Math.max(44, 66 + zoom * 2),
      fontSize: Math.max(10, 12 + zoom * 0.3),
      rowGap: 36,
      levelGap: 90,
      rootGap: 80,
    }),
    [zoom],
  );

  const { layoutNodes, treeConnections, nodeMap } = useMemo(() => {
    const nodes: LayoutNode[] = [];
    const map = new Map<string, LayoutNode>();

    const layoutNode = (node: TreeNode, depth: number, startY: number): { centerY: number; nextY: number } => {
      const canShowChildren = node.children.length > 0 && !collapsed.has(node.uid);
      const childStart = startY;
      let centerY = childStart;
      let nextY = childStart + nodeSize.height + nodeSize.rowGap;
      const visibleChildCenters: number[] = [];

      if (canShowChildren) {
        let cursor = childStart;
        node.children.forEach((child) => {
          const childLayout = layoutNode(child, depth + 1, cursor);
          cursor = childLayout.nextY;
          visibleChildCenters.push(childLayout.centerY);
        });
        centerY =
          visibleChildCenters.length > 0
            ? (visibleChildCenters[0] + visibleChildCenters[visibleChildCenters.length - 1]) / 2
            : childStart;
        nextY = Math.max(cursor, centerY + nodeSize.height / 2 + nodeSize.rowGap);
      }

      const layout: LayoutNode = {
        node,
        x: 80 + depth * (nodeSize.width + nodeSize.levelGap),
        y: centerY - nodeSize.height / 2,
        width: nodeSize.width,
        height: nodeSize.height,
      };

      nodes.push(layout);
      map.set(node.uid, layout);
      return { centerY, nextY };
    };

    let cursor = 60;
    roots.forEach((root) => {
      const result = layoutNode(root, 0, cursor);
      cursor = result.nextY + nodeSize.rootGap;
    });

    const treeLinks: LayoutConnection[] = [];
    map.forEach((layout) => {
      if (collapsed.has(layout.node.uid)) return;
      layout.node.children.forEach((child) => {
        if (map.has(child.uid)) {
          treeLinks.push({ from: layout.node.uid, to: child.uid });
        }
      });
    });

    return { layoutNodes: nodes, treeConnections: treeLinks, nodeMap: map };
  }, [collapsed, nodeSize.height, nodeSize.levelGap, nodeSize.rootGap, nodeSize.rowGap, nodeSize.width, roots]);

  const viewport = useMemo(
    () => ({
      minX: -view.x / view.scale,
      minY: -view.y / view.scale,
      maxX: (viewportSize.width - view.x) / view.scale,
      maxY: (viewportSize.height - view.y) / view.scale,
    }),
    [view.scale, view.x, view.y, viewportSize.height, viewportSize.width],
  );

  const visibleNodes = useMemo(
    () => layoutNodes.filter((item) => isRectVisible(item.x, item.y, item.width, item.height, viewport)),
    [layoutNodes, viewport],
  );

  // Preload logos for visible file nodes (F4: Smart Preloading)
  useEffect(() => {
    if (!showLogos) return;
    const visibleFileNodeNames = visibleNodes
      .filter((item) => item.node.type === "file")
      .map((item) => item.node.name);
    if (visibleFileNodeNames.length > 0) {
      preloadLogos(visibleFileNodeNames).catch((err) => console.error("Failed to preload logos:", err));
    }
  }, [showLogos, visibleNodes]);

  const visibleTreeConnections = useMemo(() => {
    return treeConnections
      .map((link) => {
        const from = nodeMap.get(link.from);
        const to = nodeMap.get(link.to);
        if (!from || !to) return null;
        const points: [number, number, number, number] = [
          from.x + from.width,
          from.y + from.height / 2,
          to.x,
          to.y + to.height / 2,
        ];
        if (!isLineVisible(points, viewport)) return null;
        return { ...link, points };
      })
      .filter(Boolean) as Array<LayoutConnection & { points: [number, number, number, number] }>;
  }, [nodeMap, treeConnections, viewport]);

  const visibleCustomConnections = useMemo(() => {
    return connections
      .map((link) => {
        const from = nodeMap.get(link.from);
        const to = nodeMap.get(link.to);
        if (!from || !to) return null;
        const points: [number, number, number, number] = [
          from.x + from.width,
          from.y + from.height / 2,
          to.x,
          to.y + to.height / 2,
        ];
        if (!isLineVisible(points, viewport)) return null;
        return { ...link, points };
      })
      .filter(Boolean) as Array<LayoutConnection & { points: [number, number, number, number] }>;
  }, [connections, nodeMap, viewport]);

  const gridLines = useMemo(() => {
    const step = 28;
    const startX = Math.floor((viewport.minX - 200) / step) * step;
    const endX = Math.ceil((viewport.maxX + 200) / step) * step;
    const startY = Math.floor((viewport.minY - 200) / step) * step;
    const endY = Math.ceil((viewport.maxY + 200) / step) * step;

    const vertical: number[] = [];
    for (let x = startX; x <= endX; x += step) {
      vertical.push(x);
    }
    const horizontal: number[] = [];
    for (let y = startY; y <= endY; y += step) {
      horizontal.push(y);
    }

    return {
      vertical,
      horizontal,
      startY,
      endY,
      startX,
      endX,
    };
  }, [viewport.maxX, viewport.maxY, viewport.minX, viewport.minY]);

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 flex flex-col overflow-hidden">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 p-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setMode("map")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold border transition-colors ${mode === "map" ? "bg-black text-white" : "bg-white hover:bg-slate-50"}`}
        >
          <NetworkIcon /> Life Map
        </button>
        <button
          onClick={() => setMode("agenda")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold border transition-colors ${mode === "agenda" ? "bg-black text-white" : "bg-white hover:bg-slate-50"}`}
        >
          <CalendarIcon /> Everyday Agenda
        </button>

        <div className="border-l border-slate-300 h-8 mx-1" />

        <button onClick={() => setCollapsed(new Set())} className="rounded-lg px-3 py-2 text-sm border bg-white hover:bg-slate-50 transition-colors">
          Expand All
        </button>
        <button
          onClick={() => setCollapsed(new Set(rawNodes.map((n: any) => n.uid)))}
          className="rounded-lg px-3 py-2 text-sm border bg-white hover:bg-slate-50 transition-colors"
        >
          Collapse All
        </button>

        <button
          onClick={() => setShowLogos(!showLogos)}
          className={`rounded-lg px-3 py-2 text-sm border font-medium transition-colors ${
            showLogos ? "bg-blue-100 text-blue-900" : "bg-white hover:bg-slate-50"
          }`}
          title={showLogos ? "Hide logos" : "Show logos"}
        >
          📷 {showLogos ? "Hide Logos" : "Show Logos"}
        </button>

        <div className="border-l border-slate-300 h-8 mx-1" />

        <button onClick={() => showOnly(1)} className="rounded-lg px-3 py-2 text-sm border bg-red-100 hover:bg-red-200 transition-colors font-medium">
          Personal
        </button>
        <button onClick={() => showOnly(500)} className="rounded-lg px-3 py-2 text-sm border bg-yellow-100 hover:bg-yellow-200 transition-colors font-medium">
          Health
        </button>
        <button onClick={() => showOnly(600)} className="rounded-lg px-3 py-2 text-sm border bg-green-100 hover:bg-green-200 transition-colors font-medium">
          Work
        </button>
        <button onClick={() => showOnly(700)} className="rounded-lg px-3 py-2 text-sm border bg-slate-100 hover:bg-slate-200 transition-colors font-medium">
          Projects
        </button>

        <div className="border-l border-slate-300 h-8 mx-1" />

        <button
          onClick={handleZoomOut}
          disabled={zoom <= -10}
          className="rounded-lg px-3 py-2 text-sm border bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Zoom out"
        >
          <ZoomOutIcon />
        </button>

        <button
          onClick={handleResetZoom}
          className="rounded-lg px-2 py-2 text-xs border bg-white hover:bg-slate-50 transition-colors font-semibold min-w-[50px]"
          title="Reset zoom"
        >
          {Math.round(view.scale * 100)}%
        </button>

        <button
          onClick={handleZoomIn}
          disabled={zoom >= 20}
          className="rounded-lg px-3 py-2 text-sm border bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Zoom in"
        >
          <ZoomInIcon />
        </button>

        <div className="border-l border-slate-300 h-8 mx-1" />

        <button
          onClick={() => {
            setDrawingMode(!drawingMode);
            setSelectedForConnection(null);
          }}
          className={`rounded-lg px-3 py-2 text-sm border font-medium transition-colors ${
            drawingMode ? "bg-blue-500 text-white" : "bg-white hover:bg-slate-50"
          }`}
          title="Draw connections between nodes"
        >
          ➜ Draw Arrows
        </button>

        {connections.length > 0 && (
          <span className="text-xs text-slate-600 ml-2">
            {connections.length} connection{connections.length !== 1 ? "s" : ""}
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
        <div ref={containerRef} className="flex-1 overflow-hidden relative">
          <Stage
            ref={stageRef}
            width={viewportSize.width}
            height={viewportSize.height}
            x={view.x}
            y={view.y}
            scaleX={view.scale}
            scaleY={view.scale}
            draggable
            onDragMove={(event) => {
              const stage = event.target.getStage();
              if (!stage) return;
              scheduleViewUpdate((prev) => ({ ...prev, x: stage.x(), y: stage.y() }));
            }}
            onDragEnd={(event) => {
              const stage = event.target.getStage();
              if (!stage) return;
              scheduleViewUpdate((prev) => ({ ...prev, x: stage.x(), y: stage.y() }));
            }}
            onWheel={(event) => {
              event.evt.preventDefault();
              const stage = event.target.getStage();
              if (!stage) return;
              const pointer = stage.getPointerPosition();
              if (!pointer) return;

              const scaleBy = 1.08;
              const direction = event.evt.deltaY > 0 ? -1 : 1;
              const proposedScale = view.scale * (direction > 0 ? scaleBy : 1 / scaleBy);
              const boundedScale = Math.max(0.5, Math.min(2, proposedScale));
              const nextZoom = Math.max(-10, Math.min(20, Math.round((boundedScale - 1) / 0.05)));
              setZoom(nextZoom);

              scheduleViewUpdate((prev) => {
                const worldX = (pointer.x - prev.x) / prev.scale;
                const worldY = (pointer.y - prev.y) / prev.scale;
                return {
                  x: pointer.x - worldX * boundedScale,
                  y: pointer.y - worldY * boundedScale,
                  scale: boundedScale,
                };
              });
            }}
          >
            <Layer listening={false}>
              {gridLines.vertical.map((x) => (
                <Line key={`vx-${x}`} points={[x, gridLines.startY, x, gridLines.endY]} stroke="#e2e8f0" strokeWidth={1} />
              ))}
              {gridLines.horizontal.map((y) => (
                <Line key={`hy-${y}`} points={[gridLines.startX, y, gridLines.endX, y]} stroke="#e2e8f0" strokeWidth={1} />
              ))}
            </Layer>

            <Layer listening={false}>
              {visibleTreeConnections.map((link, index) => (
                <Line
                  key={`tree-${link.from}-${link.to}-${index}`}
                  points={link.points}
                  stroke="#cbd5e1"
                  strokeWidth={2}
                  lineCap="round"
                />
              ))}
            </Layer>

            <Layer>
              {visibleCustomConnections.map((link, index) => (
                <Arrow
                  key={`custom-${link.from}-${link.to}-${index}`}
                  points={link.points}
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  strokeWidth={2}
                  pointerLength={10}
                  pointerWidth={8}
                  onClick={() => deleteConnection(link.from, link.to)}
                  onTap={() => deleteConnection(link.from, link.to)}
                />
              ))}

              {visibleNodes.map((item) => {
                const nodePalette = palette[item.node.color as keyof typeof palette] || palette.default;
                const hasChildren = item.node.children.length > 0;
                const isCollapsed = collapsed.has(item.node.uid);
                const isLocked = locked.has(item.node.uid);
                const isSelected = selectedForConnection === item.node.uid;
                const isFileNode = item.node.type === "file";
                const shouldShowLogo = showLogos && isFileNode && !isCollapsed;
                const logoUrl = shouldShowLogo ? getCachedLogo(item.node.name) : null;

                return (
                   <Group
                    key={item.node.uid}
                    x={item.x}
                    y={item.y}
                    onClick={() => {
                      if (drawingMode) {
                        handleNodeSelect(item.node.uid);
                        return;
                      }
                      if (hasChildren) {
                        toggle(item.node.uid);
                      }
                    }}
                    onTap={() => {
                      if (drawingMode) {
                        handleNodeSelect(item.node.uid);
                        return;
                      }
                      if (hasChildren) {
                        toggle(item.node.uid);
                      }
                    }}
                  >
                    <Rect
                      width={item.width}
                      height={item.height}
                      cornerRadius={10}
                      fill={nodePalette.fill}
                      stroke={isSelected ? "#3b82f6" : nodePalette.stroke}
                      strokeWidth={isSelected ? 3 : 1}
                      shadowBlur={4}
                      shadowOpacity={0.2}
                      shadowOffsetY={2}
                    />

                    <Text
                      text={`${hasChildren ? (isCollapsed ? "▶ " : "▼ ") : ""}${item.node.name}`}
                      width={item.width - 16}
                      height={shouldShowLogo ? item.height * 0.6 : item.height - 14}
                      x={8}
                      y={7}
                      fill={nodePalette.text}
                      fontSize={nodeSize.fontSize}
                      fontStyle="bold"
                      align="center"
                      verticalAlign="middle"
                      wrap="word"
                      ellipsis
                      listening={false}
                    />

                    {/* Logo display for file nodes (F3: Logo Rendering in Nodes) */}
                    {shouldShowLogo && logoUrl && (
                      <LogoImage
                        x={item.width / 2 - 12}
                        y={item.height - 20}
                        width={24}
                        height={24}
                        logoUrl={logoUrl}
                        nodeName={item.node.name}
                      />
                    )}

                    <Circle
                      x={item.width - 8}
                      y={8}
                      radius={8}
                      fill={isLocked ? "#f59e0b" : "#cbd5e1"}
                      stroke={isLocked ? "#f59e0b" : "#94a3b8"}
                      strokeWidth={1}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        toggleLock(item.node.uid);
                      }}
                      onTap={(event) => {
                        event.cancelBubble = true;
                        toggleLock(item.node.uid);
                      }}
                    />

                    <Text
                      text={isLocked ? "🔒" : "🔓"}
                      x={item.width - 14}
                      y={2}
                      width={12}
                      height={12}
                      fontSize={9}
                      align="center"
                      verticalAlign="middle"
                      listening={false}
                    />
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        </div>
      )}
    </div>
  );
}

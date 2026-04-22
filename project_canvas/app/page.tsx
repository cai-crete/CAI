'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { CanvasNode, CanvasEdge, NodeType, NODE_DEFINITIONS } from '@/types/canvas';
import InfiniteCanvas from '@/components/InfiniteCanvas';
import LeftToolbar    from '@/components/LeftToolbar';
import RightSidebar   from '@/components/RightSidebar';
import ExpandedView   from '@/components/ExpandedView';

/* ── UUID 생성 (비보안 컨텍스트 폴백: HTTP 로컬 IP 접속 대응) ───── */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ── localStorage 키 ────────────────────────────────────────────── */
const LS_ITEMS = 'cai-canvas-items';
const LS_VIEW  = 'cai-canvas-view';

function lsSaveItems(nodes: CanvasNode[]) {
  const stripped = nodes.map(n => ({
    ...n,
    src: (n as { src?: string }).src?.startsWith('data:') ? '' : (n as { src?: string }).src,
  }));
  try { localStorage.setItem(LS_ITEMS, JSON.stringify(stripped)); } catch { /* quota */ }
}

function lsLoadItems(): CanvasNode[] {
  try { return JSON.parse(localStorage.getItem(LS_ITEMS) || '[]'); }
  catch { return []; }
}

function lsSaveView(scale: number, offset: { x: number; y: number }) {
  try { localStorage.setItem(LS_VIEW, JSON.stringify({ scale, offset })); } catch { /* quota */ }
}

function lsLoadView(): { scale: number; offset: { x: number; y: number } } {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_VIEW) || '{}');
    return {
      scale:  raw.scale  ?? 1,
      offset: raw.offset ?? { x: 80, y: 80 },
    };
  } catch { return { scale: 1, offset: { x: 80, y: 80 } }; }
}

const CARD_W    = 280;
const CARD_H    = 198;
const HEADER_H  = 56;   /* var(--header-h) = 3.5rem */
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;

const DIRECT_EXPAND_NODES: NodeType[] = ['planners', 'image'];

type ActiveTool = 'cursor' | 'handle';

export default function CanvasPage() {
  /* ── viewport ──────────────────────────────────────────────────── */
  const [scale,  setScale]  = useState(1);
  const [offset, setOffset] = useState({ x: 80, y: 80 });

  /* ── tool ───────────────────────────────────────────────────────── */
  const [activeTool, setActiveTool] = useState<ActiveTool>('cursor');

  /* ── nodes + history ─────────────────────────────────────────────── */
  const [nodes,        setNodes]        = useState<CanvasNode[]>([]);
  const [history,      setHistory]      = useState<CanvasNode[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  /* ── edges + 신규 엣지 애니메이션 ───────────────────────────────── */
  const [edges,      setEdges]      = useState<CanvasEdge[]>([]);
  const [newEdgeIds, setNewEdgeIds] = useState<Set<string>>(new Set());

  /* ── localStorage 복원 완료 플래그 (persist effect 선실행 방지) ─── */
  const isRestoredRef = useRef(false);

  /* ── 줌 배율 버튼 사이클 상태 (0: idle, 1: fit-all, 2: focus-latest) */
  const zoomCycleStateRef = useRef(0);
  const savedViewRef      = useRef<{ scale: number; offset: { x: number; y: number } } | null>(null);

  /* ── 선택 / 확장 상태 ────────────────────────────────────────────── */
  const [selectedNodeIds,      setSelectedNodeIds]      = useState<string[]>([]);
  const [expandedNodeId,       setExpandedNodeId]       = useState<string | null>(null);
  /* 단일 선택 시에만 유효한 파생값 — 사이드바·expand 진입에 사용 */
  const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;

  /* ── 통합 사이드바 상태 ──────────────────────────────────────────── */
  const [activeSidebarNodeType, setActiveSidebarNodeType] = useState<NodeType | null>(null);

  /* ── history helpers ─────────────────────────────────────────────── */
  const pushHistory = useCallback((next: CanvasNode[]) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), next]);
    setHistoryIndex(i => i + 1);
    setNodes(next);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const idx = historyIndex - 1;
    setHistoryIndex(idx);
    setNodes(history[idx]);
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    setHistoryIndex(idx);
    setNodes(history[idx]);
  }, [historyIndex, history]);

  /* ── keyboard shortcuts ──────────────────────────────────────────── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.shiftKey ? redo() : undo();
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        setSelectedNodeIds([]);
        if (expandedNodeId) handleReturnFromExpand();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, expandedNodeId]);

  /* ── persist: nodes → localStorage (복원 완료 후에만) ──────────── */
  useEffect(() => {
    if (!isRestoredRef.current) return;
    lsSaveItems(nodes);
  }, [nodes]);

  /* ── persist: viewport → localStorage (복원 완료 후에만) ───────── */
  useEffect(() => {
    if (!isRestoredRef.current) return;
    lsSaveView(scale, offset);
  }, [scale, offset]);

  /* ── mount: localStorage 복원 → isRestoredRef = true ───────────── */
  useEffect(() => {
    const view = lsLoadView();
    setScale(view.scale);
    setOffset(view.offset);

    const saved = lsLoadItems();
    if (saved.length > 0) {
      setNodes(saved);
      setHistory([saved]);
    }

    isRestoredRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── node 생성 후 즉시 expand 진입 ──────────────────────────────── */
  const createAndExpandNode = useCallback((type: NodeType) => {
    const currentNodes = nodes;
    const existing = currentNodes.filter(n => n.type === type);
    const num = existing.length + 1;
    const cwx = (window.innerWidth  / 2 - offset.x) / scale - CARD_W / 2;
    const cwy = (window.innerHeight / 2 - offset.y) / scale - 120;
    const newNode: CanvasNode = {
      id: generateId(),
      type,
      title: `${NODE_DEFINITIONS[type].caption} #${num}`,
      position: { x: cwx, y: cwy },
      instanceNumber: num,
      hasThumbnail: false,
    };
    const next = [...currentNodes, newNode];
    pushHistory(next);
    setExpandedNodeId(newNode.id);
    setActiveSidebarNodeType(null);
  }, [nodes, offset, scale, pushHistory]);

  const handleCreateEmptySketch = useCallback(() => {
    const currentNodes = nodes;
    const existing = currentNodes.filter(n => n.type === 'sketch');
    const num = existing.length + 1;
    const cwx = (window.innerWidth  / 2 - offset.x) / scale - CARD_W / 2;
    const cwy = (window.innerHeight / 2 - offset.y) / scale - 120;
    const newNode: CanvasNode = {
      id: generateId(),
      type: 'sketch',
      title: `SKETCH #${num}`,
      position: { x: cwx, y: cwy },
      instanceNumber: num,
      hasThumbnail: false,
    };
    pushHistory([...currentNodes, newNode]);
    setSelectedNodeIds([newNode.id]);
    setActiveSidebarNodeType(null);
  }, [nodes, offset, scale, pushHistory]);

  /* ── expand에서 돌아올 때 항상 썸네일 생성 ──────────────────────── */
  const handleReturnFromExpand = useCallback(() => {
    if (!expandedNodeId) { setExpandedNodeId(null); return; }
    setNodes(prev => {
      const next = prev.map(n =>
        n.id === expandedNodeId ? { ...n, hasThumbnail: true } : n
      );
      setHistory(h => [...h.slice(0, historyIndex + 1), next]);
      setHistoryIndex(i => i + 1);
      return next;
    });
    setExpandedNodeId(null);
  }, [expandedNodeId, historyIndex]);

  /* ── node position ───────────────────────────────────────────────── */
  const updateNodePosition = useCallback((id: string, pos: { x: number; y: number }) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, position: pos } : n));
  }, []);

  const commitNodePosition = useCallback((id: string) => {
    setNodes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, autoPlaced: false } : n);
      setHistory(h => [...h.slice(0, historyIndex + 1), next]);
      setHistoryIndex(i => i + 1);
      return next;
    });
  }, [historyIndex]);

  /* ── 사이드바 노드 탭 선택 ────────────────────────────────────────── */
  const handleNodeTabSelect = useCallback((type: NodeType) => {
    /* 즉시 expand 노드 + 썸네일 없는 신규 진입 */
    if (DIRECT_EXPAND_NODES.includes(type) && !selectedNodeId) {
      createAndExpandNode(type);
      return;
    }
    /* 토글: 같은 탭 재클릭 시 SELECT TOOLS로 복귀 */
    setActiveSidebarNodeType(prev => prev === type ? null : type);
    // setSelectedNodeId(null); // 사용자의 요청으로 선택 상태를 유지합니다.
  }, [selectedNodeId, createAndExpandNode]);

  /* ── "→" 버튼: 사이드바 패널에서 expand 진입 ──────────────────────── */
  const handleNavigateToExpand = useCallback((type: NodeType) => {
    /* 기존 썸네일이 있는 노드가 선택되어 있으면 그 노드로 expand */
    if (selectedNodeId) {
      const selected = nodes.find(n => n.id === selectedNodeId);
      if (selected && selected.type === type) {
        setExpandedNodeId(selectedNodeId);
        setActiveSidebarNodeType(null);
        return;
      }
    }
    /* 아니면 새 노드 생성 후 expand */
    createAndExpandNode(type);
  }, [selectedNodeId, nodes, createAndExpandNode]);

  /* ── 썸네일 단일 클릭 → 선택 + 패널 열기 ───────────────────────── */
  const handleNodeCardSelect = useCallback((id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setSelectedNodeIds([id]);
    setActiveSidebarNodeType(node.type);
  }, [nodes]);

  /* ── 빈 캔버스 클릭 → 선택 해제 + 패널 닫기 ────────────────────── */
  const handleNodeDeselect = useCallback(() => {
    setSelectedNodeIds([]);
    setActiveSidebarNodeType(null);
  }, []);

  const handleNodesSelect = useCallback((ids: string[]) => {
    setSelectedNodeIds(ids);
    setActiveSidebarNodeType(null);
  }, []);

  /* ── node duplicate / delete ─────────────────────────────────────── */
  const duplicateNode = useCallback((id: string) => {
    const src = nodes.find(n => n.id === id);
    if (!src) return;
    const num = nodes.filter(n => n.type === src.type).length + 1;
    pushHistory([...nodes, {
      ...src,
      id: generateId(),
      title: `${NODE_DEFINITIONS[src.type].caption} #${num}`,
      instanceNumber: num,
      position: { x: src.position.x + 24, y: src.position.y + 24 },
      hasThumbnail: false,
    }]);
  }, [nodes, pushHistory]);

  const deleteNode = useCallback((id: string) => {
    setSelectedNodeIds(prev => {
      if (prev.includes(id)) setActiveSidebarNodeType(null);
      return prev.filter(sid => sid !== id);
    });
    setEdges(prev => prev.filter(e => e.sourceId !== id && e.targetId !== id));
    pushHistory(nodes.filter(n => n.id !== id));
  }, [nodes, pushHistory]);

  /* ── 확장 뷰 ─────────────────────────────────────────────────────── */
  const expandedNode = expandedNodeId ? nodes.find(n => n.id === expandedNodeId) ?? null : null;

  /* ── zoom ───────────────────────────────────────────────────────── */
  const zoomIn  = () => setScale(s => Math.min(MAX_SCALE, parseFloat((s * 1.25).toFixed(2))));
  const zoomOut = () => setScale(s => Math.max(MIN_SCALE, parseFloat((s * 0.8).toFixed(2))));

  const handleZoomCycle = useCallback(() => {
    const state = zoomCycleStateRef.current;
    const vpW   = window.innerWidth;
    const vpH   = window.innerHeight - HEADER_H;

    /* ── 1번째 클릭: 전체 노드 fit ──────────────────────────────── */
    if (state === 0) {
      savedViewRef.current = { scale, offset };   /* 복원용 현재 뷰 저장 */

      if (nodes.length === 0) {
        setScale(1); setOffset({ x: 80, y: 80 });
        zoomCycleStateRef.current = 1;
        return;
      }
      const pad  = 80;
      const minX = Math.min(...nodes.map(n => n.position.x));
      const minY = Math.min(...nodes.map(n => n.position.y));
      const maxX = Math.max(...nodes.map(n => n.position.x + CARD_W));
      const maxY = Math.max(...nodes.map(n => n.position.y + CARD_H));
      const cW   = maxX - minX;
      const cH   = maxY - minY;
      const ns   = Math.min(
        (vpW - pad * 2) / cW,
        (vpH - pad * 2) / cH,
        MAX_SCALE,
      );
      const clampedScale = Math.max(MIN_SCALE, ns);
      setScale(clampedScale);
      setOffset({
        x: vpW / 2 - ((minX + maxX) / 2) * clampedScale,
        y: vpH / 2 - ((minY + maxY) / 2) * clampedScale,
      });
      zoomCycleStateRef.current = 1;
      return;
    }

    /* ── 2번째 클릭: 가장 최근 생성 아이템 포커스 ───────────────── */
    if (state === 1) {
      const last = nodes[nodes.length - 1];
      if (last) {
        const ns = 1;
        setScale(ns);
        setOffset({
          x: vpW / 2 - (last.position.x + CARD_W / 2) * ns,
          y: vpH / 2 - (last.position.y + CARD_H / 2) * ns,
        });
      }
      zoomCycleStateRef.current = 2;
      return;
    }

    /* ── 3번째 클릭: 저장된 뷰 복원 ────────────────────────────── */
    const saved = savedViewRef.current;
    if (saved) { setScale(saved.scale); setOffset(saved.offset); }
    else        { setScale(1); setOffset({ x: 80, y: 80 }); }
    savedViewRef.current      = null;
    zoomCycleStateRef.current = 0;
  }, [scale, offset, nodes]);

  /* ── 헤더 ───────────────────────────────────────────────────────── */
  const Header = () => (
    <header style={{
      height: 'var(--header-h)',
      background: 'var(--color-white)',
      borderBottom: '1px solid var(--color-gray-100)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.25rem',
      flexShrink: 0,
      position: 'relative',
      zIndex: 10,
    }}>
      <span className="text-title" style={{ fontSize: '1.25rem', letterSpacing: '0.05em' }}>
        CAI&nbsp;&nbsp;CANVAS
      </span>
    </header>
  );

  /* ── render ─────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', userSelect: 'none' }}>
      <Header />

      {/* ── 확장 뷰 ─────────────────────────────────────────────────── */}
      {expandedNode ? (
        <ExpandedView
          node={expandedNode}
          onCollapse={handleReturnFromExpand}
          activeTool={activeTool}
          scale={scale}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onToolChange={setActiveTool}
          onUndo={undo}
          onRedo={redo}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={handleZoomCycle}
          onAddSketch={handleCreateEmptySketch}
        />
      ) : (
        /* ── 캔버스 뷰 ────────────────────────────────────────────── */
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <InfiniteCanvas
            nodes={nodes}
            edges={edges}
            newEdgeIds={newEdgeIds}
            scale={scale}
            offset={offset}
            activeTool={activeTool}
            selectedNodeIds={selectedNodeIds}
            onScaleChange={setScale}
            onOffsetChange={setOffset}
            onNodePositionChange={updateNodePosition}
            onNodePositionCommit={commitNodePosition}
            onNodeSelect={handleNodeCardSelect}
            onNodeDeselect={handleNodeDeselect}
            onNodesSelect={handleNodesSelect}
            onNodeExpand={setExpandedNodeId}
            onNodeDuplicate={duplicateNode}
            onNodeDelete={deleteNode}
          />

          <LeftToolbar
            activeTool={activeTool}
            scale={scale}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onToolChange={setActiveTool}
            onUndo={undo}
            onRedo={redo}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomReset={handleZoomCycle}
            onAddSketch={handleCreateEmptySketch}
          />

          <RightSidebar
            activeSidebarNodeType={activeSidebarNodeType}
            onNodeTabSelect={handleNodeTabSelect}
            onNavigateToExpand={handleNavigateToExpand}
          />
        </div>
      )}
    </div>
  );
}

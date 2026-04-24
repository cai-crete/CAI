'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  CanvasNode, CanvasEdge, NodeType,
  ArtboardType, NODE_TO_ARTBOARD_TYPE, NODES_THAT_EXPAND,
  NODE_DEFINITIONS, PlannerMessage,
  ElevationNodeData, ElevationView,
} from '@/types/canvas';
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
const LS_EDGES = 'cai-canvas-edges';

function lsSaveItems(nodes: CanvasNode[]) {
  const stripped = nodes.map(n => ({
    ...n,
    src: (n as { src?: string }).src?.startsWith('data:') ? '' : (n as { src?: string }).src,
  }));
  try { localStorage.setItem(LS_ITEMS, JSON.stringify(stripped)); } catch { /* quota */ }
}

function lsLoadItems(): CanvasNode[] {
  try {
    const raw: CanvasNode[] = JSON.parse(localStorage.getItem(LS_ITEMS) || '[]');
    return raw.map(n => ({ ...n, artboardType: n.artboardType ?? 'sketch' }));
  }
  catch { return []; }
}

function lsSaveEdges(edges: CanvasEdge[]) {
  try { localStorage.setItem(LS_EDGES, JSON.stringify(edges)); } catch { /* quota */ }
}

function lsLoadEdges(): CanvasEdge[] {
  try { return JSON.parse(localStorage.getItem(LS_EDGES) || '[]'); }
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

/* 아트보드 미선택 상태에서 탭 클릭 시 바로 expand 진입하는 노드 */
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
  const [newEdgeIds] = useState<Set<string>>(new Set());

  /* ── localStorage 복원 완료 플래그 (persist effect 선실행 방지) ─── */
  const isRestoredRef = useRef(false);

  /* ── Planners 대화 메시지 캐시 (expand 뷰에서 실시간 수신) ─────── */
  const plannerMessagesRef = useRef<PlannerMessage[]>([]);

  /* ── Planners Insight 데이터 캐시 (expand 뷰에서 실시간 수신) ─── */
  const plannerInsightDataRef = useRef<import('@/types/canvas').SavedInsightData | null>(null);

  /* ── 줌 배율 버튼 사이클 상태 (0: idle, 1: fit-all, 2: focus-latest) */
  const zoomCycleStateRef = useRef(0);
  const savedViewRef      = useRef<{ scale: number; offset: { x: number; y: number } } | null>(null);

  /* ── 선택 / 확장 상태 ────────────────────────────────────────────── */
  const [selectedNodeIds,      setSelectedNodeIds]      = useState<string[]>([]);
  const [expandedNodeId,       setExpandedNodeId]       = useState<string | null>(null);
  const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;

  /* ── 통합 사이드바 상태 ──────────────────────────────────────────── */
  const [activeSidebarNodeType, setActiveSidebarNodeType] = useState<NodeType | null>(null);

  /* ── 선택된 아트보드 유형 (파생값) ──────────────────────────────── */
  const selectedArtboardType: ArtboardType | null = selectedNodeId
    ? (nodes.find(n => n.id === selectedNodeId)?.artboardType ?? null)
    : null;

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

  /* ── persist: edges → localStorage (복원 완료 후에만) ─────────── */
  useEffect(() => {
    if (!isRestoredRef.current) return;
    lsSaveEdges(edges);
  }, [edges]);

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

    const savedEdges = lsLoadEdges();
    if (savedEdges.length > 0) setEdges(savedEdges);

    const saved = lsLoadItems();
    if (saved.length > 0) {
      setNodes(saved);
      setHistory([saved]);
    }

    isRestoredRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 노드 생성 후 즉시 expand 진입 ──────────────────────────────── */
  const createAndExpandNode = useCallback((type: NodeType) => {
    const currentNodes = nodes;
    const existing = currentNodes.filter(n => n.type === type);
    const num = existing.length + 1;
    const cwx = (window.innerWidth  / 2 - offset.x) / scale - CARD_W / 2;
    const cwy = (window.innerHeight / 2 - offset.y) / scale - 120;
    const artboardType: ArtboardType = NODE_TO_ARTBOARD_TYPE[type] ?? 'sketch';
    const newNode: CanvasNode = {
      id: generateId(),
      type,
      title: `${NODE_DEFINITIONS[type].caption} #${num}`,
      position: { x: cwx, y: cwy },
      instanceNumber: num,
      hasThumbnail: false,
      artboardType,
    };
    const next = [...currentNodes, newNode];
    pushHistory(next);
    setExpandedNodeId(newNode.id);
    setActiveSidebarNodeType(null);
  }, [nodes, offset, scale, pushHistory]);

  /* ── '+' 버튼: 빈 아트보드 생성 ─────────────────────────────────── */
  const handleAddArtboard = useCallback(() => {
    const currentNodes = nodes;
    const num = currentNodes.length + 1;
    const cwx = (window.innerWidth  / 2 - offset.x) / scale - CARD_W / 2;
    const cwy = (window.innerHeight / 2 - offset.y) / scale - 120;
    const newNode: CanvasNode = {
      id: generateId(),
      type: 'sketch',
      title: `ARTBOARD #${num}`,
      position: { x: cwx, y: cwy },
      instanceNumber: num,
      hasThumbnail: false,
      artboardType: 'blank',
    };
    pushHistory([...currentNodes, newNode]);
    setSelectedNodeIds([newNode.id]);
    setActiveSidebarNodeType(null);
  }, [nodes, offset, scale, pushHistory]);

  /* ── 지적도 아트보드 노드 생성 (VWorld 1건 이상 수신 시) ────────── */
  const handleCadastralDataReceived = useCallback((pnu: string | null, landCount: number) => {
    const plannerNodeId = expandedNodeId;
    if (!plannerNodeId) return;

    setNodes(prev => {
      /* 같은 Planners 노드에서 이미 생성된 지적도 노드가 있으면 건너뜀 */
      const exists = prev.some(n => n.type === 'cadastral' && n.parentId === plannerNodeId);
      if (exists) {
        console.log('[지적도] 아트보드 생성 건너뜀 — 이미 존재하는 지적도 노드 있음');
        return prev;
      }

      const plannerNode = prev.find(n => n.id === plannerNodeId);
      if (!plannerNode) return prev;

      const newId = generateId();
      const cadastralCount = prev.filter(n => n.type === 'cadastral').length + 1;
      const newNode: CanvasNode = {
        id: newId,
        type: 'cadastral',
        title: `지적도 #${cadastralCount}`,
        position: {
          x: plannerNode.position.x + CARD_W + 60,
          y: plannerNode.position.y,
        },
        instanceNumber: cadastralCount,
        hasThumbnail: true,
        artboardType: 'image',
        cadastralPnu: pnu ?? undefined,
        parentId: plannerNodeId,
      };

      console.log(`[지적도] 아트보드 생성 완료 — 노드 ID: ${newId}, PNU: ${pnu ?? '없음'}, 브이월드 ${landCount}건`);

      setEdges(e => [...e, { id: generateId(), sourceId: plannerNodeId, targetId: newId }]);

      const next = [...prev, newNode];
      setHistory(h => [...h.slice(0, historyIndex + 1), next]);
      setHistoryIndex(i => i + 1);
      return next;
    });
  }, [expandedNodeId, historyIndex]);

  /* ── 이미지 드래그 & 드롭 → image 아트보드 노드 생성 ───────────── */
  const handleImageDrop = useCallback((imageDataUrl: string, worldPos: { x: number; y: number }) => {
    const num = nodes.filter(n => n.artboardType === 'image').length + 1;
    const newNode: CanvasNode = {
      id: generateId(),
      type: 'image',
      title: `Image #${num}`,
      position: {
        x: worldPos.x - CARD_W / 2,
        y: worldPos.y - CARD_H / 2,
      },
      instanceNumber: num,
      hasThumbnail: true,
      artboardType: 'image',
      thumbnailData: imageDataUrl,
    };
    pushHistory([...nodes, newNode]);
    setSelectedNodeIds([newNode.id]);
  }, [nodes, pushHistory]);

  /* ── ELEVATION: 현재 뷰 변경 ───────────────────────────────────── */
  const handleElevationViewChange = useCallback((nodeId: string, view: ElevationView) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId || !n.elevationData) return n;
      return { ...n, elevationData: { ...n.elevationData, currentView: view } };
    }));
  }, []);

  /* ── LINE DRAWING: ELEVATION 결과 → 라인드로잉 변환 ───────────── */
  const handleLineDrawingTrigger = useCallback(async (sourceNodeId: string) => {
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode?.elevationData || sourceNode.elevationData.isLoading) return;

    const { images } = sourceNode.elevationData;
    const hasImages = Object.values(images).some(v => v.length > 0);
    if (!hasImages) return;

    console.log('[LINE-DRAWING] ▶ 트리거 시작 — 소스 노드:', sourceNodeId);

    /* Line Drawing 노드 생성 — 로딩 상태 */
    const ldCount = nodes.filter(n => n.type === 'elevation' && n.title.startsWith('Line Drawing')).length + 1;
    const ldNodeId = generateId();
    const ldNode: CanvasNode = {
      id: ldNodeId,
      type: 'elevation',
      title: `Line Drawing #${ldCount}`,
      position: {
        x: sourceNode.position.x + CARD_W + 60,
        y: sourceNode.position.y,
      },
      instanceNumber: ldCount,
      hasThumbnail: false,
      artboardType: 'image',
      parentId: sourceNodeId,
      elevationData: {
        isLoading: true,
        currentView: 'front',
        images: { top: '', front: '', rear: '', left: '', right: '' },
        aeplSchema: {},
      },
    };

    pushHistory([...nodes, ldNode]);
    setEdges(e => [...e, { id: generateId(), sourceId: sourceNodeId, targetId: ldNodeId }]);
    setSelectedNodeIds([ldNodeId]);
    setActiveSidebarNodeType('elevation');

    console.log('[LINE-DRAWING] ◌ LineDrawingNode 생성 완료 — id:', ldNodeId);

    try {
      console.log('[LINE-DRAWING] → S2S 요청 전송: /api/elevation/linedrawing');
      const res = await fetch('/api/elevation/linedrawing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });

      console.log('[LINE-DRAWING] ← S2S 응답 수신 — status:', res.status);

      const json = await res.json() as {
        success: boolean;
        data?: { images: ElevationNodeData['images'] };
        error?: string;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error ?? 'Unknown error from Line Drawing backend');
      }

      const ldImages = json.data.images;

      console.log('[LINE-DRAWING] ✓ 라인드로잉 5-view 변환 완료');

      setNodes(prev => prev.map(n => {
        if (n.id !== ldNodeId) return n;
        return {
          ...n,
          hasThumbnail: true,
          elevationData: {
            isLoading: false,
            currentView: 'front' as ElevationView,
            images: ldImages,
            aeplSchema: {},
          },
        };
      }));

      console.log('[LINE-DRAWING] ■ 완료 — LineDrawingNode 업데이트');
    } catch (err) {
      console.error('[LINE-DRAWING] ✕ 오류:', err instanceof Error ? err.message : String(err));
      setNodes(prev => prev.map(n => {
        if (n.id !== ldNodeId) return n;
        return {
          ...n,
          elevationData: {
            isLoading: false,
            currentView: 'front' as ElevationView,
            images: { top: '', front: '', rear: '', left: '', right: '' },
            aeplSchema: { error: err instanceof Error ? err.message : String(err) },
          },
        };
      }));
    }
  }, [nodes, pushHistory, setEdges]);

  /* ── ELEVATION: S2S 트리거 (이미지 아트보드 선택 후 ELEVATION 클릭) */
  const handleElevationTrigger = useCallback(async (sourceNode: CanvasNode) => {
    const imageDataUrl = sourceNode.thumbnailData ?? sourceNode.generatedImageData;
    if (!imageDataUrl) return;

    /* data URI에서 mimeType + base64 추출 */
    const match = imageDataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)/);
    const mimeType   = match?.[1] ?? 'image/jpeg';
    const imageBase64 = match?.[2] ?? imageDataUrl;

    console.log('[ELEVATION] ▶ 트리거 시작 — 소스 노드:', sourceNode.id, '| mimeType:', mimeType);

    /* ElevationNode 생성 — 로딩 상태 */
    const elevCount = nodes.filter(n => n.type === 'elevation').length + 1;
    const elevNodeId = generateId();
    const elevNode: CanvasNode = {
      id: elevNodeId,
      type: 'elevation',
      title: `Image to Elevation #${elevCount}`,
      position: {
        x: sourceNode.position.x + CARD_W + 60,
        y: sourceNode.position.y,
      },
      instanceNumber: elevCount,
      hasThumbnail: false,
      artboardType: 'image',
      parentId: sourceNode.id,
      elevationData: {
        isLoading: true,
        currentView: 'top',
        images: { top: '', front: '', rear: '', left: '', right: '' },
        aeplSchema: {},
      },
    };

    /* 노드 + 엣지 추가 */
    pushHistory([...nodes, elevNode]);
    setEdges(e => [...e, { id: generateId(), sourceId: sourceNode.id, targetId: elevNodeId }]);
    setSelectedNodeIds([elevNodeId]);
    setActiveSidebarNodeType('elevation');

    console.log('[ELEVATION] ◌ ElevationNode 생성 완료 — id:', elevNodeId, '| 로딩 시작');

    /* S2S 호출 */
    try {
      console.log('[ELEVATION] → S2S 요청 전송: /api/elevation/process');
      const res = await fetch('/api/elevation/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType, prompt: '' }),
      });

      console.log('[ELEVATION] ← S2S 응답 수신 — status:', res.status);

      const json = await res.json() as {
        success: boolean;
        data?: { aeplSchema: Record<string, unknown>; images: ElevationNodeData['images'] };
        error?: string;
      };

      if (!json.success || !json.data) {
        throw new Error(json.error ?? 'Unknown error from ELEVATION backend');
      }

      const { aeplSchema, images } = json.data;

      console.log('[ELEVATION] ✓ Protocol A — AEPLSchema 수신:', JSON.stringify(aeplSchema).slice(0, 120));
      console.log('[ELEVATION] ✓ Protocol B — 5-view 이미지 생성 완료');

      setNodes(prev => prev.map(n => {
        if (n.id !== elevNodeId) return n;
        return {
          ...n,
          hasThumbnail: true,
          elevationData: {
            isLoading: false,
            currentView: 'top' as ElevationView,
            images,
            aeplSchema,
          },
        };
      }));

      console.log('[ELEVATION] ■ 완료 — ElevationNode 업데이트');
    } catch (err) {
      console.error('[ELEVATION] ✕ 오류:', err instanceof Error ? err.message : String(err));
      setNodes(prev => prev.map(n => {
        if (n.id !== elevNodeId) return n;
        return {
          ...n,
          elevationData: {
            isLoading: false,
            currentView: 'top' as ElevationView,
            images: { top: '', front: '', rear: '', left: '', right: '' },
            aeplSchema: { error: err instanceof Error ? err.message : String(err) },
          },
        };
      }));
    }
  }, [nodes, pushHistory, setEdges]);

  /* ── expand에서 돌아올 때 썸네일 생성 + 메시지·인사이트 저장 ─── */
  const handleReturnFromExpand = useCallback(() => {
    if (!expandedNodeId) { setExpandedNodeId(null); return; }
    const savedMessages    = plannerMessagesRef.current;
    const savedInsightData = plannerInsightDataRef.current;
    setNodes(prev => {
      const next = prev.map(n => {
        if (n.id !== expandedNodeId) return n;
        const hasMsgs    = savedMessages.length > 0;
        const hasInsight = savedInsightData !== null;
        return {
          ...n,
          hasThumbnail: true,
          ...(hasMsgs    ? { plannerMessages:    savedMessages    } : {}),
          ...(hasInsight ? { plannerInsightData: savedInsightData } : {}),
        };
      });
      setHistory(h => [...h.slice(0, historyIndex + 1), next]);
      setHistoryIndex(i => i + 1);
      return next;
    });
    plannerMessagesRef.current    = [];
    plannerInsightDataRef.current = null;
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
    const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

    /* ── 아트보드가 선택된 경우: 직접 액션 ──────────────────────── */
    if (selectedNode) {
      const targetArtboardType = NODE_TO_ARTBOARD_TYPE[type];
      if (!targetArtboardType) return;

      /* blank 아트보드: 유형 배정 */
      if (selectedNode.artboardType === 'blank') {
        const next = nodes.map(n =>
          n.id === selectedNode.id
            ? { ...n, artboardType: targetArtboardType, type }
            : n
        );
        pushHistory(next);
      }

      /* expand 진입 노드 → 즉시 expand */
      if (NODES_THAT_EXPAND.includes(type)) {
        setExpandedNodeId(selectedNode.id);
        setActiveSidebarNodeType(null);
        return;
      }

      /* ELEVATION 인-캔버스 노드 — S2S 트리거 */
      if (type === 'elevation' && selectedNode.artboardType === 'image') {
        void handleElevationTrigger(selectedNode);
        return;
      }

      setActiveSidebarNodeType(null);
      return;
    }

    /* ── 아트보드 미선택: 기존 동작 ─────────────────────────────── */
    if (DIRECT_EXPAND_NODES.includes(type)) {
      createAndExpandNode(type);
      return;
    }
    setActiveSidebarNodeType(prev => prev === type ? null : type);
  }, [selectedNodeId, nodes, pushHistory, createAndExpandNode]);

  /* ── "→" 버튼: 사이드바 패널에서 expand 진입 ──────────────────────── */
  const handleNavigateToExpand = useCallback((type: NodeType) => {
    if (selectedNodeId) {
      const selected = nodes.find(n => n.id === selectedNodeId);
      if (selected && selected.type === type) {
        setExpandedNodeId(selectedNodeId);
        setActiveSidebarNodeType(null);
        return;
      }
    }
    createAndExpandNode(type);
  }, [selectedNodeId, nodes, createAndExpandNode]);

  /* ── 썸네일 단일 클릭 → 선택 + 패널 열기 ───────────────────────── */
  const handleNodeCardSelect = useCallback((id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setSelectedNodeIds([id]);
    /* thumbnail 아트보드: 자동으로 PLANNERS 패널 표시 */
    if (node.artboardType === 'thumbnail') {
      setActiveSidebarNodeType('planners');
    } else if (node.type === 'elevation') {
      /* ELEVATION 노드 클릭: AEPL + 갤러리 패널 표시 */
      setActiveSidebarNodeType('elevation');
    } else {
      setActiveSidebarNodeType(null);
    }
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

    if (state === 0) {
      savedViewRef.current = { scale, offset };

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

      {expandedNode ? (
        <ExpandedView
          node={expandedNode}
          onCollapse={handleReturnFromExpand}
          onPlannerMessagesChange={msgs => { plannerMessagesRef.current = msgs; }}
          onInsightDataChange={data => { plannerInsightDataRef.current = data as import('@/types/canvas').SavedInsightData | null; }}
          initialInsightData={expandedNode.plannerInsightData as import('@/planners/lib/lawApi').FetchLawsResult | null ?? null}
          onCadastralDataReceived={handleCadastralDataReceived}
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
          onAddArtboard={handleAddArtboard}
        />
      ) : (
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
            onImageDrop={handleImageDrop}
            onLineDrawing={handleLineDrawingTrigger}
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
            onAddArtboard={handleAddArtboard}
          />

          <RightSidebar
            activeSidebarNodeType={activeSidebarNodeType}
            selectedArtboardType={selectedArtboardType}
            onNodeTabSelect={handleNodeTabSelect}
            onNavigateToExpand={handleNavigateToExpand}
            plannerMessages={
              selectedNodeId
                ? nodes.find(n => n.id === selectedNodeId)?.plannerMessages
                : undefined
            }
            elevationData={
              selectedNodeId && activeSidebarNodeType === 'elevation'
                ? nodes.find(n => n.id === selectedNodeId)?.elevationData
                : undefined
            }
            onElevationViewChange={
              selectedNodeId
                ? (view) => handleElevationViewChange(selectedNodeId, view)
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
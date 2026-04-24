'use client';

import { useState, useRef, useEffect } from 'react';
import { CanvasNode, NodeType, NODE_DEFINITIONS, ActiveTool, PlannerMessage } from '@/types/canvas';
import LeftToolbar from '@/components/LeftToolbar';
import PlannersPanel from '@/planners/PlannersPanel';
import ExpandedSidebar from '@/components/ExpandedSidebar';
import { PlannersInsightPanel } from '@/components/panels/PlannersInsightPanel';
import type { FetchLawsResult } from '@/planners/lib/lawApi';

interface Props {
  node: CanvasNode;
  onCollapse: () => void;
  onPlannerMessagesChange?: (messages: PlannerMessage[]) => void;
  onInsightDataChange?: (data: FetchLawsResult | null) => void;
  initialInsightData?: FetchLawsResult | null;
  onCadastralDataReceived?: (pnu: string | null, landCount: number) => void;
  activeTool: ActiveTool;
  scale: number;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (t: ActiveTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onAddArtboard: () => void;
}

const IC = { stroke: 'currentColor', fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const IconChevronUp   = () => <svg viewBox="0 0 20 20" {...IC}><polyline points="4,13 10,7 16,13" /></svg>;
const IconChevronDown = () => <svg viewBox="0 0 20 20" {...IC}><polyline points="4,7 10,13 16,7" /></svg>;
const IconCollapse    = () => <svg viewBox="0 0 20 20" {...IC}><path d="M16 10H4M9 5L4 10L9 15" /></svg>;


/* ══════════════════════════════════════════════════════════════
   CadastralExpandedView — 지적도 아트보드 전체화면
══════════════════════════════════════════════════════════════ */
function CadastralExpandedView({ pnu }: { pnu: string | null }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const iframeSrc = pnu
    ? `https://www.eum.go.kr/web/ar/lu/luLandDet.jsp?isNoScr=script&mode=search&pnu=${pnu}`
    : null;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-app-bg)' }}>
      {iframeSrc ? (
        <>
          {status === 'loading' && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              background: 'var(--color-app-bg)', zIndex: 10,
            }}>
              <span className="text-caption" style={{ color: 'var(--color-gray-300)' }}>지적도 불러오는 중…</span>
            </div>
          )}
          {status === 'error' && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              background: 'var(--color-app-bg)', zIndex: 10,
            }}>
              <span className="text-title" style={{ color: 'var(--color-gray-300)', letterSpacing: '0.08em' }}>지적도</span>
              <span style={{ display: 'block', width: 48, height: 1, background: 'var(--color-gray-200)' }} />
              <span className="text-caption" style={{ color: 'var(--color-gray-300)' }}>지도를 불러올 수 없습니다</span>
              <a
                href={iframeSrc}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginTop: '0.5rem', padding: '0.5rem 1.25rem',
                  background: 'var(--color-black)', color: 'var(--color-white)',
                  borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-family-bebas)',
                  fontSize: '0.875rem', letterSpacing: '0.08em', textDecoration: 'none',
                }}
              >
                토지이음에서 열기 →
              </a>
            </div>
          )}
          <iframe
            src={iframeSrc}
            style={{ width: '100%', height: '100%', border: 'none', display: status === 'error' ? 'none' : 'block' }}
            title={`지적도 — PNU ${pnu}`}
            onLoad={() => {
              setStatus('success');
              console.log('[지적도] 아트보드 생성 완료 — iframe 로드 성공');
            }}
            onError={() => {
              setStatus('error');
              console.error('[지적도] 아트보드 생성 실패 — iframe 로드 오류 (X-Frame-Options 차단 가능성)');
            }}
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </>
      ) : (
        /* PNU 없이 생성된 지적도 노드 — 빈 화면 */
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        }}>
          <span className="text-title" style={{ fontSize: '1.25rem', color: 'var(--color-gray-300)', letterSpacing: '0.08em' }}>
            지적도
          </span>
          <span style={{ display: 'block', width: 48, height: 1, background: 'var(--color-gray-200)' }} />
          <span className="text-caption" style={{ color: 'var(--color-gray-300)' }}>
            PNU 코드 없음 — 주소를 포함한 안건을 입력하세요
          </span>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SketchInfiniteGrid — sketch/blank 아트보드용 무한 그리드
   실제 드로잉 도구는 추후 구현
══════════════════════════════════════════════════════════════ */
const SKETCH_GRID_SIZE = 32;

function SketchInfiniteGrid() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [gridOffset, setGridOffset] = useState({ x: 0, y: 0 });
  const [localScale, setLocalScale] = useState(1);

  const isPanning    = useRef(false);
  const panStart     = useRef({ x: 0, y: 0 });
  const offsetSnap   = useRef({ x: 0, y: 0 });
  const scaleRef     = useRef(localScale);
  const offsetRef    = useRef(gridOffset);

  useEffect(() => { scaleRef.current  = localScale; },  [localScale]);
  useEffect(() => { offsetRef.current = gridOffset; }, [gridOffset]);

  /* 휠 줌 */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const prev = scaleRef.current;
      const next = Math.max(0.2, Math.min(4, prev * (e.deltaY < 0 ? 1.1 : 0.9)));
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const off = offsetRef.current;
      setLocalScale(next);
      setGridOffset({ x: mx - (mx - off.x) * (next / prev), y: my - (my - off.y) * (next / prev) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* 팬 */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!isPanning.current) return;
      setGridOffset({
        x: offsetSnap.current.x + (e.clientX - panStart.current.x),
        y: offsetSnap.current.y + (e.clientY - panStart.current.y),
      });
    };
    const onUp = () => { isPanning.current = false; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isPanning.current  = true;
    panStart.current   = { x: e.clientX, y: e.clientY };
    offsetSnap.current = { ...offsetRef.current };
  };

  const gs  = SKETCH_GRID_SIZE * localScale;
  const gox = ((gridOffset.x % gs) + gs) % gs;
  const goy = ((gridOffset.y % gs) + gs) % gs;

  return (
    <div
      ref={wrapperRef}
      onPointerDown={handlePointerDown}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        touchAction: 'none',
        cursor: 'crosshair',
        backgroundColor: 'var(--color-app-bg)',
        backgroundImage: `
          linear-gradient(var(--color-gray-100) 1px, transparent 1px),
          linear-gradient(90deg, var(--color-gray-100) 1px, transparent 1px)
        `,
        backgroundSize: `${gs}px ${gs}px`,
        backgroundPosition: `${gox}px ${goy}px`,
      }}
    >
      {/* 중앙 원점 마커 */}
      <div
        style={{
          position: 'absolute',
          left: gridOffset.x - 3,
          top:  gridOffset.y - 3,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--color-gray-200)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ExpandedView — 전체 화면 확장 뷰
══════════════════════════════════════════════════════════════ */
export default function ExpandedView({
  node, onCollapse, onPlannerMessagesChange, onInsightDataChange, initialInsightData,
  onCadastralDataReceived,
  activeTool, scale, canUndo, canRedo,
  onToolChange, onUndo, onRedo, onZoomIn, onZoomOut, onZoomReset,
  onAddArtboard,
}: Props) {
  const def = NODE_DEFINITIONS[node.type];
  const isSketchMode = node.artboardType === 'sketch' || node.artboardType === 'blank';
  const [insightData, setInsightData] = useState<FetchLawsResult | null>(initialInsightData ?? null);

  /* insightData 변경 시 부모에 알림 (저장용) */
  useEffect(() => {
    onInsightDataChange?.(insightData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insightData]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--color-app-bg)' }}>

      {isSketchMode ? (
        /* ── sketch/blank: 무한 그리드 전체 화면 ─────────────────── */
        <SketchInfiniteGrid />
      ) : node.type === 'cadastral' ? (
        /* ── 지적도 노드: VWorld 지적도 전체화면 ─────────────────── */
        <CadastralExpandedView pnu={node.cadastralPnu ?? null} />
      ) : node.type === 'planners' ? (
        /* ── Planners 노드: 100% 화면을 채우는 Planners UI ──────── */
        <div style={{
          position: 'absolute',
          inset: 0,
          left: 'calc(4rem + 1.5rem)',
          right: 'calc(var(--sidebar-w) + 2rem)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '2rem 0',
        }}>
          <PlannersPanel
            onInsightDataUpdate={setInsightData}
            onCadastralDataReceived={onCadastralDataReceived}
            initialMessages={node.plannerMessages as never}
            onMessagesChange={msgs => onPlannerMessagesChange?.(msgs as unknown as PlannerMessage[])}
          />
        </div>
      ) : (
        /* ── image/thumbnail: 기존 A4 프레임 플레이스홀더 ──────── */
        <div style={{
          position: 'absolute',
          inset: 0,
          left: 'calc(4rem + 1.5rem)',
          right: 'calc(var(--sidebar-w) + 2rem)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          padding: '2rem',
        }}>
          <div style={{
            width: '100%',
            maxWidth: 800,
            aspectRatio: '297 / 210',
            background: 'var(--color-white)',
            borderRadius: 'var(--radius-box)',
            boxShadow: 'var(--shadow-float)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
          }}>
            <span className="text-title" style={{ fontSize: '1.25rem', color: 'var(--color-gray-300)', letterSpacing: '0.08em' }}>
              {def.displayLabel}
            </span>
            <span style={{ display: 'block', width: 48, height: 1, background: 'var(--color-gray-200)' }} />
            <span className="text-body-3" style={{ color: 'var(--color-gray-400)' }}>
              {node.title}
            </span>
            <span className="text-caption" style={{ color: 'var(--color-gray-300)', marginTop: 4 }}>
              API 연동 후 작업 화면이 표시됩니다.
            </span>
          </div>
        </div>
      )}

      {/* ── 좌측 툴바 ─────────────────────────────────────────────── */}
      <LeftToolbar
        activeTool={activeTool}
        scale={scale}
        canUndo={canUndo}
        canRedo={canRedo}
        onToolChange={onToolChange}
        onUndo={onUndo}
        onRedo={onRedo}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomReset={onZoomReset}
        onAddArtboard={onAddArtboard}
      />

      {/* ── 우측 사이드바 ──────────────────────────────────────────── */}
      <ExpandedSidebar currentNodeType={node.type} onCollapse={onCollapse}>
        {node.type === 'planners' && <PlannersInsightPanel apiInsightData={insightData} />}
      </ExpandedSidebar>
    </div>
  );
}
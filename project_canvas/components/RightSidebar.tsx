'use client';

import { useState } from 'react';
import { NodeType, NODE_DEFINITIONS, NODE_ORDER, ArtboardType, ARTBOARD_COMPATIBLE_NODES, PlannerMessage, ElevationNodeData, ElevationView } from '@/types/canvas';
import ElevationRightPanel from '@/components/panels/ElevationRightPanel';

interface Props {
  activeSidebarNodeType: NodeType | null;
  selectedArtboardType: ArtboardType | null;
  onNodeTabSelect: (type: NodeType) => void;
  onNavigateToExpand: (type: NodeType) => void;
  plannerMessages?: PlannerMessage[];
  elevationData?: ElevationNodeData;
  onElevationViewChange?: (view: ElevationView) => void;
  onLineDrawing?: () => void;
}

const IC = { stroke: 'currentColor', fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const IconChevronUp   = () => <svg viewBox="0 0 20 20" {...IC}><polyline points="4,13 10,7 16,13" /></svg>;
const IconChevronDown = () => <svg viewBox="0 0 20 20" {...IC}><polyline points="4,7 10,13 16,7" /></svg>;
const IconNavigate    = () => (
  <svg viewBox="0 0 20 20" {...IC}><path d="M4 10H16M11 5L16 10L11 15" /></svg>
);

/* shortFinalOutput "[카테고리] 내용" 형식 파싱 */
function parseShortFinal(text: string): Array<{ label: string; body: string }> {
  const items = text.split(/(?=\[)/).map(s => s.trim()).filter(Boolean);
  return items.slice(0, 4).map(item => {
    const bracket = item.match(/^\[([^\]]+)\]/);
    return {
      label: bracket?.[1] ?? '',
      body:  bracket ? item.slice(bracket[0].length).trim() : item,
    };
  });
}

/* finalOutput에서 첫 의미 있는 줄 추출 */
function extractFirstLine(text: string): string {
  const clean = text
    .replace(/^#{1,4}\s.+$/gm, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*>]\s/gm, '')
    .replace(/\[CITE_REF:\d+\]/g, '')
    .trim();
  const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 10);
  return lines[0]?.slice(0, 120) ?? '';
}

/* ── Planners 보고서 프리뷰 패널 ─────────────────────────────── */
function PlannerReportPanel({ messages, onGenerate }: {
  messages: PlannerMessage[];
  onGenerate: () => void;
}) {
  const lastUser = [...messages].reverse().find(m => m.type === 'user');
  const lastAi   = [...messages].reverse().find(m => m.type === 'ai');
  const data     = lastAi?.type === 'ai' ? lastAi.data : null;

  const shortFinal  = data?.shortFinalOutput as string | undefined;
  const finalOutput = data?.finalOutput as string | undefined;
  const bullets     = shortFinal ? parseShortFinal(shortFinal) : [];
  const fallbackLine = (!shortFinal && finalOutput) ? extractFirstLine(finalOutput) : '';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: '1rem 1rem 1rem',
    }}>
      {/* 마지막 질문 */}
      {lastUser?.type === 'user' && (
        <div style={{
          marginBottom: '0.75rem', padding: '0.625rem 0.75rem',
          background: 'var(--color-gray-50, #f9f9f9)',
          borderRadius: '0.5rem',
          borderLeft: '2px solid var(--color-gray-200)',
        }}>
          <p style={{
            fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-gray-400)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.25rem',
          }}>
            Q
          </p>
          <p style={{
            fontSize: '0.7rem', color: 'var(--color-gray-600)', lineHeight: 1.5,
            margin: 0, overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
          }}>
            {lastUser.text}
          </p>
        </div>
      )}

      {/* 기획서 요약 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {bullets.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <p style={{
              fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-gray-400)',
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.25rem',
            }}>
              최종 기획서
            </p>
            {bullets.map((b, i) => (
              <div key={i} style={{
                display: 'flex', gap: '0.375rem', alignItems: 'flex-start',
                padding: '0.375rem 0.5rem',
                background: 'var(--color-white)', border: '1px solid var(--color-gray-100)',
                borderRadius: '0.5rem',
              }}>
                {b.label && (
                  <span style={{
                    fontSize: '0.55rem', fontWeight: 900,
                    background: 'var(--color-black)', color: 'var(--color-white)',
                    borderRadius: '0.25rem', padding: '1px 4px',
                    lineHeight: 1.4, flexShrink: 0, whiteSpace: 'nowrap',
                    maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {b.label}
                  </span>
                )}
                <span style={{
                  fontSize: '0.65rem', color: 'var(--color-gray-600)', lineHeight: 1.5,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                }}>
                  {b.body}
                </span>
              </div>
            ))}
          </div>
        ) : fallbackLine ? (
          <div style={{ padding: '0.5rem 0.75rem', background: 'var(--color-gray-50, #f9f9f9)', borderRadius: '0.5rem' }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-gray-400)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              최종 기획서
            </p>
            <p style={{ fontSize: '0.68rem', color: 'var(--color-gray-600)', lineHeight: 1.5, margin: 0 }}>
              {fallbackLine}…
            </p>
          </div>
        ) : null}
      </div>

      {/* GENERATE 버튼 */}
      <button
        onClick={onGenerate}
        style={{
          width: '100%', height: 'var(--h-cta-lg)', border: 'none',
          borderRadius: 'var(--radius-pill)', background: 'var(--color-black)',
          color: 'var(--color-white)', fontFamily: 'var(--font-family-bebas)',
          fontSize: '1rem', letterSpacing: '0.08em', cursor: 'pointer',
          transition: 'opacity 120ms ease', flexShrink: 0, marginTop: '0.75rem',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        OPEN
      </button>
    </div>
  );
}

/* ── 기본 노드 패널 (대화 이력 없을 때) ──────────────────────── */
function NodePanel({ type, onGenerate, plannerMessages }: {
  type: NodeType;
  onGenerate: () => void;
  plannerMessages?: PlannerMessage[];
}) {
  const def = NODE_DEFINITIONS[type];
  const hasMessages = type === 'planners' && plannerMessages && plannerMessages.length > 0;

  if (hasMessages) {
    return <PlannerReportPanel messages={plannerMessages!} onGenerate={onGenerate} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '1.5rem 1rem 1rem', gap: '0.75rem' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <span className="text-title" style={{ fontSize: '0.75rem', color: 'var(--color-gray-300)', letterSpacing: '0.08em' }}>
          {def.displayLabel}
        </span>
        <span style={{ display: 'block', width: 28, height: 1, background: 'var(--color-gray-200)' }} />
        <span className="text-caption" style={{ color: 'var(--color-gray-300)', textAlign: 'center' }}>
          API 연동 후 활성화
        </span>
      </div>
      <button
        onClick={onGenerate}
        style={{
          width: '100%', height: 'var(--h-cta-lg)', border: 'none',
          borderRadius: 'var(--radius-pill)', background: 'var(--color-black)',
          color: 'var(--color-white)', fontFamily: 'var(--font-family-bebas)',
          fontSize: '1rem', letterSpacing: '0.08em', cursor: 'pointer',
          transition: 'opacity 120ms ease', flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        GENERATE
      </button>
    </div>
  );
}

/* ── 아트보드 유형별 헤더 레이블 ──────────────────────────────── */
const ARTBOARD_TOOLS_LABEL: Record<'sketch' | 'image', string> = {
  sketch: 'SKETCH TOOLS',
  image:  'IMAGE TOOLS',
};

export default function RightSidebar({
  activeSidebarNodeType, selectedArtboardType,
  onNodeTabSelect, onNavigateToExpand,
  plannerMessages, elevationData, onElevationViewChange, onLineDrawing,
}: Props) {
  const [accordionOpen, setAccordionOpen] = useState(true);

  const isPanelMode = activeSidebarNodeType !== null;

  const area: React.CSSProperties = {
    position: 'absolute', right: '1rem', top: '1rem', bottom: '1rem',
    width: 'var(--sidebar-w)', display: 'flex', flexDirection: 'column',
    gap: '0.5rem', zIndex: 90, pointerEvents: 'none',
    overflowY: isPanelMode ? 'hidden' : 'auto', overflowX: 'hidden',
  };

  const pill = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    background: 'var(--color-white)', borderRadius: 'var(--radius-pill)',
    boxShadow: 'var(--shadow-float)', pointerEvents: 'all', flexShrink: 0, ...extra,
  });

  const hoverOn  = (e: React.MouseEvent<HTMLButtonElement>) =>
    (e.currentTarget.style.backgroundColor = 'var(--color-gray-100)');
  const hoverOff = (e: React.MouseEvent<HTMLButtonElement>) =>
    (e.currentTarget.style.backgroundColor = 'transparent');

  const tabBtn = (type: NodeType) => (
    <div key={type} style={pill()}>
      <button
        onClick={() => onNodeTabSelect(type)}
        style={{
          width: '100%', height: 'var(--h-cta-lg)', display: 'flex',
          alignItems: 'center', padding: '0 1rem', border: 'none',
          background: 'transparent', cursor: 'pointer',
          borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-family-bebas)',
          fontSize: '1rem', letterSpacing: '0.04em', color: 'var(--color-black)',
          textAlign: 'left', transition: 'background-color 150ms ease',
        }}
        onMouseEnter={hoverOn}
        onMouseLeave={hoverOff}
        onMouseDown={e => (e.currentTarget.style.backgroundColor = 'var(--color-gray-200)')}
        onMouseUp={e => (e.currentTarget.style.backgroundColor = 'var(--color-gray-100)')}
      >
        {NODE_DEFINITIONS[type].displayLabel}
      </button>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     SKETCH TOOLS / IMAGE TOOLS 모드
     — sketch 또는 image 아트보드가 선택된 상태
     — 호환 노드 탭만 표시, 클릭 시 직접 액션 (패널 없음)
  ══════════════════════════════════════════════════════════════ */
  if ((selectedArtboardType === 'sketch' || selectedArtboardType === 'image') && activeSidebarNodeType !== 'elevation') {
    const label = ARTBOARD_TOOLS_LABEL[selectedArtboardType];
    const compatibleNodes = ARTBOARD_COMPATIBLE_NODES[selectedArtboardType];
    return (
      <div style={area}>
        {/* 헤더 */}
        <div style={pill()}>
          <div style={{
            width: '100%', height: 'var(--h-cta-lg)', display: 'flex',
            alignItems: 'center', padding: '0 1rem',
          }}>
            <span className="text-title" style={{ color: 'var(--color-black)', letterSpacing: '0.04em' }}>
              {label}
            </span>
          </div>
        </div>
        {/* 호환 노드 탭 목록 */}
        {compatibleNodes.map(tabBtn)}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     PANEL 모드 — thumbnail 아트보드 선택 시 or 미선택 탭 클릭
  ══════════════════════════════════════════════════════════════ */
  if (isPanelMode) {
    return (
      <div style={{ ...area, overflowY: 'hidden' }}>
        {/* 헤더 행: [→ pill (elevation 제외)] + [노드탭 pill] */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', flexShrink: 0 }}>
          {activeSidebarNodeType !== 'elevation' && (
            <div style={{ ...pill(), width: 'var(--h-cta-lg)', height: 'var(--h-cta-lg)' }}>
              <button
                onClick={() => onNavigateToExpand(activeSidebarNodeType!)}
                title="expand로 이동"
                style={{
                  width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', border: 'none', background: 'transparent',
                  cursor: 'pointer', borderRadius: 'var(--radius-pill)',
                  color: 'var(--color-gray-500)', transition: 'background-color 100ms ease, color 100ms ease',
                }}
                onMouseEnter={e => { hoverOn(e); e.currentTarget.style.color = 'var(--color-black)'; }}
                onMouseLeave={e => { hoverOff(e); e.currentTarget.style.color = 'var(--color-gray-500)'; }}
              >
                <span style={{ width: 20, height: 20, display: 'flex' }}><IconNavigate /></span>
              </button>
            </div>
          )}

          <div style={{ ...pill(), flex: 1 }}>
            <button
              onClick={() => onNodeTabSelect(activeSidebarNodeType!)}
              style={{
                width: '100%', height: 'var(--h-cta-lg)', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between',
                padding: '0 0.875rem 0 1rem', border: 'none', background: 'transparent',
                cursor: 'pointer', borderRadius: 'var(--radius-pill)',
                transition: 'background-color 100ms ease',
              }}
              onMouseEnter={hoverOn}
              onMouseLeave={hoverOff}
            >
              <span className="text-title" style={{ color: 'var(--color-black)', letterSpacing: '0.04em' }}>
                {NODE_DEFINITIONS[activeSidebarNodeType!].displayLabel}
              </span>
              <span style={{ width: 16, height: 16, display: 'flex', color: 'var(--color-gray-500)', flexShrink: 0 }}>
                <IconChevronUp />
              </span>
            </button>
          </div>
        </div>

        {/* 패널 본문 */}
        <div style={{
          background: 'var(--color-white)', borderRadius: 'var(--radius-box)',
          boxShadow: 'var(--shadow-float)', flex: 1, minHeight: 0, pointerEvents: 'all',
        }}>
          {activeSidebarNodeType === 'elevation' && elevationData ? (
            <ElevationRightPanel
              elevationData={elevationData}
              onViewChange={view => onElevationViewChange?.(view)}
              onLineDrawing={elevationData.isLoading ? undefined : onLineDrawing}
            />
          ) : (
            <NodePanel
              type={activeSidebarNodeType!}
              onGenerate={() => onNavigateToExpand(activeSidebarNodeType!)}
              plannerMessages={plannerMessages}
            />
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     SELECT TOOLS 모드 — 아트보드 미선택 / blank 선택
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="no-scrollbar" style={area}>
      <div style={pill()}>
        <button
          onClick={() => setAccordionOpen(v => !v)}
          style={{
            width: '100%', height: 'var(--h-cta-lg)', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between',
            padding: '0 0.875rem 0 1rem', border: 'none', background: 'transparent',
            cursor: 'pointer', borderRadius: 'var(--radius-pill)',
            transition: 'background-color 100ms ease',
          }}
          onMouseEnter={hoverOn}
          onMouseLeave={hoverOff}
        >
          <span className="text-title" style={{ color: 'var(--color-black)', letterSpacing: '0.04em' }}>
            SELECT TOOLS
          </span>
          <span style={{ width: 16, height: 16, display: 'flex', color: 'var(--color-gray-500)', flexShrink: 0 }}>
            {accordionOpen ? <IconChevronUp /> : <IconChevronDown />}
          </span>
        </button>
      </div>

      {accordionOpen && NODE_ORDER.map(tabBtn)}
    </div>
  );
}
'use client';

import { ElevationNodeData, ElevationView } from '@/types/canvas';

interface Props {
  elevationData: ElevationNodeData;
  onViewChange: (view: ElevationView) => void;
}

/* AEPL 수치 필드 표시 설정 */
const DIMENSION_FIELDS: { key: string; label: string }[] = [
  { key: 'width',  label: 'W' },
  { key: 'height', label: 'H' },
  { key: 'depth',  label: 'D' },
];

/* 뷰 갤러리 레이아웃: 윗줄 [Left][Top][Right], 아랫줄 [Front][Rear] */
const VIEW_ROWS: { key: ElevationView; label: string }[][] = [
  [
    { key: 'left',  label: 'LEFT'  },
    { key: 'top',   label: 'TOP'   },
    { key: 'right', label: 'RIGHT' },
  ],
  [
    { key: 'front', label: 'FRONT' },
    { key: 'rear',  label: 'REAR'  },
  ],
];

/* 로딩 스켈레톤 */
function LoadingSkeleton() {
  const bar = (h: number, w = '100%') => (
    <div style={{
      width: w, height: h,
      background: 'var(--color-gray-100)',
      borderRadius: 6,
      animation: 'elevation-pulse 1.4s ease-in-out infinite',
    }} />
  );

  return (
    <>
      <style>{`
        @keyframes elevation-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {bar(22, '30%')} {bar(22, '30%')} {bar(22, '30%')}
        </div>
        {bar(18, '70%')} {bar(18, '55%')}
        <div style={{ height: 1, background: 'var(--color-gray-100)', margin: '0.25rem 0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ aspectRatio: '1 / 1', background: 'var(--color-gray-100)', borderRadius: 6, animation: 'elevation-pulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} style={{ flex: '0 0 calc(33.33% - 0.125rem)', aspectRatio: '1 / 1', background: 'var(--color-gray-100)', borderRadius: 6, animation: 'elevation-pulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
    </>
  );
}

export default function ElevationRightPanel({ elevationData, onViewChange }: Props) {
  const { isLoading, currentView, images, aeplSchema } = elevationData;

  if (isLoading) return <LoadingSkeleton />;

  /* AEPL 스키마 필드 타입 가드 */
  const aepl = aeplSchema as {
    width?: number;
    height?: number;
    depth?: number;
    materials?: { base?: string; secondary?: string; glass?: string };
    articulation?: { void_ratio?: number; body_rhythm?: string; top_structure?: string };
    error?: string;
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflowY: 'auto',
      padding: '1rem', gap: '0.75rem',
    }}>

      {/* ── 오류 상태 ────────────────────────────────────────────── */}
      {aepl.error && (
        <div style={{
          padding: '0.5rem 0.625rem',
          background: '#fff0f0',
          border: '1px solid #fecaca',
          borderRadius: '0.375rem',
        }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, color: '#cc0000', marginBottom: '0.25rem' }}>
            ERROR
          </p>
          <p style={{ fontSize: '0.6rem', color: '#cc0000', lineHeight: 1.4, margin: 0 }}>
            {aepl.error}
          </p>
        </div>
      )}

      {/* ── Analysis Parameters ──────────────────────────────────── */}
      {!aepl.error && (
        <div>
          <p style={{
            fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-gray-400)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.5rem',
          }}>
            Analysis
          </p>

          {/* 치수 뱃지 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
            {DIMENSION_FIELDS.map(({ key, label }) => {
              const val = aepl[key as keyof typeof aepl];
              if (typeof val !== 'number') return null;
              return (
                <span key={key} style={{
                  fontSize: '0.6rem', fontWeight: 700,
                  background: 'var(--color-black)', color: 'var(--color-white)',
                  borderRadius: '0.25rem', padding: '2px 7px', lineHeight: 1.6,
                }}>
                  {label}: {val.toFixed(1)}
                </span>
              );
            })}
          </div>

          {/* 재질 뱃지 */}
          {aepl.materials && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {(
                [
                  ['Base',      aepl.materials.base],
                  ['Secondary', aepl.materials.secondary],
                  ['Glass',     aepl.materials.glass],
                ] as [string, string | undefined][]
              ).map(([label, val]) => val ? (
                <div key={label} style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.55rem', color: 'var(--color-gray-400)',
                    minWidth: 48, flexShrink: 0,
                  }}>
                    {label}
                  </span>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 600, color: 'var(--color-gray-700)',
                    background: 'var(--color-gray-50, #f9f9f9)',
                    border: '1px solid var(--color-gray-100)',
                    borderRadius: '0.25rem', padding: '1px 6px',
                  }}>
                    {val}
                  </span>
                </div>
              ) : null)}
            </div>
          )}
        </div>
      )}

      <div style={{ height: 1, background: 'var(--color-gray-100)', flexShrink: 0 }} />

      {/* ── 5-View Gallery ──────────────────────────────────────── */}
      <div>
        <p style={{
          fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-gray-400)',
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.5rem',
        }}>
          Views
        </p>

        {/* Row 1: Left / Top / Right */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem', marginBottom: '0.375rem' }}>
          {VIEW_ROWS[0].map(({ key, label }) => (
            <ViewThumb key={key} viewKey={key} label={label} imgSrc={images[key]} isActive={currentView === key} onClick={onViewChange} />
          ))}
        </div>

        {/* Row 2: Front / Rear — 중앙 정렬 */}
        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
          {VIEW_ROWS[1].map(({ key, label }) => (
            <div key={key} style={{ flex: '0 0 calc(33.33% - 0.125rem)' }}>
              <ViewThumb viewKey={key} label={label} imgSrc={images[key]} isActive={currentView === key} onClick={onViewChange} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* 개별 뷰 썸네일 버튼 */
function ViewThumb({ viewKey, label, imgSrc, isActive, onClick }: {
  viewKey: ElevationView;
  label: string;
  imgSrc: string;
  isActive: boolean;
  onClick: (v: ElevationView) => void;
}) {
  return (
    <button
      onClick={() => onClick(viewKey)}
      title={`${label} view`}
      style={{
        display: 'block',
        width: '100%',
        aspectRatio: '1 / 1',
        padding: 0,
        border: isActive ? '2px solid var(--color-black)' : '1.5px solid var(--color-gray-100)',
        borderRadius: '0.375rem',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        background: 'var(--color-gray-50, #f9f9f9)',
        transition: 'border-color 100ms ease',
        boxSizing: 'border-box',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--color-gray-300)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--color-gray-100)'; }}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={label}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '0.45rem', fontWeight: 900, color: 'var(--color-gray-300)' }}>
            {label[0]}
          </span>
        </div>
      )}
      <span style={{
        position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
        fontSize: '0.45rem', fontWeight: 900, letterSpacing: '0.04em',
        color: isActive ? 'var(--color-black)' : 'var(--color-gray-400)',
        textTransform: 'uppercase',
        background: 'rgba(255,255,255,0.85)',
        padding: '0 2px', borderRadius: 2, whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        {label}
      </span>
    </button>
  );
}

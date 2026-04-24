# CAI-CANVAS — Planners 통합 작업 가이드

> **대상 독자:** 이 가이드는 원본 CAI-main 코드베이스를 넘겨받아 현재 앱 상태로
> 그대로 적용해야 하는 프론트엔드 개발자를 위해 작성되었습니다.
> 아래 파일 구조 인덱스에서 본인이 적용할 파일을 확인하고,
> 해당 섹션으로 이동하여 변경 내용을 적용하십시오.

---

## 목차

1. [전체 파일 구조 인덱스](#1-전체-파일-구조-인덱스)
2. [수정 파일 — `types/canvas.ts`](#2-수정-typescanvasts)
3. [수정 파일 — `app/page.tsx`](#3-수정-appapagetsx)
4. [수정 파일 — `components/RightSidebar.tsx`](#4-수정-componentsrightsidebartsx)
5. [수정 파일 — `components/ExpandedView.tsx`](#5-수정-componentsexpandedviewtsx)
6. [수정 파일 — `planners/PlannersPanel.tsx`](#6-수정-plannersplannersPaneltsx)
7. [수정 파일 — `components/panels/PlannersInsightPanel.tsx`](#7-수정-componentspanelsplannersinsightpaneltsx)
8. [기능 동작 흐름 요약](#8-기능-동작-흐름-요약)
9. [콘솔 로그 기준표](#9-콘솔-로그-기준표)

---

## 1. 전체 파일 구조 인덱스

```
project_canvas/
│
├── _context/
│   ├── brand-guidelines.md                          (유지)
│   ├── business-context.md                          (유지)
│   └── design-style-guide-node.md                   (유지)
│
├── app/
│   ├── api/
│   │   ├── planners/
│   │   │   └── route.ts                             (유지)
│   │   └── sketch-to-image/
│   │       └── route.ts                             (유지)
│   ├── globals.css                                  (유지)
│   ├── layout.tsx                                   (유지)
│   └── page.tsx                                  ★ (수정) — §3
│
├── components/
│   ├── panels/
│   │   ├── PlannersInsightPanel.tsx              ★ (수정) — §7
│   │   └── SketchToImagePanel.tsx                   (유지)
│   ├── EdgeLayer.tsx                                (유지)
│   ├── ExpandedSidebar.tsx                          (유지)
│   ├── ExpandedView.tsx                          ★ (수정) — §5
│   ├── GeneratingToast.tsx                          (유지)
│   ├── InfiniteCanvas.tsx                           (유지)
│   ├── InfiniteGrid.tsx                             (유지)
│   ├── LeftToolbar.tsx                              (유지)
│   ├── NodeCard.tsx                                 (유지)
│   ├── RightSidebar.tsx                          ★ (수정) — §4
│   └── SketchCanvas.tsx                             (유지)
│
├── hooks/
│   └── useBlueprintGeneration.ts                    (유지)
│
├── lib/
│   ├── autoLayout.ts                                (유지)
│   ├── imageDB.ts                                   (유지)
│   └── prompt.ts                                    (유지)
│
├── planners/
│   ├── lib/
│   │   ├── lawApi.ts                                (유지)
│   │   ├── lawKeywords.ts                           (유지)
│   │   ├── parkingCalculator.ts                     (유지)
│   │   └── zoneLawMapping.ts                        (유지)
│   ├── experts.ts                                   (유지)
│   ├── PlannersPanel.tsx                         ★ (수정) — §6
│   ├── types.ts                                     (유지)
│   └── utils.ts                                     (유지)
│
├── sketch-to-image/
│   ├── _context/
│   │   └── protocol-sketch-to-image-v2.3.txt        (유지)
│   └── ExpandedView.tsx                             (유지)
│
├── types/
│   └── canvas.ts                                 ★ (수정) — §2
│
├── .gitattributes                                   (유지)
├── .gitignore                                       (유지)
├── next-env.d.ts                                    (유지)
├── next.config.ts                                   (유지)
├── package.json                                     (유지)
├── postcss.config.mjs                               (유지)
├── README.md                                        (유지)
├── README_PLANNERS.md                            ★ (신규생성) — 이 파일
└── tsconfig.json                                    (유지)
```

> ★ 표시된 6개 파일만 수정합니다. 나머지는 원본 그대로 유지합니다.

---

## 2. 수정 — `types/canvas.ts`

### 2-1. `NodeType` union에 `'cadastral'` 추가

```ts
// 기존
export type NodeType =
  | 'planners' | 'plan' | 'image' | 'elevation'
  | 'viewpoint' | 'diagram' | 'print' | 'sketch';

// 수정 후
export type NodeType =
  | 'planners' | 'plan' | 'image' | 'elevation'
  | 'viewpoint' | 'diagram' | 'print' | 'sketch'
  | 'cadastral'; // 지적도 — VWorld 결과 수신 시 자동 생성
```

### 2-2. `SavedInsightData` 인터페이스 신규 추가

`CanvasNode` 인터페이스 **위**에 삽입합니다.

```ts
export interface SavedInsightData {
  formatted: string;
  categorized: {
    law: Array<{
      source: string; lawName: string; articleTitle: string; content: string;
      [key: string]: unknown;
    }>;
    building: Array<{
      source: string; lawName: string; articleTitle: string; content: string;
      [key: string]: unknown;
    }>;
    land: Array<{
      source: string; lawName: string; articleTitle: string; content: string;
      [key: string]: unknown;
    }>;
  };
  pnu: string | null;
  landCharacteristics?: {
    landArea: string | null; landCategory: string | null;
    terrain: string | null; roadFrontage: string | null;
  } | null;
  parkingOrdinance?: Array<{
    source: string; lawName: string; articleTitle: string; content: string;
    [key: string]: unknown;
  }>;
}
```

### 2-3. `CanvasNode` 인터페이스에 두 필드 추가

```ts
export interface CanvasNode {
  // ... 기존 필드 전부 유지 ...
  plannerInsightData?: SavedInsightData; // 추가 — Insight 패널 데이터 (재진입 시 복원용)
  cadastralPnu?: string;                 // 추가 — 지적도 노드 전용 PNU 코드
}
```

### 2-4. `NODE_DEFINITIONS`에 `cadastral` 항목 추가

```ts
export const NODE_DEFINITIONS: Record<NodeType, { label: string; displayLabel: string; caption: string }> = {
  // ... 기존 항목 전부 유지 ...
  cadastral: { label: '지적도', displayLabel: '지적도', caption: '지적도' }, // 추가
};
```

### 2-5. `NODES_THAT_EXPAND`에 `'cadastral'` 추가

```ts
// 기존
export const NODES_THAT_EXPAND: NodeType[] = ['image', 'plan', 'print', 'planners'];

// 수정 후
export const NODES_THAT_EXPAND: NodeType[] = ['image', 'plan', 'print', 'planners', 'cadastral'];
```

### 2-6. `NODE_TO_ARTBOARD_TYPE`에 `cadastral` 항목 추가

```ts
export const NODE_TO_ARTBOARD_TYPE: Partial<Record<NodeType, ArtboardType>> = {
  image:     'sketch',
  plan:      'sketch',
  elevation: 'image',
  viewpoint: 'image',
  diagram:   'image',
  print:     'image',
  planners:  'thumbnail',
  cadastral: 'image',   // 추가
};
```

---

## 3. 수정 — `app/page.tsx`

### 3-1. `plannerInsightDataRef` ref 추가

기존 `plannerMessagesRef` 선언 바로 아래에 추가합니다.

```ts
// 기존 (건드리지 않음)
const plannerMessagesRef = useRef<PlannerMessage[]>([]);

// 아래 줄 추가
const plannerInsightDataRef = useRef<import('@/types/canvas').SavedInsightData | null>(null);
```

### 3-2. `handleCadastralDataReceived` 콜백 신규 추가

`handleReturnFromExpand` 함수 **바로 위**에 삽입합니다.

```ts
const handleCadastralDataReceived = useCallback((pnu: string | null, landCount: number) => {
  const plannerNodeId = expandedNodeId;
  if (!plannerNodeId) return;

  setNodes(prev => {
    // 같은 Planners 노드에서 이미 생성된 지적도 노드가 있으면 건너뜀
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
```

### 3-3. `handleReturnFromExpand` 수정 — Insight 데이터 저장 추가

아래 주석 `// 추가` 표시 줄만 삽입합니다. 나머지는 원본 유지.

```ts
const handleReturnFromExpand = useCallback(() => {
  if (!expandedNodeId) { setExpandedNodeId(null); return; }
  const savedMessages    = plannerMessagesRef.current;
  const savedInsightData = plannerInsightDataRef.current;  // 추가
  setNodes(prev => {
    const next = prev.map(n => {
      if (n.id !== expandedNodeId) return n;
      const hasMsgs    = savedMessages.length > 0;
      const hasInsight = savedInsightData !== null;         // 추가
      return {
        ...n,
        hasThumbnail: true,
        ...(hasMsgs    ? { plannerMessages:    savedMessages    } : {}),
        ...(hasInsight ? { plannerInsightData: savedInsightData } : {}),  // 추가
      };
    });
    setHistory(h => [...h.slice(0, historyIndex + 1), next]);
    setHistoryIndex(i => i + 1);
    return next;
  });
  plannerMessagesRef.current    = [];
  plannerInsightDataRef.current = null;  // 추가
  setExpandedNodeId(null);
}, [expandedNodeId, historyIndex]);
```

### 3-4. `ExpandedView` JSX에 prop 3개 추가

```tsx
<ExpandedView
  node={expandedNode}
  onCollapse={handleReturnFromExpand}
  onPlannerMessagesChange={msgs => { plannerMessagesRef.current = msgs; }}
  {/* 아래 3줄 추가 */}
  onInsightDataChange={data => {
    plannerInsightDataRef.current = data as import('@/types/canvas').SavedInsightData | null;
  }}
  initialInsightData={
    expandedNode.plannerInsightData as import('@/planners/lib/lawApi').FetchLawsResult | null ?? null
  }
  onCadastralDataReceived={handleCadastralDataReceived}
  {/* 기존 나머지 props 유지 */}
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
```

### 3-5. `RightSidebar` JSX에 `plannerMessages` prop 추가

```tsx
<RightSidebar
  activeSidebarNodeType={activeSidebarNodeType}
  selectedArtboardType={selectedArtboardType}
  onNodeTabSelect={handleNodeTabSelect}
  onNavigateToExpand={handleNavigateToExpand}
  {/* 아래 4줄 추가 */}
  plannerMessages={
    selectedNodeId
      ? nodes.find(n => n.id === selectedNodeId)?.plannerMessages
      : undefined
  }
/>
```

---

## 4. 수정 — `components/RightSidebar.tsx`

### 4-1. `Props` 인터페이스에 `plannerMessages` 추가

```ts
interface Props {
  activeSidebarNodeType: NodeType | null;
  selectedArtboardType: ArtboardType | null;
  onNodeTabSelect: (type: NodeType) => void;
  onNavigateToExpand: (type: NodeType) => void;
  plannerMessages?: PlannerMessage[];   // 추가
}
```

### 4-2. 헬퍼 함수 2개 신규 추가

파일 상단 (기존 아이콘 컴포넌트들 아래) 에 삽입합니다.

```ts
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

function extractFirstLine(text: string): string {
  const clean = text
    .replace(/^#{1,4}\s.+$/gm, '').replace(/\*\*/g, '')
    .replace(/^\s*[-*>]\s/gm, '').replace(/\[CITE_REF:\d+\]/g, '').trim();
  const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 10);
  return lines[0]?.slice(0, 120) ?? '';
}
```

### 4-3. `PlannerReportPanel` 컴포넌트 신규 추가

`NodePanel` 함수 **바로 위**에 삽입합니다.

```tsx
function PlannerReportPanel({ messages, onGenerate }: {
  messages: PlannerMessage[];
  onGenerate: () => void;
}) {
  const lastUser = [...messages].reverse().find(m => m.type === 'user');
  const lastAi   = [...messages].reverse().find(m => m.type === 'ai');
  const data     = lastAi?.type === 'ai' ? lastAi.data : null;
  const shortFinal   = data?.shortFinalOutput as string | undefined;
  const finalOutput  = data?.finalOutput as string | undefined;
  const bullets      = shortFinal ? parseShortFinal(shortFinal) : [];
  const fallbackLine = (!shortFinal && finalOutput) ? extractFirstLine(finalOutput) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem' }}>

      {/* 마지막 질문 */}
      {lastUser?.type === 'user' && (
        <div style={{ marginBottom: '0.75rem', padding: '0.625rem 0.75rem',
          background: 'var(--color-gray-50, #f9f9f9)', borderRadius: '0.5rem',
          borderLeft: '2px solid var(--color-gray-200)' }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-gray-400)',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Q</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--color-gray-600)', lineHeight: 1.5, margin: 0,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const }}>
            {lastUser.text}
          </p>
        </div>
      )}

      {/* 기획서 요약 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {bullets.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-gray-400)',
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              최종 기획서
            </p>
            {bullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.375rem', alignItems: 'flex-start',
                padding: '0.375rem 0.5rem', background: 'var(--color-white)',
                border: '1px solid var(--color-gray-100)', borderRadius: '0.5rem' }}>
                {b.label && (
                  <span style={{ fontSize: '0.55rem', fontWeight: 900,
                    background: 'var(--color-black)', color: 'var(--color-white)',
                    borderRadius: '0.25rem', padding: '1px 4px', lineHeight: 1.4,
                    flexShrink: 0, whiteSpace: 'nowrap', maxWidth: 56,
                    overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.label}
                  </span>
                )}
                <span style={{ fontSize: '0.65rem', color: 'var(--color-gray-600)', lineHeight: 1.5,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const }}>
                  {b.body}
                </span>
              </div>
            ))}
          </div>
        ) : fallbackLine ? (
          <div style={{ padding: '0.5rem 0.75rem',
            background: 'var(--color-gray-50, #f9f9f9)', borderRadius: '0.5rem' }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-gray-400)',
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              최종 기획서
            </p>
            <p style={{ fontSize: '0.68rem', color: 'var(--color-gray-600)', lineHeight: 1.5, margin: 0 }}>
              {fallbackLine}…
            </p>
          </div>
        ) : null}
      </div>

      {/* OPEN 버튼 */}
      <button onClick={onGenerate}
        style={{ width: '100%', height: 'var(--h-cta-lg)', border: 'none',
          borderRadius: 'var(--radius-pill)', background: 'var(--color-black)',
          color: 'var(--color-white)', fontFamily: 'var(--font-family-bebas)',
          fontSize: '1rem', letterSpacing: '0.08em', cursor: 'pointer',
          transition: 'opacity 120ms ease', flexShrink: 0, marginTop: '0.75rem' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
        OPEN
      </button>
    </div>
  );
}
```

### 4-4. `NodePanel` 함수 수정

`plannerMessages` prop을 받고, Planners 타입 + 대화 이력 있을 때 `PlannerReportPanel` 분기 추가.

```tsx
// 기존 시그니처
function NodePanel({ type, onGenerate }: { type: NodeType; onGenerate: () => void }) {

// 수정 후 시그니처
function NodePanel({ type, onGenerate, plannerMessages }: {
  type: NodeType;
  onGenerate: () => void;
  plannerMessages?: PlannerMessage[];   // 추가
}) {
  const def = NODE_DEFINITIONS[type];
  const hasMessages = type === 'planners' && plannerMessages && plannerMessages.length > 0;

  // 추가: Planners + 대화 이력 있으면 보고서 패널 렌더링
  if (hasMessages) {
    return <PlannerReportPanel messages={plannerMessages!} onGenerate={onGenerate} />;
  }

  // 기존 코드 그대로 유지
  return ( /* ... 원본 placeholder JSX ... */ );
}
```

### 4-5. `RightSidebar` default export 수정

destructuring에 `plannerMessages` 추가하고, `NodePanel` 호출 시 전달.

```tsx
export default function RightSidebar({
  activeSidebarNodeType, selectedArtboardType,
  onNodeTabSelect, onNavigateToExpand,
  plannerMessages,   // 추가
}: Props) {
  // ...

  // NodePanel 호출 부분 (isPanelMode 분기 안에 있음)
  <NodePanel
    type={activeSidebarNodeType!}
    onGenerate={() => onNavigateToExpand(activeSidebarNodeType!)}
    plannerMessages={plannerMessages}   // 추가
  />
}
```

---

## 5. 수정 — `components/ExpandedView.tsx`

### 5-1. import 추가

```ts
import type { FetchLawsResult } from '@/planners/lib/lawApi';
```

### 5-2. `Props` 인터페이스에 3개 prop 추가

```ts
interface Props {
  node: CanvasNode;
  onCollapse: () => void;
  onPlannerMessagesChange?: (messages: PlannerMessage[]) => void;
  onInsightDataChange?: (data: FetchLawsResult | null) => void;               // 추가
  initialInsightData?: FetchLawsResult | null;                                 // 추가
  onCadastralDataReceived?: (pnu: string | null, landCount: number) => void;  // 추가
  // ... 기존 나머지 props 유지
}
```

### 5-3. `CadastralExpandedView` 컴포넌트 신규 추가

`SketchInfiniteGrid` 함수 **아래**, `ExpandedView` default export **위**에 삽입합니다.

```tsx
function CadastralExpandedView({ pnu }: { pnu: string | null }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const iframeSrc = pnu
    ? `https://www.eum.go.kr/web/ar/lu/luLandDet.jsp?isNoScr=script&mode=search&pnu=${pnu}`
    : null;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--color-app-bg)' }}>
      {iframeSrc ? (
        <>
          {status === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              background: 'var(--color-app-bg)', zIndex: 10 }}>
              <span className="text-caption" style={{ color: 'var(--color-gray-300)' }}>
                지적도 불러오는 중…
              </span>
            </div>
          )}
          {status === 'error' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              background: 'var(--color-app-bg)', zIndex: 10 }}>
              <span className="text-title" style={{ color: 'var(--color-gray-300)', letterSpacing: '0.08em' }}>
                지적도
              </span>
              <span style={{ display: 'block', width: 48, height: 1, background: 'var(--color-gray-200)' }} />
              <span className="text-caption" style={{ color: 'var(--color-gray-300)' }}>
                지도를 불러올 수 없습니다
              </span>
              <a href={iframeSrc} target="_blank" rel="noopener noreferrer"
                style={{ marginTop: '0.5rem', padding: '0.5rem 1.25rem',
                  background: 'var(--color-black)', color: 'var(--color-white)',
                  borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-family-bebas)',
                  fontSize: '0.875rem', letterSpacing: '0.08em', textDecoration: 'none' }}>
                토지이음에서 열기 →
              </a>
            </div>
          )}
          <iframe
            src={iframeSrc}
            style={{ width: '100%', height: '100%', border: 'none',
              display: status === 'error' ? 'none' : 'block' }}
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
        /* PNU 없이 생성된 지적도 노드 */
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <span className="text-title" style={{ fontSize: '1.25rem', color: 'var(--color-gray-300)',
            letterSpacing: '0.08em' }}>지적도</span>
          <span style={{ display: 'block', width: 48, height: 1, background: 'var(--color-gray-200)' }} />
          <span className="text-caption" style={{ color: 'var(--color-gray-300)' }}>
            PNU 코드 없음 — 주소를 포함한 안건을 입력하세요
          </span>
        </div>
      )}
    </div>
  );
}
```

### 5-4. `ExpandedView` 함수 본문 수정

```tsx
export default function ExpandedView({
  node, onCollapse, onPlannerMessagesChange,
  onInsightDataChange, initialInsightData, onCadastralDataReceived,  // 추가
  activeTool, scale, canUndo, canRedo,
  onToolChange, onUndo, onRedo, onZoomIn, onZoomOut, onZoomReset, onAddArtboard,
}: Props) {
  const def = NODE_DEFINITIONS[node.type];
  const isSketchMode = node.artboardType === 'sketch' || node.artboardType === 'blank';

  // 추가: insightData 상태 (initialInsightData로 초기화 → 재진입 시 복원)
  const [insightData, setInsightData] = useState<FetchLawsResult | null>(initialInsightData ?? null);

  // 추가: insightData 변경 시 부모에 알림
  useEffect(() => {
    onInsightDataChange?.(insightData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insightData]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--color-app-bg)' }}>

      {isSketchMode ? (
        <SketchInfiniteGrid />
      ) : node.type === 'cadastral' ? (
        // 추가: 지적도 전체화면 분기
        <CadastralExpandedView pnu={node.cadastralPnu ?? null} />
      ) : node.type === 'planners' ? (
        <div style={{ position: 'absolute', inset: 0, left: 'calc(4rem + 1.5rem)',
          right: 'calc(var(--sidebar-w) + 2rem)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '2rem 0' }}>
          <PlannersPanel
            onInsightDataUpdate={setInsightData}
            onCadastralDataReceived={onCadastralDataReceived}  // 추가
            initialMessages={node.plannerMessages as never}
            onMessagesChange={msgs => onPlannerMessagesChange?.(msgs as unknown as PlannerMessage[])}
          />
        </div>
      ) : (
        /* 기존 image/thumbnail placeholder — 유지 */
      )}

      {/* 좌측 툴바 — 유지 */}
      <LeftToolbar { /* ... 기존 props 유지 */ } />

      {/* 우측 사이드바 — 유지 */}
      <ExpandedSidebar currentNodeType={node.type} onCollapse={onCollapse}>
        {node.type === 'planners' && <PlannersInsightPanel apiInsightData={insightData} />}
      </ExpandedSidebar>
    </div>
  );
}
```

---

## 6. 수정 — `planners/PlannersPanel.tsx`

### 6-1. `PlannersPanelProps` 인터페이스에 콜백 추가

```ts
export interface PlannersPanelProps {
  onInsightDataUpdate?: (data: FetchLawsResult | null) => void;
  onCadastralDataReceived?: (pnu: string | null, landCount: number) => void;  // 추가
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}
```

### 6-2. default export 함수 시그니처 수정

```ts
export default function PlannersPanel({
  onInsightDataUpdate,
  onCadastralDataReceived,   // 추가
  initialMessages,
  onMessagesChange,
}: PlannersPanelProps) {
```

### 6-3. `handleChatSubmit` 내부 수정

`fetchRelevantLaws` 결과를 받고 `onInsightDataUpdate` 호출하는 코드 **바로 아래**에 추가합니다.

```ts
if (onInsightDataUpdate) {
  onInsightDataUpdate(insightData);
}

// 추가: 브이월드 결과 1건 이상 수신 시 지적도 아트보드 생성 요청
if (insightData.categorized.land.length > 0) {
  console.log(`[지적도] 아트보드 생성 시작 — PNU: ${insightData.pnu ?? '없음'}, 브이월드 ${insightData.categorized.land.length}건 반환`);
  onCadastralDataReceived?.(insightData.pnu, insightData.categorized.land.length);
}
```

---

## 7. 수정 — `components/panels/PlannersInsightPanel.tsx`

이 파일은 **제거**만 합니다. 추가 코드 없음.

### 7-1. `import` 에서 3개 제거

```ts
// 수정 전
import { memo, useState, useEffect, useMemo } from 'react';
import {
  Scale, Building2, LandPlot, Plus as PlusIcon, MapPin, Layers,
  Hash, ExternalLink, Car, Ruler,
  Map, AlertCircle, Loader2,   // ← 이 3개 제거
} from 'lucide-react';

// 수정 후
import { memo, useMemo } from 'react';   // useState, useEffect 제거
import {
  Scale, Building2, LandPlot, Plus as PlusIcon, MapPin, Layers,
  Hash, ExternalLink, Car, Ruler,
  // Map, AlertCircle, Loader2 삭제
} from 'lucide-react';
```

### 7-2. 렌더 코드에서 블록 제거

```tsx
// 아래 블록 전체 삭제
{isLandApiEnabled && apiInsightData.categorized.land.length > 0 && (
  <CadastralMapSection
    pnu={apiInsightData.pnu}
    landCount={apiInsightData.categorized.land.length}
  />
)}
```

### 7-3. `CadastralMapSection` 함수 전체 삭제

파일에서 아래 함수 전체를 찾아 삭제합니다.

```tsx
// 이 함수 전체 삭제 (약 90줄)
function CadastralMapSection({ pnu, landCount }: { pnu: string | null; landCount: number }) {
  // ...
}
```

---

## 8. 기능 동작 흐름 요약

### 이슈 1 — Planners 노드 클릭 시 우측 탭 기획서 미리보기

```
캔버스에서 Planners 썸네일 클릭
  → page.tsx: plannerMessages를 RightSidebar에 전달
  → RightSidebar: NodePanel → PlannerReportPanel 분기
  → 마지막 Q + shortFinalOutput 카테고리 bullet 4개 표시
  → OPEN 버튼 클릭 → Expand 뷰 진입
```

### 이슈 2 — Expand 뷰 재진입 시 대지/법규/건물 탭 데이터 유지

```
Planners Expand 진입 → 안건 입력 → insightData 수신
  → ExpandedView: onInsightDataChange → plannerInsightDataRef 업데이트
캔버스 복귀 → handleReturnFromExpand
  → plannerInsightData를 노드 객체에 저장 → localStorage 자동 persist
재진입 → initialInsightData prop으로 복원 → 탭 내용 유지
```

### 이슈 3 — VWorld 지적도 아트보드 캔버스 노드 자동 생성

```
Planners Expand에서 안건 입력
  → fetchRelevantLaws → VWorld land 결과 1건 이상
  → PlannersPanel: onCadastralDataReceived(pnu, landCount) 호출
  → page.tsx handleCadastralDataReceived 실행
      ├─ 중복 체크: 같은 parentId의 cadastral 노드 유무
      ├─ 없으면: CanvasNode 생성 (Planners 우측 +60px)
      │          + CanvasEdge 생성 (Planners → 지적도)
      └─ 있으면: 건너뜀 (중복 방지)
캔버스 복귀 → 지적도 카드 노드 표시
지적도 노드 더블클릭
  → ExpandedView: cadastral 분기 → CadastralExpandedView
  → 토지이음 iframe 전체화면
  → iframe 차단(X-Frame-Options) 시 → 빈 화면 + 외부링크 버튼
    (노드 자체는 항상 생성됨)
```

---

## 9. 콘솔 로그 기준표

| 로그 메시지 | 발생 위치 | 의미 |
|-------------|-----------|------|
| `[지적도] 아트보드 생성 시작 — PNU: ..., 브이월드 N건 반환` | `PlannersPanel.tsx` | VWorld API 수신 → 생성 콜백 전송 |
| `[지적도] 아트보드 생성 완료 — 노드 ID: ...` | `page.tsx` | 캔버스 노드 생성 성공 |
| `[지적도] 아트보드 생성 건너뜀 — 이미 존재하는 지적도 노드 있음` | `page.tsx` | 중복 생성 방지 |
| `[지적도] 아트보드 생성 완료 — iframe 로드 성공` | `ExpandedView.tsx` | 토지이음 iframe 정상 로드 |
| `[지적도] 아트보드 생성 실패 — iframe 로드 오류 (X-Frame-Options 차단 가능성)` | `ExpandedView.tsx` | iframe 차단 (노드는 존재) |

---

COPYRIGHTS 2026. CRE-TE CO.,LTD. ALL RIGHTS RESERVED.

/* 노드 카드 규격 (rem → px @ 16px base) */
export const CARD_W_PX  = 280; // 17.5rem
export const CARD_H_PX  = 198; // 12.375rem
export const COL_GAP_PX = 40;  // 컬럼 간 수평 간격
export const ROW_GAP_PX = 16;  // 형제 노드 간 수직 간격

/* 포트 인디케이터 형태 */
export type PortShape =
  | 'none'
  | 'circle-solid'    // 부모 포트, 단일 연결
  | 'circle-outline'  // 자식 포트, 단일 연결
  | 'diamond-solid'   // 부모 포트, 다중 연결
  | 'diamond-outline' // 자식 포트, 다중 연결

export interface CanvasEdge {
  id: string;
  sourceId: string; // 부모 노드
  targetId: string; // 자식 노드
}

export type NodeType =
  | 'planners'
  | 'plan'
  | 'image'
  | 'elevation'
  | 'viewpoint'
  | 'diagram'
  | 'print'
  | 'sketch'
  | 'cadastral'; // 지적도 — VWorld 결과 수신 시 자동 생성

/* 아트보드 컨테이너 유형 */
export type ArtboardType = 'blank' | 'sketch' | 'image' | 'thumbnail';

export type ActiveTool = 'cursor' | 'handle';

export interface SketchPanelSettings {
  prompt: string;
  mode: string;
  style: string | null;
  aspectRatio: string | null;
  resolution: string;
}

export type PlannerMessage =
  | { type: 'user'; text: string }
  | { type: 'ai'; data: Record<string, unknown> };

/* Insight 데이터 직렬화 가능 구조 (FetchLawsResult와 동일 형태) */
export interface SavedInsightData {
  formatted: string;
  categorized: {
    law: Array<{
      source: string;
      lawName: string;
      articleTitle: string;
      content: string;
      [key: string]: unknown;
    }>;
    building: Array<{
      source: string;
      lawName: string;
      articleTitle: string;
      content: string;
      [key: string]: unknown;
    }>;
    land: Array<{
      source: string;
      lawName: string;
      articleTitle: string;
      content: string;
      [key: string]: unknown;
    }>;
  };
  pnu: string | null;
  landCharacteristics?: {
    landArea: string | null;
    landCategory: string | null;
    terrain: string | null;
    roadFrontage: string | null;
  } | null;
  parkingOrdinance?: Array<{
    source: string;
    lawName: string;
    articleTitle: string;
    content: string;
    [key: string]: unknown;
  }>;
}

/* ── ELEVATION 노드 전용 타입 ──────────────────────────────────── */
export type ElevationView = 'top' | 'front' | 'rear' | 'left' | 'right';

export interface ElevationNodeData {
  isLoading: boolean;
  isLineDrawing?: boolean; // true = 라인드로잉 결과 노드 → LINE DRAWING 버튼 숨김
  currentView: ElevationView;
  images: {
    top: string;
    front: string;
    rear: string;
    left: string;
    right: string;
  };
  aeplSchema: Record<string, unknown>;
}

export interface CanvasNode {
  id: string;
  type: NodeType;
  title: string;
  position: { x: number; y: number };
  instanceNumber: number;
  hasThumbnail: boolean;
  artboardType: ArtboardType;  // 아트보드 컨테이너 유형
  thumbnailData?: string;
  parentId?: string;    // 파생 출처 노드 id
  autoPlaced?: boolean; // Auto Layout 배치 노드 (수동 드래그 시 false로 전환)
  sketchPanelSettings?: SketchPanelSettings;
  sketchData?: string;
  generatedImageData?: string;
  plannerMessages?: PlannerMessage[];
  plannerInsightData?: SavedInsightData; // Insight 패널 데이터 (재진입 시 복원용)
  cadastralPnu?: string;                 // 지적도 노드 전용 — VWorld PNU 코드
  elevationData?: ElevationNodeData;     // ELEVATION 노드 전용 — 5-view 이미지 + AEPL
}

export interface CanvasViewport {
  offset: { x: number; y: number };
  scale: number;
}

export const NODE_DEFINITIONS: Record<NodeType, { label: string; displayLabel: string; caption: string }> = {
  planners:  { label: 'PLANNERS',           displayLabel: 'PLANNERS',   caption: 'Planners' },
  plan:      { label: 'SKETCH TO PLAN',     displayLabel: 'PLAN',       caption: 'Sketch to Plan' },
  image:     { label: 'SKETCH TO IMAGE',    displayLabel: 'IMAGE',      caption: 'Sketch to Image' },
  elevation: { label: 'IMAGE TO ELEVATION', displayLabel: 'ELEVATION',  caption: 'Image to Elevation' },
  viewpoint: { label: 'CHANGE VIEWPOINT',   displayLabel: 'CHANGE VIEWPOINT', caption: 'Change Viewpoint' },
  diagram:   { label: 'PLAN TO DIAGRAM',    displayLabel: 'DIAGRAM',    caption: 'Plan to Diagram' },
  print:     { label: 'PRINT',              displayLabel: 'PRINT',      caption: 'Print' },
  sketch:    { label: 'SKETCH',             displayLabel: 'SKETCH',     caption: 'Sketch Artboard' },
  cadastral: { label: '지적도',              displayLabel: '지적도',      caption: '지적도' },
};

export const NODE_ORDER: NodeType[] = [
  'planners', 'plan', 'image', 'elevation', 'viewpoint', 'diagram', 'print', 'sketch',
];

/* 아트보드 유형별 호환 노드 탭 */
export const ARTBOARD_COMPATIBLE_NODES: Record<Exclude<ArtboardType, 'blank'>, NodeType[]> = {
  sketch:    ['image', 'plan'],
  image:     ['elevation', 'viewpoint', 'diagram', 'print'],
  thumbnail: ['planners'],
};

/* 노드 → 아트보드 유형 매핑 (탭 클릭 시 blank 아트보드에 유형 배정) */
export const NODE_TO_ARTBOARD_TYPE: Partial<Record<NodeType, ArtboardType>> = {
  image:     'sketch',
  plan:      'sketch',
  elevation: 'image',
  viewpoint: 'image',
  diagram:   'image',
  print:     'image',
  planners:  'thumbnail',
  cadastral: 'image',
};

/* 아트보드 선택 + 탭 클릭 시 expand 진입하는 노드 */
export const NODES_THAT_EXPAND: NodeType[] = ['image', 'plan', 'print', 'planners', 'cadastral'];

/* 아트보드 유형 배지 레이블 */
export const ARTBOARD_LABEL: Record<Exclude<ArtboardType, 'blank'>, string> = {
  sketch:    'SKETCH',
  image:     'IMAGE',
  thumbnail: 'THUMBNAIL',
};

/* 캔버스 좌표(world) → 화면 좌표(screen) */
export function toScreen(
  worldX: number,
  worldY: number,
  viewport: CanvasViewport,
): { x: number; y: number } {
  return {
    x: worldX * viewport.scale + viewport.offset.x,
    y: worldY * viewport.scale + viewport.offset.y,
  };
}

/* 화면 좌표(screen) → 캔버스 좌표(world) */
export function toWorld(
  screenX: number,
  screenY: number,
  viewport: CanvasViewport,
): { x: number; y: number } {
  return {
    x: (screenX - viewport.offset.x) / viewport.scale,
    y: (screenY - viewport.offset.y) / viewport.scale,
  };
}
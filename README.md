# CAI-CANVAS

COPYRIGHTS 2026. CRE-TE CO.,LTD. ALL RIGHTS RESERVED.

---

## 아키텍처 원칙

```
CAI-CANVAS (project_canvas) = UI 렌더러 + S2S 호출자
  절대 원칙: Canvas는 AI API를 직접 호출하지 않는다
  모든 AI 처리는 전용 백엔드 앱(Planners 백엔드 / ELEVATION 백엔드)이 담당
  Canvas → Next.js API Route(S2S 프록시) → 백엔드 앱 → AI
```

---

## 프로젝트 구조

```
CAI-main/
├── project_canvas/               # Next.js 14 앱 (메인 캔버스)
│   ├── app/
│   │   ├── api/
│   │   │   ├── planners/route.ts         # Planners 백엔드 S2S 프록시
│   │   │   └── elevation/
│   │   │       ├── process/route.ts      # ELEVATION /api/process 프록시
│   │   │       └── linedrawing/route.ts  # ELEVATION /api/linedrawing 프록시
│   │   └── page.tsx                      # 캔버스 메인 페이지
│   ├── components/
│   │   ├── InfiniteCanvas.tsx
│   │   ├── NodeCard.tsx
│   │   ├── RightSidebar.tsx
│   │   ├── ExpandedView.tsx
│   │   └── panels/
│   │       ├── ElevationRightPanel.tsx
│   │       └── PlannersInsightPanel.tsx
│   ├── planners/
│   │   └── PlannersPanel.tsx
│   └── types/canvas.ts                   # 공유 타입 (ElevationNodeData 포함)
│
└── ELEVATION/                            # Vercel 백엔드 (별도 배포)
    ├── api/
    │   ├── process.ts                    # Protocol A+B 엔드포인트
    │   └── linedrawing.ts                # Protocol LD 엔드포인트
    ├── server/services/
    │   └── lineDrawingService.ts
    ├── docs/api-endpoints.md             # 전체 엔드포인트 명세
    └── vercel.json
```

---

## 완료된 작업 1: Planners 통합

### 배경
Planners 노드 확장 시 오류 발생. 원인: `project_canvas`가 Planners 백엔드 전체(Gemini 호출, GEMS 프로토콜)를 내부에 복제하고 있었음. Canvas 환경에 `GEMINI_API_KEY` 없어 실패.

### 수정: S2S 프록시 구조로 전환
```
[이전] Canvas → project_canvas/app/api/planners/route.ts → Gemini API 직접 호출 (WRONG)
[이후] Canvas → project_canvas/app/api/planners/route.ts → Planners 백엔드 /api/generate → Gemini
```
- `route.ts`: Gemini 호출 코드 전체 제거 → 백엔드 프록시로 단순화
- `protocols.ts`: 삭제 (GEMS 프로토콜은 백엔드 앱이 관리)
- 환경변수: `PLANNERS_BACKEND_URL` 추가

### 추가 구현: Planners 3가지 이슈 수정

#### 이슈 1 — 캔버스 Planners 노드 클릭 시 우측 탭 기획서 프리뷰 표시
- `page.tsx`: 선택 노드의 `plannerMessages` → `RightSidebar`에 prop 전달
- `RightSidebar.tsx`: `PlannerReportPanel` 컴포넌트 추가
  - 마지막 Q(사용자 입력) + `shortFinalOutput` 카테고리 bullet 4개 표시
  - 대화 없는 노드: 기존 "API 연동 후 활성화" placeholder 유지
  - OPEN 버튼 → Expand 뷰 진입

#### 이슈 2 — Expand 뷰 재진입 시 대지·법규·건물 인사이트 데이터 초기화
- 원인: `ExpandedView.tsx`의 `insightData`가 로컬 `useState` → unmount 시 소멸
- `types/canvas.ts`: `SavedInsightData` 인터페이스 추가 + `CanvasNode.plannerInsightData` 필드 추가
- `page.tsx`: `plannerInsightDataRef` 추가, `handleReturnFromExpand`에서 노드에 저장
- `ExpandedView.tsx`: `initialInsightData` + `onInsightDataChange` prop 추가 → 재진입 시 복원

#### 이슈 3 — VWorld 호출 성공 시 지적도 아트보드 자동 생성
- `PlannersPanel.tsx`: VWorld `land[]` 1건 이상 수신 → `onCadastralDataReceived(pnu, landCount)` 콜백 호출
- `page.tsx`: `handleCadastralDataReceived` → 캔버스에 `type: 'cadastral'` 노드 자동 생성 + Planners 노드와 edge 연결 (중복 방지 포함)
- `ExpandedView.tsx`: `cadastral` 분기 추가 → 토지이음 iframe 전체화면 (X-Frame-Options 차단 시 외부링크 fallback)
- `types/canvas.ts`: `NodeType`에 `'cadastral'` 추가, `CanvasNode.cadastralPnu` 필드 추가

### 환경변수
```env
# project_canvas/.env.local
PLANNERS_BACKEND_URL=https://cai-planners-v2.vercel.app
```

---

## 완료된 작업 2: ELEVATION 통합

### 배경
ELEVATION 백엔드(별도 Vercel 앱)를 CAI-CANVAS에 S2S로 연동. IMAGE 아트보드 노드를 선택 후 ELEVATION 탭을 클릭하면 건축 입면도 5-view를 자동 생성.

### 흐름: ELEVATION (Protocol A+B)
```
IMAGE 노드 선택 → ELEVATION 탭 클릭
  → page.tsx handleElevationTrigger
  → POST /api/elevation/process (S2S 프록시, maxDuration: 130s)
  → ELEVATION 백엔드 /api/process (maxDuration: 120s)
      Protocol A: Gemini Vision → AEPLSchema JSON (width/height/depth/materials/articulation)
      Protocol B: AEPLSchema → 5-view 이미지 병렬 생성 (front/rear/left/right/top)
  → ElevationNode 생성 (type: 'elevation', elevationData 포함)
  → NodeCard: currentView 이미지 렌더링
  → RightSidebar ElevationRightPanel:
      - Analysis: W/H/D 치수 뱃지 + 재질 뱃지
      - Views: 5뷰 갤러리 썸네일 (클릭 시 currentView 변경)
      - ELEVATION 노드 expand 비활성화 (인-캔버스 전용)
```

### 흐름: LINE DRAWING (Protocol LD)
```
ELEVATION 노드 선택 → 우측 사이드바 하단 "LINE DRAWING" 버튼 클릭
  → page.tsx handleLineDrawingTrigger
  → POST /api/elevation/linedrawing (S2S 프록시, maxDuration: 130s)
  → ELEVATION 백엔드 /api/linedrawing (maxDuration: 120s)
      Protocol LD: Gemini multimodal (responseModalities: ['IMAGE','TEXT'])
                   5-view 이미지 → 라인드로잉 스타일 변환 (병렬)
                   Primary: gemini-2.0-flash-exp / Fallback: gemini-2.0-flash
  → 새 ElevationNode 생성 (title: 'Line Drawing #N', elevationData.isLineDrawing: true)
  → LINE DRAWING 버튼: isLineDrawing === true인 노드에서 미표시 (재귀 방지)
```

### S2S 요청/응답 스키마
```json
// POST /api/elevation/process
Request:  { "imageBase64": "base64...", "mimeType": "image/jpeg", "prompt": "" }
Response: { "success": true, "data": { "aeplSchema": {...}, "images": { "top": "data:...", ... } } }

// POST /api/elevation/linedrawing
Request:  { "images": { "front": "data:...", "rear": "...", ... } }
Response: { "success": true, "data": { "images": { "front": "data:...", ... } } }
```

### 알려진 미해결 버그 (ELEVATION 백엔드 — 수정 승인 필요)
| 구분 | 파일 | 문제 |
|------|------|------|
| Critical-1 | `imageGenService.ts` | `generateContent` 호출 시 `responseModalities: ['IMAGE']` 누락 → Gemini 텍스트만 반환 |
| Critical-2 | `aiService.ts`, `imageGenService.ts` | Primary 모델명 `gemini-3-pro-preview`, `gemini-3-pro-image-preview` 미존재 |
| Secondary-1 | `imageGenService.ts` | Protocol B에 원본 이미지 입력값 미전달 |
| Secondary-2 | `api/process.ts` | 4뷰 병렬 생성이 120s 초과 위험 |

### 환경변수
```env
# project_canvas/.env.local
ELEVATION_BACKEND_URL=https://elevation-two.vercel.app

# ELEVATION/.env.local
GOOGLE_API_KEY=your_gemini_api_key
```

---

## 작업 추가 예정: IndexedDB 마이그레이션

### 문제
ELEVATION/LINE DRAWING 이미지(base64, 뷰당 ~1MB × 5 = ~5MB)를 `localStorage`에 저장 시 5–10MB 한도 초과 → `QuotaExceededError` → 저장 실패 + 다음 세션 복원 오류.

현재 `lsSaveItems()`에서 `elevationData.images`를 그대로 직렬화하여 저장 중.

### 해결 방향
- `elevationData.images` (base64 blob) → **IndexedDB** 저장 (비동기, 대용량 지원)
- `localStorage`에는 노드 메타데이터만 유지 (`images` 필드 제외 또는 key 참조로 대체)
- 세션 복원 시 IndexedDB에서 images 비동기 로드 후 노드 상태 업데이트
- 구현 위치: `project_canvas/lib/imageDB.ts` (신규)

### 주의 사항
IndexedDB는 비동기(Promise 기반)이므로 현재 동기식인 `lsSaveItems` / `lsLoadItems` 구조를 비동기로 전환해야 함. 초기화 순서(마운트 시 복원 타이밍)를 주의해서 설계할 것.

---

## 개발 실행

```bash
cd project_canvas
npm install
npm run dev
# → http://localhost:3000
```

---

## 콘솔 로그 기준표

| 로그 패턴 | 발생 위치 | 의미 |
|-----------|-----------|------|
| `[ELEVATION] ▶ 트리거 시작` | `page.tsx` | ELEVATION S2S 요청 시작 |
| `[ELEVATION] ✓ Protocol A` | `page.tsx` | AEPLSchema 수신 성공 |
| `[ELEVATION] ✓ Protocol B` | `page.tsx` | 5-view 이미지 생성 완료 |
| `[ELEVATION] ✕ 오류` | `page.tsx` | S2S 오류 (aeplSchema.error에 저장) |
| `[LINE-DRAWING] ▶ 트리거 시작` | `page.tsx` | LINE DRAWING S2S 요청 시작 |
| `[LINE-DRAWING] ✓ 라인드로잉 완료` | `page.tsx` | 변환 완료 |
| `[LINE-DRAWING] ✕ 오류` | `page.tsx` | S2S 오류 |
| `[지적도] 아트보드 생성 시작` | `PlannersPanel.tsx` | VWorld land 결과 수신 |
| `[지적도] 아트보드 생성 완료` | `page.tsx` | 지적도 캔버스 노드 생성 |
| `[지적도] 아트보드 생성 건너뜀` | `page.tsx` | 중복 방지 |

import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { FetchLawsResult } from '../../planners/lib/lawApi';
import { cn } from '../../planners/utils';
import {
  Scale,
  Building2,
  LandPlot,
  Plus as PlusIcon,
  MapPin,
  Layers,
  Hash,
  ExternalLink,
  Car,
  Ruler,
} from 'lucide-react';
import type { LawEntry } from '../../planners/lib/lawApi';
import { getZoneLaws } from '../../planners/lib/zoneLawMapping';
import { calculateParkingFromBuildingData } from '../../planners/lib/parkingCalculator';

/**
 * InsightPanel — 좌측 API 데이터 대시보드
 *
 * 섹션 구성:
 *   ① 대지위치: 주소(강조) · PNU 코드 · 용도지역지구(건폐율/용적률) ← 브이월드 토지이용계획
 *   ② 건물정보: 건축물대장 · 인허가 항목(레코드별 문단 분리, 2열 그리드) ← 공공데이터포털
 *   ③ 법령정보: 관련 국가법령 목록 + 조례 미연동 안내 ← 법제처
 *
 * 조례 연동 현황:
 *   - 현재 법제처 API target=law (국가법령)만 연동
 *   - 지자체 조례(서울시 도시계획 조례 등)는 target=bylr 별도 연동 필요 (api/law.ts 수정 필요)
 */

// ── 서울특별시 도시계획 조례 기준 건폐율 / 용적률 (타 지자체 상이) ─────────────
const ZONE_REGULATIONS: Record<string, { bcr: string; far: string }> = {
  '제1종전용주거지역': { bcr: '50%', far: '100%' },
  '제2종전용주거지역': { bcr: '40%', far: '120%' },
  '제1종일반주거지역': { bcr: '60%', far: '150%' },
  '제2종일반주거지역': { bcr: '60%', far: '200%' },
  '제3종일반주거지역': { bcr: '50%', far: '250%' },
  '준주거지역': { bcr: '60%', far: '400%' },
  '중심상업지역': { bcr: '60%', far: '1,000%' },
  '일반상업지역': { bcr: '60%', far: '800%' },
  '근린상업지역': { bcr: '60%', far: '600%' },
  '유통상업지역': { bcr: '60%', far: '600%' },
  '전용공업지역': { bcr: '60%', far: '200%' },
  '일반공업지역': { bcr: '60%', far: '200%' },
  '준공업지역': { bcr: '60%', far: '400%' },
  '자연녹지지역': { bcr: '20%', far: '100%' },
  '생산녹지지역': { bcr: '20%', far: '100%' },
  '보전녹지지역': { bcr: '20%', far: '80%' },
  '계획관리지역': { bcr: '40%', far: '100%' },
  '생산관리지역': { bcr: '20%', far: '80%' },
  '보전관리지역': { bcr: '20%', far: '80%' },
  '농림지역': { bcr: '20%', far: '80%' },
  '자연환경보전지역': { bcr: '20%', far: '80%' },
};

// "키: 값 | 키: 값" 형식 문자열 → key-value 배열로 파싱
// indexOf(':') 로 첫 번째 콜론만 분리하여 값 내부 콜론 오파싱 방지
function parsePipeFields(raw: string | undefined | null): { key: string; value: string }[] {
  if (!raw) return [];
  return raw.split(' | ').flatMap(part => {
    const idx = part.indexOf(':');
    if (idx === -1) return [];
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    return key && value && value !== '-' ? [{ key, value }] : [];
  });
}

// ── 메인 컴포넌트 ───────────────────────────────────────────────────────────────

export interface PlannersInsightPanelProps {
  apiInsightData: FetchLawsResult | null;
  isLawApiEnabled?: boolean;
  isBuildingApiEnabled?: boolean;
  isLandApiEnabled?: boolean;
}

export const PlannersInsightPanel = memo(({
  apiInsightData,
  isLawApiEnabled = true,
  isBuildingApiEnabled = true,
  isLandApiEnabled = true
}: PlannersInsightPanelProps) => {
  const hasData = apiInsightData !== null;
  const anyEnabled = isLawApiEnabled || isBuildingApiEnabled || isLandApiEnabled;

  const hasSiteInfo = hasData && (
    !!apiInsightData.pnu || apiInsightData.categorized.land.length > 0
  );
  const hasBuildingInfo = hasData && apiInsightData.categorized.building.length > 0;
  const hasLawInfo = hasData && apiInsightData.categorized.law.length > 0;
  const hasAnyContent = hasSiteInfo || hasBuildingInfo || hasLawInfo || (isLawApiEnabled && hasData);

  const totalCount = hasData
    ? apiInsightData.categorized.law.length + apiInsightData.categorized.building.length + apiInsightData.categorized.land.length
    : 0;

  return (
    <div
      role="complementary"
      aria-label="인사이트 대시보드"
      className="flex flex-col h-full bg-white/40 backdrop-blur-md shadow-[var(--panel-shadow)] overflow-hidden"
    >


      {/* 대시보드 제목 */}
      <div className="px-4 pt-4 pb-2 border-b border-neutral-100">
        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
          INSIGHT DASHBOARD
        </span>
      </div>

      {/* 데이터 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {!hasData ? (
          <EmptyState anyEnabled={anyEnabled} />
        ) : !hasAnyContent ? (
          <NoDataState />
        ) : (
          <>
            {/* ① 대지위치 섹션 */}
            {isLandApiEnabled && hasSiteInfo && (
              <SiteInfoSection
                address={null} // Address info is skipped for now, or you can parse it
                pnu={apiInsightData.pnu}
                zones={apiInsightData.categorized.land}
                landCharacteristics={apiInsightData.landCharacteristics}
              />
            )}

            {/* ② 건물정보 섹션 */}
            {isBuildingApiEnabled && hasBuildingInfo && (
              <BuildingInfoSection buildings={apiInsightData.categorized.building} />
            )}

            {/* ②-1 주차 산정 섹션 */}
            {isBuildingApiEnabled && hasBuildingInfo && (
              <ParkingSection
                buildings={apiInsightData.categorized.building}
                parkingOrdinance={apiInsightData.parkingOrdinance}
              />
            )}

            {/* ③ 법령정보 섹션 — 매핑 테이블 + 법제처 결과 통합 표시 */}
            {isLawApiEnabled && hasData && (
              <LawInfoSection laws={apiInsightData.categorized.law} zones={apiInsightData.categorized.land} />
            )}
          </>
        )}
      </div>

      {/* 하단 상태 표시 */}
      <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', hasData ? 'bg-emerald-400' : 'bg-neutral-300')} />
            <span className="text-[9px] font-bold text-neutral-400 tracking-wider">
              {[isLawApiEnabled, isBuildingApiEnabled, isLandApiEnabled].filter(Boolean).length}/3 API
            </span>
          </div>
          {hasData && totalCount > 0 && (
            <span className="text-[9px] font-bold text-neutral-300">{totalCount}건</span>
          )}
        </div>
      </div>
    </div>
  );
});

// ── 공통: 섹션 헤더 ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, badge }: { icon: ReactNode; title: string; badge: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 bg-neutral-50/70 border-b border-neutral-100">
      <div className="flex items-center gap-2">
        <span className="text-neutral-500">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-700">{title}</span>
      </div>
      <span className="text-[8px] font-bold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{badge}</span>
    </div>
  );
}

// ── 빈 상태 ──────────────────────────────────────────────────────────────────

function EmptyState({ anyEnabled }: { anyEnabled: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 opacity-40 select-none">
      <Layers className="w-10 h-10 text-neutral-200 mb-3" />
      <p className="text-[10px] font-bold tracking-wider text-neutral-400 text-center leading-relaxed whitespace-pre-line">
        {anyEnabled
          ? '주소를 포함한 안건을\n입력하면 정보가 표시됩니다'
          : '토글을 켜고 주소를 포함한\n안건을 입력하면\n정보가 표시됩니다'}
      </p>
    </div>
  );
}

function NoDataState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 opacity-40 select-none">
      <Layers className="w-8 h-8 text-neutral-200 mb-2" />
      <p className="text-[10px] font-bold text-neutral-400 text-center leading-relaxed">
        API 호출 완료<br />해당 주소의 데이터가 없습니다
      </p>
    </div>
  );
}

// ── ① 지적도 아트보드 섹션 (브이월드 1건 이상 시 필수 표시) ─────────────────

// ── ② 대지위치 섹션 ──────────────────────────────────────────────────────────

function ZoneItem({ name }: { name: string }) {
  const regs = ZONE_REGULATIONS[name];
  const lawMapping = getZoneLaws(name);
  const primaryLaw = lawMapping.laws[0];

  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50/60 p-2">
      <p className="text-[10px] font-bold text-neutral-700 mb-1.5">{name}</p>
      {regs ? (
        <div className="flex gap-1.5">
          <span className="flex-1 bg-blue-50 rounded px-1.5 py-1 text-center">
            <span className="block text-[7px] font-bold text-blue-400 mb-0.5">건폐율</span>
            <span className="block text-[11px] font-black text-blue-600">{regs.bcr}</span>
          </span>
          <span className="flex-1 bg-emerald-50 rounded px-1.5 py-1 text-center">
            <span className="block text-[7px] font-bold text-emerald-400 mb-0.5">용적률</span>
            <span className="block text-[11px] font-black text-emerald-600">{regs.far}</span>
          </span>
        </div>
      ) : primaryLaw ? (
        <p className="text-[8px] text-neutral-500 leading-relaxed">
          {primaryLaw.reason} <br />
          <span className="text-neutral-400">({primaryLaw.lawName} {primaryLaw.articleHint})</span>
        </p>
      ) : null}
    </div>
  );
}

function SiteInfoSection({
  address,
  pnu,
  zones,
  landCharacteristics,
}: {
  address: string | null;
  pnu: string | null;
  zones: LawEntry[];
  landCharacteristics?: {
    landArea: string | null;
    landCategory: string | null;
    terrain: string | null;
    roadFrontage: string | null;
  } | null;
}) {
  // zone summary logic removed for canvas since getZoneAnalysis uses gemini
  const isLoadingAi = false;
  const aiSummary = null;

  return (
    <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
      <SectionHeader
        icon={<LandPlot className="w-3.5 h-3.5" />}
        title="대지위치"
        badge="브이월드"
      />
      <div className="p-3 space-y-3">
        {address && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
              <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">대지위치</span>
            </div>
            <p className="text-[13px] font-bold text-neutral-800 leading-snug pl-4">{address}</p>
          </div>
        )}
        {pnu && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Hash className="w-3 h-3 text-neutral-400 shrink-0" />
              <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">PNU 코드</span>
            </div>
            <p className="text-[10px] font-mono text-neutral-600 bg-neutral-50 px-2 py-1 rounded ml-4 tracking-wide">
              {pnu}
            </p>
            <a
              href={`https://www.eum.go.kr/web/ar/lu/luLandDet.jsp?isNoScr=script&mode=search&pnu=${pnu}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 ml-4 inline-flex items-center gap-1 text-[9px] font-bold text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              토지이음에서 확인
            </a>
          </div>
        )}
        {/* 토지특성정보 (대지면적, 지목, 도로접면) */}
        {landCharacteristics && (
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Ruler className="w-3 h-3 text-neutral-400 shrink-0" />
              <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">토지특성</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 pl-4">
              {landCharacteristics.landArea && (
                <div className="col-span-2">
                  <p className="text-[8px] font-bold text-neutral-400 mb-0.5">대지면적</p>
                  <p className="text-[13px] font-black text-neutral-800">{Number(landCharacteristics.landArea).toLocaleString()}㎡</p>
                </div>
              )}
              {landCharacteristics.landCategory && (
                <div>
                  <p className="text-[8px] font-bold text-neutral-400 mb-0.5">지목</p>
                  <p className="text-[10px] font-bold text-neutral-700">{landCharacteristics.landCategory}</p>
                </div>
              )}
              {landCharacteristics.roadFrontage && (
                <div>
                  <p className="text-[8px] font-bold text-neutral-400 mb-0.5">도로접면</p>
                  <p className="text-[10px] font-bold text-neutral-700">{landCharacteristics.roadFrontage}</p>
                </div>
              )}
              {landCharacteristics.terrain && (
                <div className="col-span-2">
                  <p className="text-[8px] font-bold text-neutral-400 mb-0.5">지형</p>
                  <p className="text-[10px] font-bold text-neutral-700">{landCharacteristics.terrain}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {zones.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Layers className="w-3 h-3 text-neutral-400 shrink-0" />
              <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">용도지역지구</span>
            </div>
            <div className="space-y-1.5 pl-4">
              {zones.map((zone, i) => (
                  <div key={i} className="mb-2">
                    <ZoneItem name={zone.lawName} />
                  </div>
              ))}
              <p className="text-[7px] text-neutral-300 pt-0.5 leading-relaxed">
                * 건폐율/용적률: 해당 지자체 도시계획 조례 기준 (지역별 상이)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ② 건물정보 섹션 ──────────────────────────────────────────────────────────

// 소재지·허가번호 등 긴 값은 전체 너비로 표시
const FULL_WIDTH_KEYS = new Set(['소재지', '대지위치', '허가번호', '사업승인번호']);

function BuildingInfoSection({ buildings }: { buildings: LawEntry[] }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
      <SectionHeader
        icon={<Building2 className="w-3.5 h-3.5" />}
        title="건물정보"
        badge="공공데이터포털"
      />
      <div className="p-3 space-y-3">
        {buildings.map((item, i) => {
          // "건축물대장 (HUB) — 건물명" 형식 분리
          const parts = item.lawName.split(' — ');
          const recordType = parts[0].replace('(HUB)', '').trim();
          const buildingName = parts[1]?.trim() ?? '';

          const allFields = [
            ...parsePipeFields(item.articleTitle),
            ...parsePipeFields(item.content),
          ];

          return (
            <div key={i} className={cn('pb-3', i < buildings.length - 1 && 'border-b border-neutral-100')}>
              {/* 레코드 타입 헤더 */}
              <div className="mb-2">
                <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">
                  {recordType}
                </span>
                {buildingName && buildingName !== '정보 없음' && (
                  <span className="ml-1 text-[9px] font-bold text-neutral-600">— {buildingName}</span>
                )}
              </div>

              {/* 필드 2열 그리드 */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {allFields.map(({ key, value }, j) => (
                  <div
                    key={j}
                    className={cn('min-w-0', FULL_WIDTH_KEYS.has(key) && 'col-span-2')}
                  >
                    <p className="text-[8px] font-bold text-neutral-400 mb-0.5">{key}</p>
                    <p
                      className={cn(
                        'text-[10px] text-neutral-700',
                        !FULL_WIDTH_KEYS.has(key) && 'truncate'
                      )}
                      title={value}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ②-1 주차 산정 섹션 ──────────────────────────────────────────────────────

function ParkingSection({
  buildings,
  parkingOrdinance,
}: {
  buildings: LawEntry[];
  parkingOrdinance?: LawEntry[];
}) {
  const parking = useMemo(
    () => calculateParkingFromBuildingData(buildings, parkingOrdinance),
    [buildings, parkingOrdinance]
  );

  if (!parking) return null;

  const isOrdinance = parking.source === 'ordinance';
  const badge = isOrdinance ? '지자체 조례' : '주차장법 시행령';

  return (
    <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
      <SectionHeader
        icon={<Car className="w-3.5 h-3.5" />}
        title="주차 산정"
        badge={badge}
      />
      <div className="p-3 space-y-2">
        {/* 법정 주차대수 — 건폐율/용적률 카드와 동일 스키마 */}
        <div className="flex gap-1.5">
          <span className="flex-1 bg-blue-50 rounded-lg px-3 py-2 text-center">
            <span className="block text-[7px] font-bold text-blue-400 mb-0.5">법정 주차대수</span>
            <span className="block text-[18px] font-black text-blue-600">
              {parking.requiredSpaces}
              <span className="text-[10px] font-bold ml-0.5">대</span>
            </span>
          </span>
        </div>

        {/* 상세 정보 */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-1">
          <div className="col-span-2">
            <p className="text-[8px] font-bold text-neutral-400 mb-0.5">건물 용도</p>
            <p className="text-[10px] font-bold text-neutral-700">{parking.buildingUse}</p>
          </div>
          <div>
            <p className="text-[8px] font-bold text-neutral-400 mb-0.5">연면적</p>
            <p className="text-[10px] font-bold text-neutral-700">{parking.totalFloorArea.toLocaleString()}㎡</p>
          </div>
          <div>
            <p className="text-[8px] font-bold text-neutral-400 mb-0.5">산정 출처</p>
            <p className={cn('text-[9px] font-bold', isOrdinance ? 'text-blue-600' : 'text-neutral-500')}>
              {isOrdinance ? '조례' : '법령기본값'}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[8px] font-bold text-neutral-400 mb-0.5">산정 근거</p>
            <p className="text-[9px] text-neutral-500 leading-relaxed">{parking.calculationBasis}</p>
          </div>
        </div>

        {/* 주석 */}
        <div className="pt-1.5 border-t border-dashed border-neutral-100">
          {isOrdinance ? (
            <p className="text-[7px] text-neutral-400 leading-relaxed">
              * {parking.ordinanceName} 기준 산정
            </p>
          ) : (
            <p className="text-[7px] text-neutral-300 leading-relaxed">
              {parking.ordinanceName
                ? `* ${parking.ordinanceName} 조회됨 — 조문 수치 미인식, 법령 기본값 적용`
                : '* 지자체 조례 미조회 — 주차장법 시행령 별표1 기본값 기준'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ③ 법령정보 섹션 ──────────────────────────────────────────────────────────

function LawInfoSection({ laws, zones }: { laws: LawEntry[]; zones: LawEntry[] }) {
  // 브이월드 용도지역지구 이름 목록에서 매핑 테이블로 관련 법령 조회
  const zoneMappedLaws = zones.length > 0
    ? (() => {
        // 용도지역/지구 이름 중복 제거
        const zoneNames = [...new Set(zones.map(z => z.lawName).filter(Boolean))];
        // 각 지역지구의 법령을 합산하되 법령명 기준으로 중복 제거
        const seen = new Set<string>();
        return zoneNames.flatMap(zoneName => {
          const mapping = getZoneLaws(zoneName);
          return mapping.laws.filter(law => {
            if (seen.has(law.lawName)) return false;
            seen.add(law.lawName);
            return true;
          }).map(law => ({ ...law, _zoneName: zoneName, _zoneCategory: mapping.zoneCategory, _zoneNote: mapping.note }));
        });
      })()
    : [];

  const hasZoneLaws = zoneMappedLaws.length > 0;
  const hasApiLaws = laws.length > 0;

  return (
    <div className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
      <SectionHeader
        icon={<Scale className="w-3.5 h-3.5" />}
        title="법령정보"
        badge="법제처"
      />
      <div className="px-3 py-2 space-y-2">

        {/* ① 용도지역 매핑 기반 법령 (메인) */}
        {hasZoneLaws && (
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1.5">
              용도지역 관련 법령
            </p>
            <div className="space-y-1.5">
              {zoneMappedLaws.map((law, i) => {
                const match = law.articleHint.match(/제(\d+)조/);
                const joNo = match ? `&joNo=${match[1].padStart(4, '0')}` : '';
                const lawUrl = `https://www.law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&eventGubun=060101&query=${encodeURIComponent(law.lawSearchQuery)}${joNo}`;
                return (
                <a
                  key={i}
                  href={lawUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-neutral-100 bg-neutral-50/60 p-2 hover:bg-blue-50/40 hover:border-blue-100 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-[10px] font-bold text-neutral-700 leading-snug group-hover:text-blue-700 flex-1">
                      {law.lawName}
                    </p>
                    <ExternalLink className="w-2.5 h-2.5 text-neutral-300 group-hover:text-blue-400 shrink-0 mt-0.5" />
                  </div>
                  <p className="text-[8px] text-neutral-400 mt-0.5 leading-relaxed">{law.articleHint}</p>
                  <p className="text-[8px] text-neutral-400 mt-0.5 leading-relaxed">{law.reason}</p>
                </a>
              )})}
            </div>
          </div>
        )}

        {/* ② 법제처 API 추가 검색 결과 */}
        {hasApiLaws && (
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 mt-1">
              법제처 검색 결과
            </p>
            <div className="space-y-1.5">
              {laws.map((item, i) => (
                <div key={i} className={cn('py-1', i < laws.length - 1 && 'border-b border-neutral-50')}>
                  <p className="text-[10px] font-bold text-neutral-700 leading-snug">{item.lawName}</p>
                  <p className="text-[9px] text-neutral-500 mt-0.5 leading-snug">{item.articleTitle}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 데이터 없는 경우 */}
        {!hasZoneLaws && !hasApiLaws && (
          <div className="py-3 flex flex-col items-center opacity-50 select-none">
            <Scale className="w-6 h-6 text-neutral-200 mb-1.5" />
            <p className="text-[9px] font-bold text-neutral-400 text-center leading-relaxed">
              주소를 포함한 안건을 입력하면<br />관련 법령이 표시됩니다
            </p>
          </div>
        )}

        {/* 통합 연동 안내 */}
        <div className="pt-2 border-t border-dashed border-neutral-100">
          <p className="text-[8px] text-neutral-400 leading-relaxed">
            ※ 국가법령(건축법 등) 및 해당 대지의 <span className="font-bold text-neutral-500">지자체 자치법규(조례)</span> 통합 연동 표출 중.
          </p>
        </div>
      </div>
    </div>
  );
}

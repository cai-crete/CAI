/**
 * parkingCalculator.ts — 주차장 조례 우선 + 법령 기본값 폴백 주차대수 산정
 *
 * 우선순위:
 *   1. 법제처 bylr에서 조회된 지자체 주차장 조례 — 조문 내 N㎡당 1대 패턴 파싱
 *   2. 파싱 실패(조례 미조회 또는 패턴 불인식) — 주차장법 시행령 별표1 법령 기본값 폴백
 *
 * 기준: 주차장법 시행령 [별표 1] 부설주차장의 설치대상 시설물 종류 및 설치기준
 * 참고: 지자체 조례로 완화/강화 가능 — 조례 조회 실패 시 법령 기본값 사용
 */

import type { LawEntry } from './lawApi';

export interface ParkingResult {
  requiredSpaces: number;
  calculationBasis: string;
  buildingUse: string;
  totalFloorArea: number;
  source: 'ordinance' | 'statute';  // 조례 기반 vs 법령 기본값
  ordinanceName?: string;            // 조례명 (source === 'ordinance' 일 때)
}

interface ParkingRule {
  pattern: RegExp;
  category: string;
  areaPerSpace: number; // N㎡당 1대
  note?: string;
}

/**
 * 주차장법 시행령 별표1 기반 주차 산정 기준표 (법령 기본값 폴백)
 *
 * areaPerSpace: 시설면적 N㎡당 1대
 * 실제 지자체 조례에 따라 다를 수 있으며, 조례 조회 실패 시 이 값을 사용함
 */
const PARKING_RULES: ParkingRule[] = [
  // 주거시설
  { pattern: /단독주택/, category: '단독주택', areaPerSpace: 150, note: '시설면적 150㎡당 1대 (50㎡ 초과 시)' },
  { pattern: /다가구|다세대|연립/, category: '다가구/다세대주택', areaPerSpace: 85, note: '전용면적 85㎡당 1대 (세대당 최소 1대)' },
  { pattern: /아파트|공동주택/, category: '공동주택', areaPerSpace: 85, note: '전용면적 85㎡당 1대 (세대당 최소 1대)' },
  { pattern: /오피스텔/, category: '오피스텔', areaPerSpace: 85, note: '전용면적 85㎡당 1대' },

  // 상업시설
  { pattern: /근린생활|소매|일반음식|휴게음식|제과|미용|세탁|의원|치과|한의원|약국|탁구|체육도장/, category: '제1종·제2종 근린생활시설', areaPerSpace: 134, note: '시설면적 134㎡당 1대' },
  { pattern: /판매|백화점|쇼핑|할인점|도매|상점|시장/, category: '판매시설', areaPerSpace: 134, note: '시설면적 134㎡당 1대' },

  // 업무시설
  { pattern: /업무|사무|오피스|금융|보험|증권|공공/, category: '업무시설', areaPerSpace: 100, note: '시설면적 100㎡당 1대 (서울 기준 150㎡)' },

  // 문화/집회
  { pattern: /문화|집회|공연|전시|관람|극장|영화|박물|미술|도서/, category: '문화 및 집회시설', areaPerSpace: 100, note: '시설면적 100㎡당 1대' },
  { pattern: /종교/, category: '종교시설', areaPerSpace: 100, note: '시설면적 100㎡당 1대' },

  // 교육/연구
  { pattern: /교육|학교|학원|연구|연수/, category: '교육연구시설', areaPerSpace: 150, note: '시설면적 150㎡당 1대' },

  // 의료
  { pattern: /병원|의료|요양|정신/, category: '의료시설', areaPerSpace: 100, note: '시설면적 100㎡당 1대' },

  // 숙박/위락
  { pattern: /숙박|호텔|모텔|여관|펜션|리조트/, category: '숙박시설', areaPerSpace: 134, note: '시설면적 134㎡당 1대' },
  { pattern: /위락|유흥|단란|카지노/, category: '위락시설', areaPerSpace: 100, note: '시설면적 100㎡당 1대' },

  // 운동/체육
  { pattern: /운동|체육|수영|볼링|골프|스키|빙상|승마/, category: '운동시설', areaPerSpace: 134, note: '시설면적 134㎡당 1대' },

  // 공장/창고/물류
  { pattern: /공장|제조|산업/, category: '공장', areaPerSpace: 200, note: '시설면적 200㎡당 1대' },
  { pattern: /창고|물류|하역|집배송/, category: '창고시설', areaPerSpace: 300, note: '시설면적 300㎡당 1대' },

  // 자동차 관련
  { pattern: /자동차|정비|매매|검사|폐차/, category: '자동차 관련 시설', areaPerSpace: 200, note: '시설면적 200㎡당 1대' },

  // 기타
  { pattern: /관광|관광휴게/, category: '관광휴게시설', areaPerSpace: 134, note: '시설면적 134㎡당 1대' },
];

const DEFAULT_RULE: ParkingRule = {
  pattern: /.*/,
  category: '기타시설',
  areaPerSpace: 150,
  note: '시설면적 150㎡당 1대 (기본값)',
};

/**
 * 법제처 bylr 조례 항목에서 N㎡당 1대 패턴을 파싱합니다.
 *
 * 법제처 API는 조문 원문이 아닌 메타데이터(법령명, 시행일 등)만 반환하므로
 * 실제 수치 파싱은 대부분 실패합니다. 이 함수는 미래 API 확장 대비 구조를 유지하며,
 * 현재는 null 반환 → 항상 폴백이 동작합니다.
 */
function parseOrdinanceAreaPerSpace(entries: LawEntry[]): number | null {
  for (const entry of entries) {
    const text = `${entry.articleTitle ?? ''} ${entry.content ?? ''}`;
    // "N㎡당 1대" / "N㎡마다 1대" / "N제곱미터당 1대" 패턴
    const match =
      text.match(/(\d[\d,]*)\s*㎡\s*(?:당|마다)\s*(?:주차대수)?\s*1대/) ??
      text.match(/(\d[\d,]*)\s*제곱미터\s*(?:당|마다)\s*1대/);
    if (match) {
      const parsed = parseInt(match[1].replace(/,/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

/**
 * 건축물대장의 주용도와 연면적으로 법정 주차대수를 산정합니다.
 *
 * @param buildingUse       - 건축물대장 mainPurpsCdNm (예: "업무시설")
 * @param totalFloorArea    - 연면적 (㎡)
 * @param parkingOrdinance  - 법제처에서 조회된 지자체 주차장 조례 항목 (없으면 undefined)
 */
export function calculateParkingRequirement(
  buildingUse: string,
  totalFloorArea: number,
  parkingOrdinance?: LawEntry[],
): ParkingResult | null {
  if (!buildingUse || totalFloorArea <= 0) return null;

  // 1. 조례 파싱 시도
  if (parkingOrdinance && parkingOrdinance.length > 0) {
    const ordinanceAreaPerSpace = parseOrdinanceAreaPerSpace(parkingOrdinance);
    if (ordinanceAreaPerSpace !== null) {
      const requiredSpaces = Math.ceil(totalFloorArea / ordinanceAreaPerSpace);
      const ordinanceName = parkingOrdinance[0].lawName;
      return {
        requiredSpaces,
        calculationBasis: `시설면적 ${ordinanceAreaPerSpace}㎡당 1대 (${ordinanceName})`,
        buildingUse,
        totalFloorArea,
        source: 'ordinance',
        ordinanceName,
      };
    }
  }

  // 2. 폴백: 주차장법 시행령 별표1 법령 기본값
  const rule = PARKING_RULES.find(r => r.pattern.test(buildingUse)) ?? DEFAULT_RULE;
  const requiredSpaces = Math.ceil(totalFloorArea / rule.areaPerSpace);

  // 조례 조회는 됐지만 수치 파싱 실패 → 조례명은 표시하되 법령 기본값 사용
  const hasOrdinanceName = parkingOrdinance && parkingOrdinance.length > 0;
  const ordinanceName = hasOrdinanceName ? parkingOrdinance[0].lawName : undefined;
  const basisNote = ordinanceName
    ? `${rule.note ?? `시설면적 ${rule.areaPerSpace}㎡당 1대`} (주차장법 시행령 별표1 — ${ordinanceName} 수치 미인식)`
    : `${rule.note ?? `시설면적 ${rule.areaPerSpace}㎡당 1대`} (주차장법 시행령 별표1)`;

  return {
    requiredSpaces,
    calculationBasis: basisNote,
    buildingUse: rule.category,
    totalFloorArea,
    source: 'statute',
    ordinanceName,
  };
}

/**
 * 건축물대장 LawEntry 배열에서 주용도와 연면적을 추출하여 주차대수를 산정합니다.
 * InsightPanel에서 호출됩니다.
 */
export function calculateParkingFromBuildingData(
  buildings: { articleTitle?: string; content?: string }[],
  parkingOrdinance?: LawEntry[],
): ParkingResult | null {
  if (buildings.length === 0) return null;

  for (const item of buildings) {
    const useMatch = item.articleTitle?.match(/용도:\s*([^|]+)/);
    const areaMatch = item.content?.match(/연면적:\s*([\d,.]+)/);

    if (useMatch && areaMatch) {
      const buildingUse = useMatch[1].trim();
      const totalFloorArea = parseFloat(areaMatch[1].replace(/,/g, ''));

      if (totalFloorArea > 0) {
        return calculateParkingRequirement(buildingUse, totalFloorArea, parkingOrdinance);
      }
    }
  }

  return null;
}

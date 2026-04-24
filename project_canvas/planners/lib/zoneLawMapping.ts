/**
 * zoneLawMapping.ts — 용도지역지구별 관련 법령 매핑 테이블
 *
 * 브이월드 prposAreaDstrcCodeNm 기반으로 반환된 용도지역지구 이름을
 * 실제 관련 법령으로 변환합니다.
 *
 * ── 유지보수 가이드 ───────────────────────────────────────────────────────────
 * - 법령 개정 시 이 파일의 해당 항목을 직접 수정합니다.
 * - lastVerified: 마지막 법령 현행 여부 검증일 (YYYY-MM-DD)
 * - Claude Code에서 "법령정보 분석해줘" 명령으로 현행 여부를 검증할 수 있습니다.
 */

export interface ZoneLawEntry {
  lawName: string;        // 법령 정식 명칭
  reason: string;         // 이 법령이 적용되는 이유 (UI 표시용)
  articleHint: string;    // 주요 조문 힌트
  lawSearchQuery: string; // 법제처 검색 시 사용할 정식 법령명
  lastVerified: string;   // 마지막 검증일 (YYYY-MM-DD)
}

export interface ZoneLawMapping {
  laws: ZoneLawEntry[];
  zoneCategory: '용도지역' | '용도지구' | '용도구역' | '기타';
  note?: string;
}

// ── 공통 기반 법령 (모든 용도지역에 기본 적용) ────────────────────────────────
const COMMON_LAWS: ZoneLawEntry[] = [
  {
    lawName: '국토의 계획 및 이용에 관한 법률',
    reason: '용도지역 지정 및 건폐율·용적률 기준 규정',
    articleHint: '제76조~제84조 (용도지역별 건축 및 용도 제한)',
    lawSearchQuery: '국토의 계획 및 이용에 관한 법률',
    lastVerified: '2026-04-22',
  },
  {
    lawName: '건축법',
    reason: '건축물 건폐율·높이·구조 등 기본 건축 기준',
    articleHint: '제55조~제60조 (건폐율, 용적률, 높이 제한)',
    lawSearchQuery: '건축법',
    lastVerified: '2026-04-22',
  },
  {
    lawName: '건축법 시행령',
    reason: '면적, 높이, 세부 용도분류 및 별표 서식 기준',
    articleHint: '제2조, 제119조 (면적 등의 산정방법) 및 별표',
    lawSearchQuery: '건축법 시행령',
    lastVerified: '2026-04-22',
  },
  {
    lawName: '건축법 시행규칙',
    reason: '인허가 행정 처리 절차 및 구체적 서식',
    articleHint: '행정규칙 및 인허가 양식 규정',
    lawSearchQuery: '건축법 시행규칙',
    lastVerified: '2026-04-22',
  },
  {
    lawName: '[지자체 조례] 건축/도시계획 조례',
    reason: '해당 지자체(시·도·군·구)의 실제 건축 제한선 및 특수 규정',
    articleHint: '국가법령과 별개로 실제 인허가 최우선 적용',
    lawSearchQuery: '건축 조례', //InsightPanel.tsx에서 ordinSc.do로 분기 처리
    lastVerified: '2026-04-22',
  },
];

const NATIONAL_PLAN_ENFORCEMENT: ZoneLawEntry = {
  lawName: '국토의 계획 및 이용에 관한 법률 시행령',
  reason: '용도지역별 구체적 건폐율·용적률 수치 기준',
  articleHint: '제71조 (용도지역안에서의 건축제한)',
  lawSearchQuery: '국토의 계획 및 이용에 관한 법률 시행령',
  lastVerified: '2026-04-22',
};

const HOUSING_LAW: ZoneLawEntry = {
  lawName: '주택법',
  reason: '주거지역 내 주택 건설 및 공급 기준',
  articleHint: '제15조~제19조 (주택건설사업 승인)',
  lawSearchQuery: '주택법',
  lastVerified: '2026-04-22',
};

const DISTRIBUTION_LAW: ZoneLawEntry = {
  lawName: '유통산업발전법',
  reason: '대규모 판매·유통시설 입지 규정',
  articleHint: '제8조 (대규모점포의 등록)',
  lawSearchQuery: '유통산업발전법',
  lastVerified: '2026-04-22',
};

const INDUSTRY_LAW: ZoneLawEntry = {
  lawName: '산업집적활성화 및 공장설립에 관한 법률',
  reason: '공장 설립 및 운영 기준',
  articleHint: '제13조~제16조 (공장설립 승인)',
  lawSearchQuery: '산업집적활성화 및 공장설립에 관한 법률',
  lastVerified: '2026-04-22',
};

const FARMLAND_LAW: ZoneLawEntry = {
  lawName: '농지법',
  reason: '농지 보전 및 전용 허가 기준',
  articleHint: '제34조 (농지의 전용허가)',
  lawSearchQuery: '농지법',
  lastVerified: '2026-04-22',
};

const NATURE_PRESERVATION_LAW: ZoneLawEntry = {
  lawName: '자연환경보전법',
  reason: '자연환경 및 생태계 보전 기준',
  articleHint: '제15조~제18조 (생태·경관보전지역의 관리)',
  lawSearchQuery: '자연환경보전법',
  lastVerified: '2026-04-22',
};

const GREENBELT_LAW: ZoneLawEntry = {
  lawName: '개발제한구역의 지정 및 관리에 관한 특별조치법',
  reason: '개발제한구역 내 행위 제한 및 허용 기준',
  articleHint: '제12조 (개발제한구역에서의 행위 제한)',
  lawSearchQuery: '개발제한구역의 지정 및 관리에 관한 특별조치법',
  lastVerified: '2026-04-22',
};

const URBAN_IMPROVEMENT_LAW: ZoneLawEntry = {
  lawName: '도시 및 주거환경정비법',
  reason: '정비구역 내 재개발·재건축 사업 시행 기준',
  articleHint: '제8조 (정비구역의 지정), 제35조 (조합의 설립)',
  lawSearchQuery: '도시 및 주거환경정비법',
  lastVerified: '2026-04-22',
};

// ── 용도지역별 매핑 테이블 ────────────────────────────────────────────────────
export const ZONE_LAW_MAPPING: Record<string, ZoneLawMapping> = {

  // ── 주거지역 ────────────────────────────────────────────────────────────────
  '제1종전용주거지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT],
  },
  '제2종전용주거지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT],
  },
  '제1종일반주거지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, HOUSING_LAW],
  },
  '제2종일반주거지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, HOUSING_LAW],
  },
  '제3종일반주거지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, HOUSING_LAW],
  },
  '준주거지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, HOUSING_LAW],
  },

  // ── 상업지역 ────────────────────────────────────────────────────────────────
  '중심상업지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, DISTRIBUTION_LAW],
  },
  '일반상업지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, DISTRIBUTION_LAW],
  },
  '근린상업지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT],
  },
  '유통상업지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, DISTRIBUTION_LAW],
  },

  // ── 공업지역 ────────────────────────────────────────────────────────────────
  '전용공업지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, INDUSTRY_LAW],
  },
  '일반공업지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, INDUSTRY_LAW],
  },
  '준공업지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, INDUSTRY_LAW],
  },

  // ── 녹지지역 ────────────────────────────────────────────────────────────────
  '자연녹지지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, GREENBELT_LAW],
  },
  '생산녹지지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, FARMLAND_LAW],
  },
  '보전녹지지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, NATURE_PRESERVATION_LAW],
  },

  // ── 관리지역 ────────────────────────────────────────────────────────────────
  '계획관리지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, FARMLAND_LAW],
  },
  '생산관리지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, FARMLAND_LAW],
  },
  '보전관리지역': {
    zoneCategory: '용도지역',
    laws: [...COMMON_LAWS, NATIONAL_PLAN_ENFORCEMENT, NATURE_PRESERVATION_LAW],
  },

  // ── 농림·자연환경 ──────────────────────────────────────────────────────────
  '농림지역': {
    zoneCategory: '용도지역',
    laws: [
      ...COMMON_LAWS,
      FARMLAND_LAW,
      {
        lawName: '산지관리법',
        reason: '농림지역 내 산지 이용 및 전용 기준',
        articleHint: '제14조 (산지전용허가)',
        lawSearchQuery: '산지관리법',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '자연환경보전지역': {
    zoneCategory: '용도지역',
    laws: [
      ...COMMON_LAWS,
      NATURE_PRESERVATION_LAW,
      {
        lawName: '자연공원법',
        reason: '자연공원 내 행위 제한 기준',
        articleHint: '제23조 (행위허가)',
        lawSearchQuery: '자연공원법',
        lastVerified: '2026-04-22',
      },
    ],
  },

  // ── 용도지구 (추가 규제 레이어 — 기본 용도지역 위에 덧씌워짐) ────────────────
  '방화지구': {
    zoneCategory: '용도지구',
    note: '기본 용도지역 건폐율/용적률 적용 + 내화구조 강화 규정 추가',
    laws: [
      {
        lawName: '건축법',
        reason: '방화지구 내 건축물 내화구조·방화구조 강화 기준',
        articleHint: '제51조 (방화지구 안의 건축물), 제52조 (마감재료)',
        lawSearchQuery: '건축법',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '미관지구': {
    zoneCategory: '용도지구',
    note: '기본 용도지역 건폐율/용적률 적용 + 건축물 외관·미관 규제 추가',
    laws: [
      {
        lawName: '건축법',
        reason: '미관지구 내 건축물 외관·형태 규제',
        articleHint: '제61조 (일조 등 확보를 위한 높이 제한)',
        lawSearchQuery: '건축법',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '고도지구': {
    zoneCategory: '용도지구',
    note: '기본 용도지역 건폐율/용적률 적용 + 최고 높이 제한 추가',
    laws: [
      {
        lawName: '건축법',
        reason: '고도지구 내 건축물 높이 제한',
        articleHint: '제60조 (건축물의 높이 제한)',
        lawSearchQuery: '건축법',
        lastVerified: '2026-04-22',
      },
      {
        lawName: '국토의 계획 및 이용에 관한 법률',
        reason: '고도지구 지정 기준',
        articleHint: '제37조 (용도지구의 지정)',
        lawSearchQuery: '국토의 계획 및 이용에 관한 법률',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '경관지구': {
    zoneCategory: '용도지구',
    note: '기본 용도지역 건폐율/용적률 적용 + 경관 보전 규제 추가',
    laws: [
      {
        lawName: '경관법',
        reason: '경관지구 내 경관 보전 및 관리 기준',
        articleHint: '제28조 (경관협정), 제30조 (경관사업)',
        lawSearchQuery: '경관법',
        lastVerified: '2026-04-22',
      },
      {
        lawName: '건축법',
        reason: '경관 보전을 위한 건축물 형태·색채 기준',
        articleHint: '제77조의2 (특별건축구역)',
        lawSearchQuery: '건축법',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '취락지구': {
    zoneCategory: '용도지구',
    note: '개발제한구역 내 취락 정비를 위한 특례 구역',
    laws: [GREENBELT_LAW],
  },
  '개발진흥지구': {
    zoneCategory: '용도지구',
    laws: [
      {
        lawName: '국토의 계획 및 이용에 관한 법률',
        reason: '개발진흥지구 지정 및 건축 특례',
        articleHint: '제37조 (용도지구의 지정), 제84조 (건축제한 예외)',
        lawSearchQuery: '국토의 계획 및 이용에 관한 법률',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '특정용도제한지구': {
    zoneCategory: '용도지구',
    note: '유해 용도 입지 제한 지구',
    laws: [
      {
        lawName: '국토의 계획 및 이용에 관한 법률',
        reason: '특정 용도 제한 기준',
        articleHint: '제37조 (용도지구의 지정)',
        lawSearchQuery: '국토의 계획 및 이용에 관한 법률',
        lastVerified: '2026-04-22',
      },
    ],
  },

  // ── 용도구역 ────────────────────────────────────────────────────────────────
  '개발제한구역': {
    zoneCategory: '용도구역',
    note: '그린벨트 — 건축행위 원칙 금지, 예외적 허용행위 열거',
    laws: [
      GREENBELT_LAW,
      {
        lawName: '국토의 계획 및 이용에 관한 법률',
        reason: '개발제한구역 지정 근거',
        articleHint: '제38조 (개발제한구역의 지정)',
        lawSearchQuery: '국토의 계획 및 이용에 관한 법률',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '도시자연공원구역': {
    zoneCategory: '용도구역',
    note: '도시 내 자연공원 보전 구역',
    laws: [
      {
        lawName: '도시공원 및 녹지 등에 관한 법률',
        reason: '도시자연공원구역 내 행위 제한',
        articleHint: '제27조 (도시자연공원구역에서의 행위 등)',
        lawSearchQuery: '도시공원 및 녹지 등에 관한 법률',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '시가화조정구역': {
    zoneCategory: '용도구역',
    note: '도시 외곽 시가화 억제 구역',
    laws: [
      {
        lawName: '국토의 계획 및 이용에 관한 법률',
        reason: '시가화조정구역 내 개발행위 제한',
        articleHint: '제39조 (시가화조정구역의 지정)',
        lawSearchQuery: '국토의 계획 및 이용에 관한 법률',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '수산자원보호구역': {
    zoneCategory: '용도구역',
    laws: [
      {
        lawName: '수산자원관리법',
        reason: '수산자원보호구역 내 행위 제한',
        articleHint: '제52조 (수산자원보호구역)',
        lawSearchQuery: '수산자원관리법',
        lastVerified: '2026-04-22',
      },
    ],
  },

  // ── 지구단위계획 / 정비구역 / 개발구역 ────────────────────────────────────
  '지구단위계획구역': {
    zoneCategory: '용도구역',
    note: '개별 지구단위계획서 확인 필수 — 건폐율·용적률이 계획서마다 다름',
    laws: [
      {
        lawName: '국토의 계획 및 이용에 관한 법률',
        reason: '지구단위계획구역 지정 및 계획 수립 기준',
        articleHint: '제49조~제52조 (지구단위계획구역 및 지구단위계획)',
        lawSearchQuery: '국토의 계획 및 이용에 관한 법률',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '제1종지구단위계획구역': {
    zoneCategory: '용도구역',
    note: '개별 지구단위계획서 확인 필수',
    laws: [
      {
        lawName: '국토의 계획 및 이용에 관한 법률',
        reason: '제1종 지구단위계획구역 지정 기준',
        articleHint: '제49조~제52조 (지구단위계획구역 및 지구단위계획)',
        lawSearchQuery: '국토의 계획 및 이용에 관한 법률',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '제2종지구단위계획구역': {
    zoneCategory: '용도구역',
    note: '개별 지구단위계획서 확인 필수',
    laws: [
      {
        lawName: '국토의 계획 및 이용에 관한 법률',
        reason: '제2종 지구단위계획구역 지정 기준',
        articleHint: '제49조~제52조 (지구단위계획구역 및 지구단위계획)',
        lawSearchQuery: '국토의 계획 및 이용에 관한 법률',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '도시개발구역': {
    zoneCategory: '용도구역',
    laws: [
      {
        lawName: '도시개발법',
        reason: '도시개발구역 내 사업 시행 및 건축 기준',
        articleHint: '제2조~제11조 (도시개발구역 지정)',
        lawSearchQuery: '도시개발법',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '정비구역': {
    zoneCategory: '용도구역',
    note: '재개발·재건축 사업 시행 구역',
    laws: [URBAN_IMPROVEMENT_LAW],
  },
  '재개발구역': { zoneCategory: '용도구역', laws: [URBAN_IMPROVEMENT_LAW] },
  '재건축구역': { zoneCategory: '용도구역', laws: [URBAN_IMPROVEMENT_LAW] },
  '주거환경개선구역': { zoneCategory: '기타', laws: [URBAN_IMPROVEMENT_LAW] },

  // ── 기타 ────────────────────────────────────────────────────────────────────
  '가로구역별최고높이제한': {
    zoneCategory: '기타',
    note: '별도 고시(지자체)로 지정된 가로구역별 최고 높이 제한',
    laws: [
      {
        lawName: '건축법',
        reason: '가로구역별 건축물 최고 높이 제한 근거',
        articleHint: '제60조 (건축물의 높이 제한)',
        lawSearchQuery: '건축법',
        lastVerified: '2026-04-22',
      },
    ],
  },
  '아파트지구': {
    zoneCategory: '기타',
    note: '아파트 위주 개발을 위해 지정된 지구',
    laws: [
      {
        lawName: '국토의 계획 및 이용에 관한 법률',
        reason: '아파트지구 내 건축 기준',
        articleHint: '제37조 (용도지구의 지정)',
        lawSearchQuery: '국토의 계획 및 이용에 관한 법률',
        lastVerified: '2026-04-22',
      },
      HOUSING_LAW,
    ],
  },
};

// ── 공개 유틸리티 함수 ─────────────────────────────────────────────────────────

/**
 * 용도지역지구 이름으로 관련 법령 목록을 조회합니다.
 *
 * 매핑 우선순위:
 * 1. 정확한 이름 매칭
 * 2. 부분 이름 매칭 (예: "제2종일반주거지역(7층이하)" → "제2종일반주거지역")
 * 3. 폴백: 공통 법령(국토계획법, 건축법)
 */
export function getZoneLaws(zoneName: string): ZoneLawMapping {
  if (ZONE_LAW_MAPPING[zoneName]) return ZONE_LAW_MAPPING[zoneName];

  const partialKey = Object.keys(ZONE_LAW_MAPPING).find(
    k => zoneName.includes(k) || k.includes(zoneName)
  );
  if (partialKey) return ZONE_LAW_MAPPING[partialKey];

  return {
    zoneCategory: '기타',
    note: `'${zoneName}' — 매핑 테이블 미등록. 공통 법령 적용.`,
    laws: [...COMMON_LAWS],
  };
}

/**
 * 용도지역지구 목록에서 법제처 검색에 사용할 법령명 목록을 추출합니다.
 * 중복 제거 후 반환합니다.
 */
export function extractLawSearchQueries(zoneNames: string[]): string[] {
  const queries = new Set<string>();
  for (const zoneName of zoneNames) {
    const mapping = getZoneLaws(zoneName);
    for (const law of mapping.laws) {
      queries.add(law.lawSearchQuery);
    }
  }
  return Array.from(queries);
}

/**
 * 매핑 테이블의 모든 법령 항목과 검증일을 반환합니다.
 * "법령정보 분석해줘" 감시 루프에서 현행 여부 검증에 사용합니다.
 */
export function getAllVerificationEntries(): {
  zoneName: string;
  lawName: string;
  lastVerified: string;
}[] {
  const results: { zoneName: string; lawName: string; lastVerified: string }[] = [];
  for (const [zoneName, mapping] of Object.entries(ZONE_LAW_MAPPING)) {
    for (const law of mapping.laws) {
      results.push({ zoneName, lawName: law.lawName, lastVerified: law.lastVerified });
    }
  }
  return results;
}

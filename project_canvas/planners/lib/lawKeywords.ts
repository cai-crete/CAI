/**
 * lawKeywords.ts — 건축·법령 트리거 키워드 목록 및 주소 감지 유틸리티
 *
 * 사용자 안건 키워드 중 이 목록에 해당하는 단어가 있으면
 * 법령 API를 자동으로 호출합니다.
 *
 * 안건 원문에서 시/구 레벨 주소가 감지되면 브이월드 API도 호출합니다.
 *
 * 키워드 추가 시 이 파일에만 추가하면 됩니다.
 */

// ── 건축 인허가 관련 ──────────────────────────────────────────────────────────
const PERMIT_KEYWORDS = [
  '건축허가', '건축신고', '착공신고', '사용승인', '임시사용승인',
  '건축물대장', '건축주', '시공사', '감리', '건축심의',
  '건폐율', '용적률', '높이제한', '일조권', '연면적',
  '전용면적', '공급면적', '대지면적', '건축면적',
];

// ── 용도·계획 관련 ────────────────────────────────────────────────────────────
const ZONING_KEYWORDS = [
  '용도지역', '용도지구', '용도구역', '용도변경',
  '도시계획', '도시관리계획', '지구단위계획', '도시개발',
  '주거지역', '상업지역', '공업지역', '녹지지역',
  '개발행위허가', '토지이용계획',
];

// ── 법령·규정 일반 ────────────────────────────────────────────────────────────
const REGULATION_KEYWORDS = [
  '건축법', '주택법', '국토계획법', '도시정비법', '집합건물법',
  '부동산등기법', '임대차보호법', '분양', '임차', '등기',
  '법령', '조례', '규정', '허가', '신고', '위반건축물',
  '인허가', '행정처분',
];

// ── 사업 유형 관련 ────────────────────────────────────────────────────────────
const PROJECT_TYPE_KEYWORDS = [
  '재개발', '재건축', '리모델링', '신축', '증축', '대수선',
  '분양권', '임대주택', '공공주택', '오피스텔', '상가',
  '주상복합', '지식산업센터',
];

export const LAW_TRIGGER_KEYWORDS: readonly string[] = [
  ...PERMIT_KEYWORDS,
  ...ZONING_KEYWORDS,
  ...REGULATION_KEYWORDS,
  ...PROJECT_TYPE_KEYWORDS,
];

// ── 용도지역 키워드 (브이월드 prposAreaDstrcCodeNm 필터용) ───────────────────────
export const ZONE_TYPE_KEYWORDS: readonly string[] = [
  '주거지역', '상업지역', '공업지역', '녹지지역',
  '아파트지구', '주거환경개선구역', '재개발구역', '재건축구역',
  '지구단위계획구역', '도시개발구역', '정비구역',
];

// ── 광역시·도 식별자 ──────────────────────────────────────────────────────────
const METRO_CITIES = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
];
const PROVINCES = [
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  '충청북도', '충청남도', '전라북도', '전라남도', '경상북도', '경상남도', '제주도',
];

// 시/구/군 행정구역 접미사 패턴
const DISTRICT_PATTERN = /([가-힣]{2,6}(?:특별시|광역시|특별자치시|특별자치도|시|도))\s*([가-힣]{2,5}(?:구|시|군))/;

export interface DetectedAddress {
  city: string;    // 예: "서울시", "부산광역시"
  district: string; // 예: "강남구", "해운대구"
  full: string;    // 예: "서울시 강남구"
}

/**
 * 안건 원문에서 시/구 레벨 주소를 감지합니다.
 * "서울시 강남구", "부산 해운대구", "경기도 수원시" 등의 패턴을 인식합니다.
 * 감지되지 않으면 null을 반환합니다.
 */
export function extractAddress(context: string): DetectedAddress | null {
  // 패턴 A: 도로명 주소 전체 (예: "서울시 강남구 학동로 218", "서울시 강남구 논현로128길 24-1")
  // \d*(?:번?길)? — 보조간선도로 번호+길 (논현로128길) 또는 생략
  // \s*\d+(?:-\d+)? — 건물번호 필수 캡처
  const roadMatch = context.match(
    /([가-힣]{2,6}(?:특별시|광역시|특별자치시|특별자치도|시|도))\s*([가-힣]{2,5}(?:구|시|군))\s+([가-힣]+(?:로|길)\d*(?:번?길)?\s*\d+(?:-\d+)?)/
  );
  if (roadMatch) {
    const city = roadMatch[1];
    const district = roadMatch[2];
    const detail = roadMatch[3].trim();
    return { city, district, full: `${city} ${district} ${detail}` };
  }

  // 패턴 B: 지번 주소 전체 (예: "서울시 강남구 신사동 537-5")
  const lotMatch = context.match(
    /([가-힣]{2,6}(?:특별시|광역시|특별자치시|특별자치도|시|도))\s*([가-힣]{2,5}(?:구|시|군))\s+([가-힣]+동\s*\d+(?:-\d+)?(?:번지)?)/
  );
  if (lotMatch) {
    const city = lotMatch[1];
    const district = lotMatch[2];
    const detail = lotMatch[3].trim();
    return { city, district, full: `${city} ${district} ${detail}` };
  }

  // 패턴 C: 광역시 약칭 + 구 + 도로명 (예: "서울 강남구 학동로 218", "서울 강남구 논현로128길 24-1")
  const shortRoadMatch = context.match(
    /([가-힣]{2,4})\s+([가-힣]{2,5}구)\s+([가-힣]+(?:로|길)\d*(?:번?길)?\s*\d+(?:-\d+)?)/
  );
  if (shortRoadMatch) {
    for (const metro of METRO_CITIES) {
      if (shortRoadMatch[1].includes(metro)) {
        return {
          city: metro,
          district: shortRoadMatch[2],
          full: `${metro} ${shortRoadMatch[2]} ${shortRoadMatch[3].trim()}`
        };
      }
    }
  }

  // 패턴 C-2: 광역시 약칭 + 구 + 지번 (예: "서울 강남구 신사동 537-5")
  // Pattern B는 시/도 접미사를 요구하므로, "서울 강남구" 형태의 지번 주소를 여기서 처리
  const shortLotMatch = context.match(
    /([가-힣]{2,4})\s+([가-힣]{2,5}구)\s+([가-힣]+(?:동|리)\s*\d+(?:-\d+)?(?:번지)?)/
  );
  if (shortLotMatch) {
    for (const metro of METRO_CITIES) {
      if (shortLotMatch[1].includes(metro)) {
        return {
          city: metro,
          district: shortLotMatch[2],
          full: `${metro} ${shortLotMatch[2]} ${shortLotMatch[3].trim()}`
        };
      }
    }
  }

  // 패턴 D: 시/구 레벨만 (폴백 — 상세 주소 없는 경우)
  const match = context.match(DISTRICT_PATTERN);
  if (match) {
    const city = match[1];
    const district = match[2];
    return { city, district, full: `${city} ${district}` };
  }

  // 패턴 E: 광역시 단독 + 구 패턴 (예: "강남구")
  const districtOnlyMatch = context.match(/([가-힣]{2,5}구)/);
  if (districtOnlyMatch) {
    const district = districtOnlyMatch[1];
    for (const metro of METRO_CITIES) {
      if (context.includes(metro)) {
        // 근처에 도로명/지번이 있는지 추가 탐색
        const nearbyRoad = context.match(new RegExp(`${district}\\s+([가-힣]+(?:로|길)\\d*(?:번?길)?\\s*\\d+(?:-\\d+)?)`));
        const nearbyLot = context.match(new RegExp(`${district}\\s+([가-힣]+동\\s*\\d+(?:-\\d+)?)`));
        const detail = nearbyRoad?.[1] || nearbyLot?.[1] || '';
        const full = detail ? `${metro} ${district} ${detail}` : `${metro} ${district}`;
        return { city: metro, district, full };
      }
    }
    for (const prov of PROVINCES) {
      if (context.includes(prov)) {
        return { city: prov, district, full: `${prov} ${district}` };
      }
    }
  }

  return null;
}

/**
 * 안건 원문에서 용도지역 관련 키워드를 추출합니다.
 * 브이월드 prposAreaDstrcCodeNm 파라미터에 사용됩니다.
 */
export function extractZoneKeyword(context: string): string {
  for (const zone of ZONE_TYPE_KEYWORDS) {
    if (context.includes(zone)) return zone;
  }
  return '';
}

/**
 * 법령 API 호출 여부를 반환합니다.
 * 게이트는 UI 토글(isLawEnabled)로 이전됨 — 이 함수는 항상 true를 반환합니다.
 * 건축 특화 API(건축물대장·VWorld)는 detectedAddress 유무로 자동 분기됩니다.
 */
export function isLawRelevant(_keywords: string[]): boolean {
  return true;
}

/**
 * 사용자 입력 토큰을 그대로 반환합니다.
 * 법제처는 어떤 키워드로도 검색 가능하며, 결과 없으면 빈 배열을 반환합니다.
 * 건축 특화 API는 address 감지 여부로 별도 분기됩니다.
 */
export function extractLawKeywords(keywords: string[]): string[] {
  return keywords.filter(k => k.length >= 2);
}

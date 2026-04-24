/**
 * lawApi.ts — 클라이언트 측 법령·건축 API 호출 유틸리티
 *
 * 역할: 클라이언트가 직접 법령 API를 호출하지 않고,
 *       반드시 /api/law 서버사이드 프록시를 경유합니다.
 *
 * 반환값: Protocol {{RELEVANT_LAWS}} placeholder에 주입할 문자열
 *         법령이 없거나 오류 시 빈 문자열 반환 (파이프라인 정상 유지)
 */

export interface LawEntry {
  source: '법제처' | '공공데이터포털' | '브이월드';
  lawName: string;
  articleTitle: string;
  content: string;
}

export interface LawApiResponse {
  laws: LawEntry[];
  categorized?: {
    law: LawEntry[];
    building: LawEntry[];
    land: LawEntry[];
  };
  pnu?: string | null;
  landCharacteristics?: {
    landArea: string | null;
    landCategory: string | null;
    terrain: string | null;
    roadFrontage: string | null;
  } | null;
  parkingOrdinance?: LawEntry[];
  note?: string;
}

export interface ApiToggleFlags {
  enableLaw?: boolean;
  enableBuilding?: boolean;
  enableLand?: boolean;
}

export interface FetchLawsResult {
  formatted: string;
  categorized: {
    law: LawEntry[];
    building: LawEntry[];
    land: LawEntry[];
  };
  pnu: string | null;
  landCharacteristics?: {
    landArea: string | null;
    landCategory: string | null;
    terrain: string | null;
    roadFrontage: string | null;
  } | null;
  parkingOrdinance?: LawEntry[];  // 지자체 주차장 조례 (조회 성공 시)
}

/**
 * 법령·건축 API 프록시를 호출하여 관련 정보를 반환합니다.
 *
 * @param keywords   - 법령 검색에 사용할 키워드 배열 (법령 트리거 키워드만 전달)
 * @param address    - 감지된 시/구 주소 (예: "서울시 강남구"). 없으면 undefined.
 * @param zoneKeyword - 용도지역 관련 키워드 (예: "주거지역"). 브이월드 필터용.
 * @param toggles    - 각 API 토글 플래그 (enableLaw, enableBuilding, enableLand)
 * @returns formatted: Protocol 주입용 문자열, categorized: source별 분류, pnu: PNU 코드
 */
export async function fetchRelevantLaws(
  keywords: string[],
  address?: string,
  zoneKeyword?: string,
  toggles?: ApiToggleFlags,
): Promise<FetchLawsResult> {
  const emptyResult: FetchLawsResult = {
    formatted: '',
    categorized: { law: [], building: [], land: [] },
    pnu: null,
  };

  if (keywords.length === 0 && !address) return emptyResult;

  try {
    const res = await fetch('https://cai-planners-v2.vercel.app/api/law', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords,
        address,
        zoneKeyword,
        enableLaw: toggles?.enableLaw,
        enableBuilding: toggles?.enableBuilding,
        enableLand: toggles?.enableLand,
      }),
    });

    if (!res.ok) {
      console.error(`❌ [법령 API] 호출 실패 — HTTP ${res.status}`);
      return emptyResult;
    }

    const data: LawApiResponse = await res.json();

    // 브라우저 콘솔 로깅 — 각 API 호출 결과
    const cat = data.categorized || { law: [], building: [], land: [] };
    if (toggles?.enableLaw !== false) {
      if (cat.law.length > 0) {
        console.log(`✅ [법제처] 호출 완료 — ${cat.law.length}건 반환`);
      } else {
        console.log(`⬚ [법제처] 호출 완료 — 0건 (관련 데이터 없음)`);
      }
    }
    if (toggles?.enableBuilding !== false) {
      if (cat.building.length > 0) {
        console.log(`✅ [공공데이터포털] 호출 완료 — ${cat.building.length}건 반환`);
      } else {
        console.log(`⬚ [공공데이터포털] 호출 완료 — 0건 (PNU 미감지 또는 데이터 없음)`);
      }
    }
    if (toggles?.enableLand !== false) {
      if (cat.land.length > 0) {
        console.log(`✅ [브이월드] 호출 완료 — ${cat.land.length}건 반환`);
      } else {
        console.log(`⬚ [브이월드] 호출 완료 — 0건 (PNU 미감지 또는 데이터 없음)`);
      }
    }
    if (data.pnu) {
      console.log(`📍 [PNU] ${data.pnu} (주소: ${address || 'N/A'})`);
    }

    if (!data.laws || data.laws.length === 0) return {
      ...emptyResult,
      pnu: data.pnu || null,
      landCharacteristics: data.landCharacteristics || null,
      parkingOrdinance: data.parkingOrdinance,
    };

    return {
      formatted: formatLawsForProtocol(data.laws),
      categorized: cat,
      pnu: data.pnu || null,
      landCharacteristics: data.landCharacteristics || null,
      parkingOrdinance: data.parkingOrdinance,
    };
  } catch (err) {
    // 법령 API 실패 시 토론 파이프라인을 막지 않음
    console.error(`❌ [법령 API] 호출 실패 —`, err);
    return emptyResult;
  }
}

/**
 * LawEntry 배열을 Protocol 주입용 마크다운 텍스트로 변환합니다.
 */
function formatLawsForProtocol(laws: LawEntry[]): string {
  const lines = laws.map(law =>
    `- [${law.source}] **${law.lawName}** — ${law.articleTitle}\n  ${law.content}`
  );
  return lines.join('\n');
}

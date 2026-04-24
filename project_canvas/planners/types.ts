export interface ExpertTurnData {
  expertId: string;
  role: 'thesis' | 'antithesis' | 'synthesis' | 'support';
  keywords?: string[];
  shortContent: string;
  fullContent: string;
}

export interface MetacognitiveDefinition {
  selectedMode: string;
  projectDefinition: string;
  activeSquadReason: string;
}

export interface TransparencyReport {
  selfHealingLog: string;
  truthfulnessCheck: string;
  realImpact: string;
  nextActionSuggestion: string;
}

export interface LawCitation {
  id: number;           // [[CITED_LAWS]] 번호 (1, 2, 3...)
  source: string;       // '[법제처]', '[브이월드]', '[건축물대장]' 등
  lawName: string;      // '건축법 제44조'
  reason: string;       // '대지와 도로의 관계 산정 근거'
  url?: string;         // 원문 링크 (source 기반 결정론적 생성)
}

export interface ParallelGroupResult {
  groupId: string; // 'A', 'B', 'C'
  squadIds: string[];
  status: 'pending' | 'loading' | 'complete' | 'error' | 'coming-soon';
  mode: string;
  synergyScore?: number;
  data: Partial<TurnGroupNodeData>;
}

export interface TurnGroupNodeData extends Record<string, unknown> {
  turn: number;
  metacognitiveDefinition?: MetacognitiveDefinition;
  workflowSimulationLog?: string;
  thesis?: ExpertTurnData;
  antithesis?: ExpertTurnData;
  synthesis?: ExpertTurnData;
  support?: ExpertTurnData;
  shortFinalOutput?: string;
  finalOutput?: string;
  transparencyReport?: TransparencyReport;
  aggregatedPrompt?: string;
  aggregatedSummary?: string;
  aggregatedKeywords?: string[];
  citedLaws?: string;           // 원문 보존 (fallback용)
  parsedCitations?: LawCitation[]; // 구조화된 인용 목록 (인라인 마커용)

  // 3그룹 병렬 모드
  isParallel?: boolean;
  parallelResults?: ParallelGroupResult[];
  selectedGroupId?: string;
}

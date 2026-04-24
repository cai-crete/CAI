'use client';

import { memo, useMemo, useState, useEffect, useRef, Children } from 'react';
import { createPortal } from 'react-dom';
import { cn, sanitize, sanitizeShort, formatExpertText } from './utils';
import {
  X, Copy, ChevronRight, Settings,
  Bot, Layers, Check, Loader2, ChevronDown, MessageSquare, Sparkles, Info,
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale, LayoutPanelLeft, User, RotateCcw, RefreshCw, Send,
  Archive, PanelRightClose, PanelRightOpen, Plus as PlusIcon, FileText, Image as ImageIcon, Library, Download,
  Mic, Paperclip, Sparkles as WandSparkles, Link2, ExternalLink, Building2, LandPlot
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExpertTurnData, LawCitation, TurnGroupNodeData } from './types';
import { EXPERTS } from './experts';
import { extractAddress, extractLawKeywords, extractZoneKeyword } from './lib/lawKeywords';
import { fetchRelevantLaws, type FetchLawsResult } from './lib/lawApi';

const IconMap: Record<string, any> = {
  Orbit, Search, GitBranch, Shield, Zap, Compass, Wind, Hash,
  History, Target, Cpu, PenTool, Box, Scale
};

/** Apple iOS 스타일 토글 스위치 */
function AppleToggle({ enabled, onToggle, title }: { enabled: boolean; onToggle: () => void; title?: string }) {
  return (
    <button
      onClick={onToggle}
      title={title}
      className={cn(
        "relative inline-flex items-center shrink-0 w-[42px] h-[26px] rounded-full transition-colors duration-200 ease-in-out focus:outline-none",
        enabled ? "bg-black" : "bg-neutral-300"
      )}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={cn(
          "absolute left-[3px] top-[3px] w-5 h-5 bg-white rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-in-out",
          enabled ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

const MARKDOWN_CLASSES = "compact-markdown max-w-none text-black select-text whitespace-normal [&_strong]:font-black [&_strong]:text-black [&_strong]:bg-neutral-100 [&_strong]:px-1 [&_strong]:rounded [&_strong]:ring-1 [&_strong]:ring-neutral-200 [&_blockquote]:border-l-4 [&_blockquote]:border-black [&_blockquote]:bg-neutral-50 [&_blockquote]:px-5 [&_blockquote]:py-6 [&_blockquote]:italic [&_blockquote]:rounded-r-lg [&_hr]:border-neutral-200 text-[13px] leading-[1.8] tracking-tight";

function CitedLawsSection({ citedLaws }: { citedLaws: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const lineCount = citedLaws.trim().split('\n').filter(l => /^\s*(-|\d+\.)/.test(l)).length;
  if (!citedLaws.trim()) return null;
  return (
    <div className="border-t border-neutral-100">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors"
      >
        <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2">
          <Scale className="w-4 h-4" />
          인용 법령
          {lineCount > 0 && (
            <span className="ml-1 bg-neutral-200 text-neutral-600 text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {lineCount}
            </span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className={cn(MARKDOWN_CLASSES, "px-6 pb-5 text-[12px]")}>
          <Markdown remarkPlugins={[remarkGfm]}>{citedLaws}</Markdown>
        </div>
      )}
    </div>
  );
}

function stripCiteMarkers(text: string): string {
  return text
    .replace(/\[\[CITE:\d+\]\]/g, '')
    .replace(/\[CITE_REF:\d+\]/g, '');
}

function splitWithCitations(text: string, citations: LawCitation[]): React.ReactNode[] {
  if (!citations.length) return [text];
  const parts = text.split(/(\[CITE_REF:\d+\](?:\[CITE_REF:\d+\])*)/g);
  return parts.map((part, i) => {
    if (/^\[CITE_REF:\d+\]/.test(part)) {
      const ids = Array.from(part.matchAll(/\[CITE_REF:(\d+)\]/g)).map(m => parseInt(m[1], 10));
      return <CitationMarker key={i} citations={citations} ids={ids} />;
    }
    return part;
  });
}

function CitationMarker({ citations, ids }: { citations: LawCitation[]; ids: number[] }) {
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const matched = ids.map(id => citations.find(c => c.id === id)).filter((c): c is LawCitation => !!c);
  if (matched.length === 0) return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPopupPos({ x: rect.left + rect.width / 2, y: rect.top });
    }
    setOpen(v => !v);
  };

  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="relative inline-flex items-center justify-center w-5 h-5 ml-0.5 rounded-full bg-black hover:bg-neutral-700 text-white transition-colors align-middle shrink-0"
        title="인용 법령 보기"
      >
        <Link2 className="w-3 h-3 rotate-45" />
        {matched.length > 1 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-3 h-3 rounded-full bg-neutral-500 text-white text-[7px] font-black leading-none">
            +{matched.length - 1}
          </span>
        )}
      </button>

      {open && popupPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] w-64 bg-white border border-neutral-200 rounded-xl shadow-xl p-3 animate-in fade-in zoom-in-95 duration-150"
            style={{
              left: popupPos.x,
              top: popupPos.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {matched.map((c, i) => (
              <div key={c.id} className={cn("flex items-start gap-2", i > 0 && "mt-2 pt-2 border-t border-neutral-100")}>
                <span className="shrink-0 mt-0.5 text-[9px] font-black text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">{c.source}</span>
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-black leading-tight">{c.lawName}</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">{c.reason}</p>
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black text-neutral-400 hover:text-black transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      원문 보기
                    </a>
                  )}
                </div>
              </div>
            ))}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-neutral-200 rotate-45" />
          </div>
        </>,
        document.body
      )}
    </span>
  );
}

const MarkdownComponents = {
  h1: (p: any) => <h1 className="text-[22px] font-black text-black border-b-4 border-black pb-4 mb-10 mt-6 tracking-tighter" {...p} />,
  h2: (p: any) => <h2 className="text-[19px] font-black text-white bg-black px-4 py-1.5 inline-block mb-6 mt-12 tracking-tight" {...p} />,
  h3: (p: any) => <h3 className="text-[17px] font-black text-black border-l-4 border-black pl-3 mb-10 mt-8" {...p} />,
  h4: (p: any) => {
    const text = String(p.children || '');
    let Icon = Sparkles;
    if (text.includes('Strategy') || text.includes('전략')) Icon = Target;
    if (text.includes('Tactical') || text.includes('전술') || text.includes('Action') || text.includes('실행')) Icon = Zap;
    if (text.includes('Risk') || text.includes('리스크')) Icon = Shield;

    return (
      <div className="flex items-center gap-2 mb-8 mt-8 pb-2 border-b border-neutral-100">
        <Icon className="w-5 h-5 text-black" />
        <h4 className="text-[16px] font-black text-black m-0 tracking-wide" {...p} />
      </div>
    );
  },
  p: (p: any) => <p className="text-[13.5px] leading-[1.8] text-neutral-800 font-medium mb-6" {...p} />,
  strong: (p: any) => <strong className="font-black text-black bg-neutral-100 px-1 rounded ring-1 ring-neutral-200" {...p} />,
  ul: (p: any) => <ul className="space-y-4 mt-4 mb-2 ml-4 list-none" {...p} />,
  li: (p: any) => (
    <li className="relative pl-5 text-[13.5px] leading-[1.7] text-neutral-700 mb-2">
      <div className="absolute left-0 top-2.5 w-1.5 h-1.5 rounded-full bg-black/30" />
      {p.children}
    </li>
  ),
  blockquote: (p: any) => (
    <div className="my-10 p-6 bg-neutral-50 border-y-2 border-neutral-100 relative italic text-center">
      <span className="absolute top-2 left-4 text-4xl text-neutral-200 font-serif">“</span>
      <div className="text-[15px] font-semibold text-neutral-700 leading-relaxed">{p.children}</div>
      <span className="absolute bottom-2 right-4 text-4xl text-neutral-200 font-serif">”</span>
    </div>
  ),
  hr: () => <div className="h-px bg-gradient-to-r from-transparent via-neutral-300 to-transparent my-14" />,
  table: (p: any) => <div className="overflow-x-auto my-6"><table className="w-full border-collapse text-[12.5px]" {...p} /></div>,
  thead: (p: any) => <thead className="bg-black text-white" {...p} />,
  tbody: (p: any) => <tbody className="divide-y divide-neutral-100" {...p} />,
  tr: (p: any) => <tr className="hover:bg-neutral-50 transition-colors" {...p} />,
  th: (p: any) => <th className="px-4 py-2.5 text-left text-[11px] font-black tracking-wider whitespace-nowrap" {...p} />,
  td: (p: any) => <td className="px-4 py-2.5 text-neutral-700 font-medium leading-snug" {...p} />,
};

function buildMarkdownComponents(citations: LawCitation[]) {
  const processChildren = (children: React.ReactNode) =>
    Children.map(children, (child: React.ReactNode) =>
      typeof child === 'string' ? splitWithCitations(child, citations) : child
    );

  return {
    ...MarkdownComponents,
    p: (props: any) => (
      <p className="text-[13.5px] leading-[1.8] text-neutral-800 font-medium mb-6">
        {processChildren(props.children)}
      </p>
    ),
    li: (props: any) => (
      <li className="relative pl-5 text-[13.5px] leading-[1.7] text-neutral-700 mb-2">
        <div className="absolute left-0 top-2.5 w-1.5 h-1.5 rounded-full bg-black/30" />
        {processChildren(props.children)}
      </li>
    ),
  };
}

const reorderLegacyFinalOutput = (text: string) => {
  if (!text) return '';
  if (/^\s*(###\s*)?(Final Output)/i.test(text)) return text;

  const metaDef = text.match(/###\s*Metacognitive Definition[\s\S]*?(?=###|$)/i);
  const workflow = text.match(/###\s*Workflow Simulation Log[\s\S]*?(?=###|$)/i);
  const finalOut = text.match(/###\s*Final Output[\s\S]*?(?=###\s*Metacognitive Transparency Report|###\s*Metacognitive Definition|$)/i);
  const transparency = text.match(/###\s*Metacognitive Transparency Report[\s\S]*?(?=###|$)/i);

  if (!finalOut) return text;

  return [
    finalOut[0],
    metaDef ? metaDef[0] : '',
    workflow ? workflow[0] : '',
    transparency ? transparency[0] : ''
  ].filter(Boolean).join('\n\n');
};

const HighlightText = ({ text, keywords }: { text: string; keywords: string[] }) => {
  if (!keywords || keywords.length === 0) return <>{text}</>;

  const sortedKeywords = Array.from(new Set(keywords))
    .filter(k => k && k.trim().length > 1)
    .sort((a, b) => b.length - a.length);

  const pattern = sortedKeywords
    .map(k => k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  if (!pattern) return <>{text}</>;

  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = sortedKeywords.some(k => k.toLowerCase() === part.toLowerCase());
        return isMatch ? (
          <strong key={i} className="font-black text-black bg-neutral-100 px-1 rounded ring-1 ring-neutral-200">
            {part}
          </strong>
        ) : part;
      })}
    </>
  );
};

const extractSummary = (text: string): string => {
  const plain = text
    .replace(/^#{1,4}\s.+$/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^[-*>]\s/gm, '')
    .replace(/\[CITE_REF:\d+\]/g, '')
    .replace(/\[\[CITE:\d+\]\]/g, '')
    .replace(/\n{2,}/g, ' ')
    .trim();
  const sentences = plain.match(/[^.!?。\n]{10,}(?:[다요죠네함임]\s|[.!?。])\s*/g) || [];
  const result = sentences.slice(0, 2).join('').trim();
  return result || plain.substring(0, 300);
};

const ROLE_STYLES = {
  thesis: { bg: 'bg-white', border: 'border-neutral-200', dot: 'bg-black', label: '제안', align: 'left' },
  antithesis: { bg: 'bg-white', border: 'border-neutral-200', dot: 'bg-neutral-400', label: '반박', align: 'right' },
  synthesis: { bg: 'bg-white', border: 'border-neutral-200', dot: 'bg-neutral-800', label: '통합', align: 'left' },
  support: { bg: 'bg-white', border: 'border-neutral-200', dot: 'bg-neutral-600', label: '검증', align: 'right' },
} as const;

const ExpertBubble = memo(({ expertData, bubbleId, isRight, globalKeywords }: { expertData: ExpertTurnData; bubbleId: string; isRight: boolean; globalKeywords?: string[] }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const E = EXPERTS.find((e) => e.id === expertData.expertId);

  const role = expertData.role as keyof typeof ROLE_STYLES;
  const style = ROLE_STYLES[role] || ROLE_STYLES.thesis;

  const expertKeywords = expertData.keywords || [];
  const mergedKeywords = Array.from(new Set([...expertKeywords, ...(globalKeywords || [])]));

  if (!E) {
    return (
      <div className={cn("flex flex-col w-full mb-3", isRight ? "items-end" : "items-start")}>
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <X className="w-3.5 h-3.5 text-red-500" />
          </div>
          <span className="text-[12px] font-bold text-red-500">기획자 할당 오류</span>
        </div>
      </div>
    );
  }

  const cleanShort = stripCiteMarkers(sanitize(expertData.shortContent));
  const cleanFull = stripCiteMarkers(sanitize(expertData.fullContent || expertData.shortContent));

  const handleToggle = () => setIsExpanded(!isExpanded);

  return (
    <div
      id={bubbleId}
      className={cn(
        "flex flex-col w-full mb-3",
        isRight ? "items-end" : "items-start"
      )}
    >
      <div className={cn("flex items-center gap-2 mb-1 px-1", isRight && "flex-row-reverse")}>
        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm", style.dot)}>
          {(() => {
            const Icon = IconMap[E.iconName] || Bot;
            return <Icon className="w-3 text-white" />;
          })()}
        </div>
        <span className="text-[12px] font-bold text-black tracking-tight">{E.name}</span>
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{style.label}</span>

        {cleanFull && (
          <button
            onClick={handleToggle}
            className="ml-1 p-1 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400 hover:text-neutral-700"
          >
            <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", isExpanded && "rotate-180")} />
          </button>
        )}
      </div>

      <div className={cn(
        "max-w-full md:max-w-[92%] border rounded-2xl px-4 py-2.5",
        style.bg, style.border,
        "shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        isRight ? "rounded-tr-sm" : "rounded-tl-sm"
      )}>
        <p className="text-[13px] leading-[1.6] text-neutral-800 font-medium">
          {cleanShort ? (
            <>“<HighlightText text={cleanShort} keywords={mergedKeywords} />”</>
          ) : (
            cleanFull ? <HighlightText text={cleanFull.split('\n')[0]} keywords={mergedKeywords} /> : '생성 중...'
          )}
        </p>
        {isExpanded && cleanFull && (
          <div className="mt-2 pt-2 border-t border-neutral-100 text-[12.5px] leading-[1.7] text-neutral-600 whitespace-pre-wrap font-normal">
            <HighlightText text={cleanFull} keywords={mergedKeywords} />
          </div>
        )}
      </div>
    </div>
  );
});

function LoadingMessageText({ isActive }: { isActive: boolean }) {
  const messages = [
    'AI 기획자를 선발하는 중...',
    '안건을 분석하는 중...',
    '법제처에서 법규 데이터를 불러오고 있습니다.',
    '토지이용계획 데이터를 분석하고 있습니다.',
    '전문가 토론을 진행하는 중...',
    '통합 전략 기획서를 작성하는 중...'
  ];
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setMsgIndex(0);
      return;
    }
    const id = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(id);
  }, [isActive, messages.length]);

  return <>{messages[Math.min(msgIndex, messages.length - 1)]}</>;
}

const AIBubble = memo(({ data }: { data: TurnGroupNodeData }) => {
  const cleanedFinalOutput = reorderLegacyFinalOutput(sanitize(data.finalOutput || ''))
    .replace(/###\s*8\.\d\s*\[?([^\]\n]+)\]?/g, '### $1')
    .replace(/8\.\d\s*\[?([^\]\n]+)\]?/g, '$1');

  if (!cleanedFinalOutput) return null;

  const summary = extractSummary(cleanedFinalOutput);
  const roles = [data.thesis, data.antithesis, data.support, data.synthesis].filter(
    (e): e is ExpertTurnData => !!e?.expertId
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanedFinalOutput);
      alert("클립보드에 복사되었습니다.");
    } catch (e) {
      console.error("복사에 실패했습니다.", e);
    }
  };

  const handleDownloadTxt = () => {
    const element = document.createElement("a");
    const formattedLog = formatExpertText(data.workflowSimulationLog);
    const downloadContent = `[통합 전략 기획서]\n\n${cleanedFinalOutput}\n\n` +
      `================================================\n` +
      `[WORKFLOW SIMULATION LOG - 분석 과정 기록]\n` +
      `================================================\n\n` +
      `${formattedLog}`;

    const file = new Blob([downloadContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    element.download = `기획안_최종_${dateStr}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="flex flex-col items-start w-full mb-8 relative group">
      <div className="flex items-center justify-between w-full mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shadow-lg shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-[12px] font-black uppercase tracking-widest text-black flex items-center gap-2">
            PLANNERS
            {data.metacognitiveDefinition?.selectedMode && (
              <span className="text-[#00c853] text-[9px]">
                Mode {data.metacognitiveDefinition.selectedMode} — {
                  data.metacognitiveDefinition.selectedMode === 'A' ? '혁신 탐구' :
                    data.metacognitiveDefinition.selectedMode === 'B' ? '논리 심화' : '실용 해법'
                }
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="max-w-full md:max-w-[88%] rounded-[20px] border border-neutral-200/80 bg-white shadow-[0_4px_24px_rgb(0,0,0,0.07)] overflow-hidden">
        <div className="px-6 py-5 border-b border-neutral-100">
          <p className="text-[13px] italic leading-relaxed text-neutral-600 font-medium border-l-[3px] border-black pl-4">&ldquo;{summary}&rdquo;</p>
        </div>

        {roles.length > 0 && (
          <div className="px-6 py-5 border-b border-neutral-100">
            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4">기획자 대화</div>
            <div className="space-y-2">
              {roles.map((expertData, i) => (
                <ExpertBubble
                  key={i}
                  expertData={expertData}
                  bubbleId={`expert-bubble-${data.turn}-${expertData.role}`}
                  isRight={i % 2 === 1}
                  globalKeywords={data.aggregatedKeywords as string[] | undefined}
                />
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-neutral-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">통합 전략 기획서</span>
          </div>
          <div className={cn(MARKDOWN_CLASSES, "relative pl-6 border-l-2 border-black/10")}>
            <div className="absolute left-[-5px] top-0 bottom-0 w-[8px] pointer-events-none flex flex-col items-center py-8">
              <div className="w-2.5 h-2.5 rounded-full bg-black ring-4 ring-white" />
              <div className="flex-1 w-[2px] bg-gradient-to-b from-black via-black/20 to-transparent" />
            </div>
            <Markdown components={buildMarkdownComponents(data.parsedCitations as LawCitation[] | undefined || [])} remarkPlugins={[remarkGfm]}>
              {cleanedFinalOutput.replace(/###\s*Final Strategic Output/g, '')}
            </Markdown>
          </div>
        </div>

        {data.citedLaws && !(data.parsedCitations as LawCitation[] | undefined)?.length && (
          <CitedLawsSection citedLaws={data.citedLaws as string} />
        )}

        <div className="border-t border-neutral-100">
          <div className="grid grid-cols-2 divide-x divide-neutral-100 bg-neutral-50/30">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-4 text-[10px] font-bold tracking-widest text-neutral-500 hover:text-black hover:bg-white transition-all uppercase"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <button
              onClick={handleDownloadTxt}
              className="flex items-center justify-center gap-2 py-4 text-[10px] font-bold tracking-widest text-neutral-500 hover:text-black hover:bg-white transition-all uppercase"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

const UserBubble = memo(({ text, onRewind }: { text: string, onRewind: (t: string) => void }) => {
  return (
    <div className="flex flex-col items-end w-full mb-8 relative group">
      <div className="flex items-center gap-2 mb-2 w-full justify-end px-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onRewind(text)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg shadow-sm text-[10px] font-bold tracking-wider text-neutral-400 hover:text-black transition-colors"
        >
          <RotateCcw className="h-3 w-3" /> 되돌리기
        </button>
      </div>
      <div className="max-w-[85%] bg-neutral-100/70 rounded-3xl rounded-tr-sm px-5 py-4 text-[13.5px] font-medium leading-[1.8] text-neutral-900 border border-neutral-200 shadow-sm whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
});

export type Message = 
  | { type: 'user', text: string }
  | { type: 'ai', data: TurnGroupNodeData, loading?: boolean };

export interface PlannersPanelProps {
  onInsightDataUpdate?: (data: FetchLawsResult | null) => void;
  onCadastralDataReceived?: (pnu: string | null, landCount: number) => void;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

export default function PlannersPanel({ onInsightDataUpdate, onCadastralDataReceived, initialMessages, onMessagesChange }: PlannersPanelProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [chatInput, setChatInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // API 토글 로컬 상태 관리
  const [isLawApiEnabled, setIsLawApiEnabled] = useState(true);
  const [isBuildingApiEnabled, setIsBuildingApiEnabled] = useState(true);
  const [isLandApiEnabled, setIsLandApiEnabled] = useState(true);

  // 메시지 변경 시 부모에게 알림 (썸네일 저장용)
  useEffect(() => {
    onMessagesChange?.(messages);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isGenerating]);

  const handleChatSubmit = async () => {
    const text = chatInput.trim();
    if (!text || isGenerating) return;

    setMessages(prev => [...prev, { type: 'user', text }]);
    setChatInput('');
    setIsGenerating(true);

    try {
      // 1. 법령 데이터 사전 조회 (InsightPanel 용)
      const address = extractAddress(text);
      const keywords = extractLawKeywords(text.split(/[\s,]+/));
      const zoneKeyword = extractZoneKeyword(text);
      
      const insightData = await fetchRelevantLaws(keywords, address?.full || undefined, zoneKeyword || undefined, {
        enableLaw: isLawApiEnabled,
        enableBuilding: isBuildingApiEnabled,
        enableLand: isLandApiEnabled
      });

      if (onInsightDataUpdate) {
        onInsightDataUpdate(insightData);
      }

      // 브이월드 결과 1건 이상 수신 시 지적도 아트보드 생성 요청
      if (insightData.categorized.land.length > 0) {
        console.log(`[지적도] 아트보드 생성 시작 — PNU: ${insightData.pnu ?? '없음'}, 브이월드 ${insightData.categorized.land.length}건 반환`);
        onCadastralDataReceived?.(insightData.pnu, insightData.categorized.land.length);
      }

      // 2. 자체 API 라우트 통신 (Vercel 배포 시 파일 누락 오류 해결)
      const res = await fetch('/api/planners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: text, relevantLaws: insightData.formatted })
      });

      const json = await res.json();

      if (!json.success) {
        alert(json.error ?? '알 수 없는 오류가 발생했습니다.');
        setIsGenerating(false);
        return;
      }

      setMessages(prev => [...prev, { type: 'ai', data: json.data as TurnGroupNodeData }]);
    } catch (err) {
      console.error(err);
      alert('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col h-full py-0 md:py-4 transition-all duration-300 ease-out z-40 px-4 md:px-8 max-w-5xl mx-auto w-full">
      <div className="flex h-full w-full flex-col bg-white shadow-[0_8px_32px_rgb(0,0,0,0.06)] border border-neutral-200/60 overflow-hidden backdrop-blur-xl relative transition-all duration-300 rounded-[32px]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white/90 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-black" />
            <span className="text-[14px] font-black uppercase tracking-[0.1em] text-black">
              PLANNERS
            </span>
          </div>
        </div>

        {/* Chat History View */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-44 md:p-8 md:pb-60 bg-neutral-50/60">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-4 opacity-50 select-none">
              <Bot className="h-12 w-12 text-neutral-200" />
              <span className="text-[12px] font-bold tracking-widest text-neutral-400">하단 입력창을 통해 대화를 시작하세요.</span>
            </div>
          ) : (
            <div className="flex flex-col">
              {messages.map((msg, i) => {
                if (msg.type === 'user') {
                  return <UserBubble key={i} text={msg.text} onRewind={setChatInput} />;
                } else {
                  return <AIBubble key={i} data={msg.data} />;
                }
              })}
              
              {isGenerating && (
                <div className="flex flex-col items-start w-full mb-8 relative group">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shadow-lg shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-widest text-black">PLANNERS</span>
                  </div>
                  <div className="max-w-full md:max-w-[88%] rounded-[20px] border border-neutral-200/80 bg-white p-6 shadow-sm flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                    <span className="text-[13px] font-bold text-neutral-600">
                      <LoadingMessageText isActive={true} />
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Input Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-white via-white/95 to-transparent pt-10 rounded-b-[32px] pointer-events-none">
          <div className="relative flex flex-col w-full bg-[#f4f4f4] rounded-[32px] border border-neutral-200 shadow-sm transition-all focus-within:bg-white focus-within:border-neutral-300 focus-within:shadow-xl overflow-hidden group/input-container pointer-events-auto">
            <div className="relative flex flex-col pt-1">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
                placeholder={isGenerating ? "분석 중입니다..." : "최고의 전문가 팀과 안건을 토론해 보세요."}
                disabled={isGenerating}
                className="w-full max-h-[220px] min-h-[52px] md:min-h-[64px] pt-4 pb-14 pl-6 pr-6 bg-transparent text-[14px] font-medium leading-relaxed text-black placeholder-neutral-400 resize-none outline-none custom-scrollbar disabled:opacity-50"
              />

              <div className="absolute bottom-2 left-0 right-0 px-4 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-1 pointer-events-auto">
                  <button
                    className="p-2.5 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-200/50 transition-all"
                    title="기능 준비중"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                  <button
                    className="p-2.5 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-200/50 transition-all"
                    title="기능 준비중"
                  >
                    <WandSparkles className="w-4.5 h-4.5" />
                  </button>
                  
                  {/* API Toggles */}
                  {[
                    { key: 'law', icon: Scale, enabled: isLawApiEnabled, toggle: () => setIsLawApiEnabled(!isLawApiEnabled) },
                    { key: 'building', icon: Building2, enabled: isBuildingApiEnabled, toggle: () => setIsBuildingApiEnabled(!isBuildingApiEnabled) },
                    { key: 'land', icon: LandPlot, enabled: isLandApiEnabled, toggle: () => setIsLandApiEnabled(!isLandApiEnabled) },
                  ].map(({ key, icon: Icon, enabled, toggle }) => (
                    <div key={key} className="flex items-center gap-1.5 px-0.5 cursor-default ml-2">
                      <Icon className={cn("w-4 h-4 shrink-0", enabled ? "text-black" : "text-neutral-300")} />
                      <AppleToggle enabled={enabled} onToggle={toggle} />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                  <div className="w-px h-4 bg-neutral-200 mx-1" />
                  <button
                    onClick={handleChatSubmit}
                    disabled={!chatInput.trim() || isGenerating}
                    className={cn(
                      "p-2.5 rounded-full transition-all shadow-sm",
                      chatInput.trim() && !isGenerating
                        ? "bg-black text-white hover:scale-105 active:scale-95 shadow-lg"
                        : "bg-neutral-200 text-neutral-400"
                    )}
                  >
                    {isGenerating ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Send className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

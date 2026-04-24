/**
 * app/api/elevation/process/route.ts
 * CAI_CANVAS → ELEVATION S2S 프록시
 *
 * 요청을 ELEVATION Vercel 백엔드로 전달하고 결과를 그대로 반환합니다.
 * Canvas는 순수 UI 렌더러 역할만 수행합니다 (절대 원칙).
 */
import { NextRequest, NextResponse } from 'next/server';

const ELEVATION_BACKEND =
  process.env.ELEVATION_BACKEND_URL ?? 'https://elevation-rose.vercel.app/api/process';

/* Vercel 서버리스 최대 실행 시간 (ELEVATION 백엔드 120s + 여유) */
export const maxDuration = 130;

export async function POST(req: NextRequest) {
  let body: { imageBase64?: string; mimeType?: string; prompt?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const { imageBase64, mimeType, prompt = '' } = body;

  if (!imageBase64 || !mimeType) {
    return NextResponse.json(
      { success: false, error: 'imageBase64 and mimeType are required.' },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 128_000);

  try {
    const upstream = await fetch(ELEVATION_BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType, prompt }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    clearTimeout(timer);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

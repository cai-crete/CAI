/**
 * app/api/elevation/linedrawing/route.ts
 * CAI_CANVAS → ELEVATION Line Drawing S2S 프록시
 *
 * ElevationNode의 5장 이미지를 ELEVATION 백엔드로 전달하여
 * 건축 라인드로잉으로 변환한 결과를 반환합니다.
 *
 * POST /api/elevation/linedrawing
 * Body: { images: { front, rear, right, left, top } }
 */
import { NextRequest, NextResponse } from 'next/server';

const ELEVATION_BACKEND_BASE =
  process.env.ELEVATION_BACKEND_URL
    ? process.env.ELEVATION_BACKEND_URL.replace(/\/api\/process$/, '')
    : 'https://elevation-rose.vercel.app';

const LINEDRAWING_ENDPOINT = `${ELEVATION_BACKEND_BASE}/api/linedrawing`;

/* Vercel 서버리스 최대 실행 시간 (ELEVATION 백엔드 120s + 여유) */
export const maxDuration = 130;

export async function POST(req: NextRequest) {
  let body: { images?: Record<string, string> };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const { images } = body;

  if (!images || typeof images !== 'object') {
    return NextResponse.json(
      { success: false, error: '"images" object is required.' },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 128_000);

  try {
    const upstream = await fetch(LINEDRAWING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
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

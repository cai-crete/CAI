import { NextResponse } from 'next/server';

const PLANNERS_BACKEND_URL = 'https://cai-planners-v2.vercel.app';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const res = await fetch(`${PLANNERS_BACKEND_URL}/api/planners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[Planners Proxy] 백엔드 오류:', res.status, text.slice(0, 200));
      return NextResponse.json(
        { success: false, error: `Planners 백엔드에 문제가 발생했습니다 (${res.status}). 잠시 후 다시 시도해주세요.` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[Planners Proxy] 오류:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

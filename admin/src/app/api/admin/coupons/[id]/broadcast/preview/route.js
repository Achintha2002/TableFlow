import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function POST(req, { params }) {
  try {
    const resolved = params instanceof Promise ? await params : params;
    const id = resolved?.id;
    const body = await req.json().catch(() => ({}));

    const response = await fetch(`${API_BASE}/api/admin/coupons/${id}/broadcast/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error('[Next.js Proxy Broadcast Preview Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal proxy error' }, { status: 500 });
  }
}

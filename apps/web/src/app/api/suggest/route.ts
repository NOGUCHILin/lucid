import { NextRequest, NextResponse } from 'next/server'

const HOCUSPOCUS_URL = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL?.replace(/^ws/, 'http') || 'http://127.0.0.1:1234'

// POST /api/suggest — Hocuspocusのsuggest APIへプロキシ
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const res = await fetch(`${HOCUSPOCUS_URL}/api/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ suggestion: '' })
  }
}

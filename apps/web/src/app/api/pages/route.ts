import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasSupabase = !!(supabaseUrl && supabaseAnonKey)

function getSupabase() {
  return createClient(supabaseUrl!, supabaseAnonKey!)
}

// Supabase未接続時のインメモリストア（開発用）
interface Page {
  id: string
  title: string
  prev_page_id: string | null
  created_at: string
  updated_at: string
}
const memoryPages: Page[] = []

// GET /api/pages
export async function GET() {
  if (!hasSupabase) {
    return NextResponse.json(memoryPages.sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('pages')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// POST /api/pages
export async function POST(request: NextRequest) {
  const body = await request.json()
  const id = nanoid(12)
  const now = new Date().toISOString()

  if (!hasSupabase) {
    const page: Page = {
      id,
      title: body.title || '無題のページ',
      prev_page_id: body.prevPageId || null,
      created_at: now,
      updated_at: now,
    }
    memoryPages.push(page)
    return NextResponse.json(page, { status: 201 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('pages')
    .insert({
      id,
      title: body.title || '無題のページ',
      prev_page_id: body.prevPageId || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

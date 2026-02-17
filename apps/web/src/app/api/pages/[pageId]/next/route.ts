import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasSupabase = !!(supabaseUrl && supabaseAnonKey)

// GET /api/pages/[pageId]/next
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params

  if (!hasSupabase) {
    return NextResponse.json(null, { status: 404 })
  }

  const supabase = createClient(supabaseUrl!, supabaseAnonKey!)
  const { data, error } = await supabase
    .from('pages')
    .select('id, title')
    .eq('prev_page_id', pageId)
    .single()

  if (error || !data) {
    return NextResponse.json(null, { status: 404 })
  }
  return NextResponse.json(data)
}

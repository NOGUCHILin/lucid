import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@lucid/database'

// GET /api/wallets/[walletId]/transactions
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ walletId: string }> }
) {
  const { walletId } = await params
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .or(`from_wallet_id.eq.${walletId},to_wallet_id.eq.${walletId}`)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

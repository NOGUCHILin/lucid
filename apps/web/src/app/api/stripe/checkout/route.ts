import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@lucid/database'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-01-28.clover' })

// POST /api/stripe/checkout — create Checkout Session for wallet top-up
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { amount } = await request.json()
  if (typeof amount !== 'number' || amount < 100) {
    return NextResponse.json({ error: 'amount must be >= 100 (yen)' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          product_data: { name: 'Lucid ウォレットチャージ' },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    metadata: { user_id: user.id, amount: String(amount) },
    success_url: `${appUrl}?topup=success`,
    cancel_url: `${appUrl}?topup=cancel`,
  })

  return NextResponse.json({ url: session.url })
}

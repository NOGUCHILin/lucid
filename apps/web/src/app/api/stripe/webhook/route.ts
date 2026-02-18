/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@lucid/database'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-01-28.clover' })
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// POST /api/stripe/webhook — handle Stripe events
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id
    const amount = Number(session.metadata?.amount || 0)

    if (userId && amount > 0) {
      const admin = createAdminClient() as any

      // Idempotency: check if this session was already processed
      const { data: existing } = await admin
        .from('transactions')
        .select('id')
        .eq('description', `Stripe checkout ${session.id}`)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json({ received: true })
      }

      // Atomic top-up via wallet_top_up RPC (FOR UPDATE lock inside)
      const { error: rpcError } = await admin.rpc('wallet_top_up', {
        p_entity_id: userId,
        p_amount: amount,
        p_description: `Stripe checkout ${session.id}`,
      })

      if (rpcError) {
        console.error('[stripe-webhook] wallet_top_up failed:', rpcError.message)
      }
    }
  }

  return NextResponse.json({ received: true })
}

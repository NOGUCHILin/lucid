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
      const admin = createAdminClient()

      // Get user wallet
      const { data: wallet } = await (admin as any)
        .from('wallets')
        .select('id, balance')
        .eq('entity_id', userId)
        .eq('entity_type', 'user')
        .single()

      if (wallet) {
        // Add balance
        await (admin as any)
          .from('wallets')
          .update({ balance: wallet.balance + amount })
          .eq('id', wallet.id)

        // Record transaction
        await (admin as any).from('transactions').insert({
          type: 'deposit',
          to_wallet_id: wallet.id,
          amount,
          description: `Stripe checkout ${session.id}`,
          status: 'completed',
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}

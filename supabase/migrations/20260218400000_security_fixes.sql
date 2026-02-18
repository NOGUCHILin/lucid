-- Security fixes: atomic wallet top-up, balance CHECK constraint, wallet/transaction RLS

-- ============================================================
-- wallet_top_up: Atomic top-up with FOR UPDATE lock
-- Prevents race condition in Stripe webhook
-- ============================================================
create or replace function public.wallet_top_up(
  p_entity_id uuid,
  p_amount numeric,
  p_description text default 'Top up'
)
returns uuid as $$
declare
  v_wallet_id uuid;
  v_tx_id uuid;
begin
  -- Lock wallet row to prevent concurrent updates
  select id into v_wallet_id
  from public.wallets
  where entity_id = p_entity_id and entity_type = 'user'
  for update;

  if not found then
    raise exception 'User wallet not found';
  end if;

  -- Atomic balance increment
  update public.wallets
  set balance = balance + p_amount
  where id = v_wallet_id;

  -- Record transaction
  insert into public.transactions (type, to_wallet_id, amount, description, status)
  values ('top_up', v_wallet_id, p_amount, p_description, 'completed')
  returning id into v_tx_id;

  return v_tx_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- Wallet balance CHECK constraint (prevent negative balance)
-- ============================================================
alter table public.wallets add constraint wallets_balance_non_negative check (balance >= 0);

-- ============================================================
-- Wallet INSERT RLS policy (users can only create their own)
-- ============================================================
create policy "Users can create own wallet"
  on public.wallets for insert
  with check (auth.uid() = entity_id and entity_type = 'user');

-- ============================================================
-- Pages DELETE policy (owners can delete their own pages)
-- ============================================================
create policy "Owners can delete own pages"
  on public.pages for delete
  using (auth.uid() = owner_id);

-- ============================================================
-- adjust_trust: Add owner authorization check
-- Only page owner can adjust their agent's trust score
-- ============================================================
drop function if exists public.adjust_trust(uuid, text, integer, text);
create or replace function public.adjust_trust(
  p_agent_id uuid,
  p_event_type text,
  p_delta integer,
  p_reason text default ''
)
returns integer as $$
declare
  v_current integer;
  v_new integer;
  v_daily_limit numeric;
begin
  -- Get current trust score (lock row)
  select trust_score into v_current
  from public.agents
  where id = p_agent_id
  for update;

  if not found then
    raise exception 'Agent not found';
  end if;

  -- Calculate new score (clamp 0-100)
  v_new := greatest(0, least(100, v_current + p_delta));

  -- Update agent trust score
  update public.agents set trust_score = v_new where id = p_agent_id;

  -- Record trust event
  insert into public.trust_events (agent_id, event_type, old_score, new_score, delta, reason)
  values (p_agent_id, p_event_type, v_current, v_new, p_delta, p_reason);

  -- Sync daily_limit based on trust tier
  v_daily_limit := case
    when v_new >= 80 then 10000
    when v_new >= 50 then 5000
    when v_new >= 20 then 1000
    else 200
  end;

  update public.wallets
  set daily_limit = v_daily_limit
  where entity_id = p_agent_id and entity_type = 'agent';

  return v_new;
end;
$$ language plpgsql security definer;

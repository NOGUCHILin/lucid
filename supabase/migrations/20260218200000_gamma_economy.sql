-- Lucid γ-2: Economy Layer Completion

-- ============================================================
-- 原子的資金移転RPC関数
-- ============================================================
create or replace function public.transfer_funds(
  p_from_wallet uuid,
  p_to_wallet uuid,
  p_amount numeric,
  p_description text default 'Transfer'
)
returns uuid as $$
declare
  v_from_balance numeric;
  v_tx_id uuid;
begin
  -- 送金元の残高を取得（排他ロック）
  select balance into v_from_balance
  from public.wallets
  where id = p_from_wallet
  for update;

  if not found then
    raise exception 'Source wallet not found';
  end if;

  if v_from_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  -- 送金先もロック
  perform 1 from public.wallets where id = p_to_wallet for update;

  -- 残高更新
  update public.wallets set balance = balance - p_amount where id = p_from_wallet;
  update public.wallets set balance = balance + p_amount where id = p_to_wallet;

  -- トランザクション記録
  insert into public.transactions (type, from_wallet_id, to_wallet_id, amount, description, status)
  values ('transfer', p_from_wallet, p_to_wallet, p_amount, p_description, 'completed')
  returning id into v_tx_id;

  return v_tx_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- エージェント支出記録RPC関数
-- ============================================================
create or replace function public.agent_spend(
  p_agent_id uuid,
  p_amount numeric,
  p_description text default 'Agent action'
)
returns jsonb as $$
declare
  v_wallet_id uuid;
  v_balance numeric;
  v_daily_spent numeric;
  v_daily_limit numeric;
begin
  -- ウォレット取得（排他ロック）
  select id, balance, daily_spent, daily_limit
  into v_wallet_id, v_balance, v_daily_spent, v_daily_limit
  from public.wallets
  where entity_id = p_agent_id and entity_type = 'agent'
  for update;

  if not found then
    raise exception 'Agent wallet not found';
  end if;

  -- 日次上限チェック
  if v_daily_spent + p_amount > v_daily_limit then
    -- 予算超過 → エージェント停止
    update public.agents set status = 'paused' where id = p_agent_id;
    return jsonb_build_object('error', 'daily_limit_exceeded', 'daily_spent', v_daily_spent, 'daily_limit', v_daily_limit);
  end if;

  -- 残高チェック
  if v_balance < p_amount then
    update public.agents set status = 'paused' where id = p_agent_id;
    return jsonb_build_object('error', 'insufficient_balance', 'balance', v_balance);
  end if;

  -- 残高・日次使用額更新
  update public.wallets
  set balance = balance - p_amount, daily_spent = daily_spent + p_amount
  where id = v_wallet_id;

  -- トランザクション記録
  insert into public.transactions (type, from_wallet_id, amount, description, status)
  values ('usage', v_wallet_id, p_amount, p_description, 'completed');

  return jsonb_build_object(
    'success', true,
    'balance', v_balance - p_amount,
    'daily_spent', v_daily_spent + p_amount
  );
end;
$$ language plpgsql security definer;

-- ============================================================
-- daily_spent リセット（毎日0時JST = 15:00 UTC）
-- ============================================================
-- pg_cronが使用可能な場合のみ（Supabase CLIではスキップ可）
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'reset-daily-spent',
      '0 15 * * *',
      'UPDATE public.wallets SET daily_spent = 0'
    );
  end if;
exception when others then
  raise notice 'pg_cron not available, skipping daily reset schedule';
end $$;

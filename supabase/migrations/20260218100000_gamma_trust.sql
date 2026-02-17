-- Lucid γ-1: Trust Auto-Adjustment + History

-- ============================================================
-- Trust Events: 信頼度変動ログ
-- ============================================================
create table public.trust_events (
  id bigint generated always as identity primary key,
  agent_id uuid not null references public.agents(id) on delete cascade,
  event_type text not null check (event_type in (
    'approval_accepted', 'approval_rejected',
    'budget_exceeded', 'task_completed', 'manual_adjust'
  )),
  delta integer not null,
  old_score integer not null,
  new_score integer not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index idx_trust_events_agent on public.trust_events(agent_id, created_at desc);
alter table public.trust_events enable row level security;

create policy "Users can read trust events for own agents"
  on public.trust_events for select
  using (agent_id in (select id from public.agents where owner_id = auth.uid()));

-- service_role でINSERTするためポリシー不要（API側で認証済み）

-- ============================================================
-- Approval Requests: resolved_by/resolved_at 追加
-- ============================================================
-- resolved_by は既にスキーマにあるが、resolved_at を追加
-- (β schemaで既にresolved_by定義済みだが、resolved_atが未追加のケース)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'approval_requests' and column_name = 'resolved_at'
  ) then
    alter table public.approval_requests add column resolved_at timestamptz;
  end if;
end $$;

-- ============================================================
-- Trust調整用RPC関数（原子性確保）
-- ============================================================
create or replace function public.adjust_trust(
  p_agent_id uuid,
  p_event_type text,
  p_delta integer,
  p_reason text default ''
)
returns jsonb as $$
declare
  v_old_score integer;
  v_new_score integer;
begin
  -- 現在のスコアを取得（排他ロック）
  select trust_score into v_old_score
  from public.agents
  where id = p_agent_id
  for update;

  if not found then
    raise exception 'Agent not found';
  end if;

  -- 新スコア計算（0-100制約）
  v_new_score := greatest(0, least(100, v_old_score + p_delta));

  -- agents更新
  update public.agents
  set trust_score = v_new_score
  where id = p_agent_id;

  -- wallets daily_limit更新（ティア連動）
  update public.wallets
  set daily_limit = case
    when v_new_score <= 20 then 100
    when v_new_score <= 50 then 1000
    when v_new_score <= 80 then 10000
    else 100000
  end
  where entity_id = p_agent_id and entity_type = 'agent';

  -- trust_events記録
  insert into public.trust_events (agent_id, event_type, delta, old_score, new_score, reason)
  values (p_agent_id, p_event_type, p_delta, v_old_score, v_new_score, p_reason);

  return jsonb_build_object(
    'old_score', v_old_score,
    'new_score', v_new_score,
    'delta', p_delta
  );
end;
$$ language plpgsql security definer;

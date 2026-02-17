-- Lucid β Schema: Agents + Behavior Events + Approval Requests

-- ============================================================
-- Agents: エージェントのメタデータ・信頼度管理
-- ============================================================
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Agent',
  trust_score integer not null default 20 check (trust_score >= 0 and trust_score <= 100),
  status text not null default 'active' check (status in ('active', 'paused', 'disabled')),
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_agents_owner on public.agents(owner_id);
alter table public.agents enable row level security;

create policy "Users can read own agents"
  on public.agents for select using (auth.uid() = owner_id);
create policy "Users can insert own agents"
  on public.agents for insert with check (auth.uid() = owner_id);
create policy "Users can update own agents"
  on public.agents for update using (auth.uid() = owner_id);
create policy "Users can delete own agents"
  on public.agents for delete using (auth.uid() = owner_id);

-- エージェント作成時にウォレット自動生成
create or replace function public.handle_new_agent()
returns trigger as $$
begin
  insert into public.wallets (entity_id, entity_type, balance, daily_limit)
  values (new.id, 'agent', 0, 100);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_agent_created
  after insert on public.agents
  for each row execute function public.handle_new_agent();

create trigger agents_updated_at
  before update on public.agents
  for each row execute function public.update_updated_at();

-- ============================================================
-- Pages: エージェント割り当てカラム追加
-- ============================================================
alter table public.pages add column agent_id uuid references public.agents(id) on delete set null;
create index idx_pages_agent on public.pages(agent_id);

-- ============================================================
-- Behavior Events: ユーザー行動ログ
-- ============================================================
create table public.behavior_events (
  id bigint generated always as identity primary key,
  page_id uuid not null references public.pages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('edit', 'cursor_move', 'pause', 'selection', 'focus', 'blur')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_behavior_events_lookup on public.behavior_events(page_id, user_id, created_at);
alter table public.behavior_events enable row level security;

create policy "Users can insert own behavior events"
  on public.behavior_events for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- Approval Requests: 承認フロー
-- ============================================================
create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  action_type text not null check (action_type in ('write', 'spend', 'api_call')),
  description text not null default '',
  amount decimal(12,2),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_approval_page_status on public.approval_requests(page_id, status);
create index idx_approval_agent on public.approval_requests(agent_id);
alter table public.approval_requests enable row level security;

create policy "Users can read approvals for own agents"
  on public.approval_requests for select
  using (agent_id in (select id from public.agents where owner_id = auth.uid()));
create policy "Users can update approvals for own agents"
  on public.approval_requests for update
  using (agent_id in (select id from public.agents where owner_id = auth.uid()));

-- ============================================================
-- Wallets: エージェントウォレットへのアクセスポリシー追加
-- ============================================================
create policy "Users can read agent wallets"
  on public.wallets for select
  using (
    entity_type = 'agent'
    and entity_id in (select id from public.agents where owner_id = auth.uid())
  );

create policy "Users can update agent wallets"
  on public.wallets for update
  using (
    entity_type = 'agent'
    and entity_id in (select id from public.agents where owner_id = auth.uid())
  );

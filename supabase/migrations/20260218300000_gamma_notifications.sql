-- Lucid γ-5: Notifications + Mentions

-- ============================================================
-- Notifications テーブル
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('mention', 'approval_request', 'agent_paused', 'fund_low')),
  title text not null,
  body text not null default '',
  page_id uuid references public.pages(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, read, created_at desc);
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Realtime有効化
alter publication supabase_realtime add table public.notifications;
